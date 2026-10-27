import ExcelJS from 'exceljs';
import { BELT_LABELS, beltCategory, isBeltCode, type BeltCode } from './belts.js';
import { ENTRY_STATUSES, EVENT_STATUSES, ensureSchema, logAction, query, withTx } from './db.js';
import {
  DEFAULT_GROUPING,
  assignGroups,
  buildGroups,
  groupKeyFor,
  resolveAge,
  resolveBlock,
  type GroupableEntry,
  type GroupingOptions,
} from './grouping.js';
import {
  HttpError,
  RawReply,
  Reply,
  addDays,
  capped,
  clean,
  isIsoDate,
  normalizePhone,
  toInt,
  validateFighter,
  type Ctx,
  type Route,
} from './http.js';
import { parseFighters } from './parser.js';
import { GROUPABLE_ENTRY_STATUSES, getEventById, eventCounters, type EventRow } from './store.js';

const actor = (ctx: Ctx) => ctx.admin || 'admin';

const eventFromQuery = async (ctx: Ctx, source: 'query' | 'body' = 'query'): Promise<EventRow> => {
  const raw = source === 'query' ? ctx.query.event_id : ctx.body?.event_id;
  const id = toInt(raw);
  if (id === null) throw new HttpError(400, 'Вкажіть event_id');
  const event = await getEventById(id);
  if (!event) throw new HttpError(404, 'Подію не знайдено');
  return event;
};

const GROUP_KEY_RE = /^(kids|open)\|(m|f)\|[^|]+\|[^|]+\|[ABC]$/;

const optionalInt = (value: unknown, label: string, min = 0): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = toInt(value);
  if (n === null || n < min) throw new HttpError(400, `${label}: некоректне число`);
  return n;
};

const optionalDate = (value: unknown, label: string): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (!isIsoDate(value)) throw new HttpError(400, `${label}: дата має бути у форматі РРРР-ММ-ДД`);
  return value;
};

const parseSchedule = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  const v = value as { kids?: unknown; open?: unknown };
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const key of ['kids', 'open'] as const) {
    if (v[key] !== undefined && !(typeof v[key] === 'string' && time.test(v[key] as string))) {
      throw new HttpError(400, `Розклад ${key}: час має бути у форматі ГГ:ХХ`);
    }
  }
  return JSON.stringify({ kids: v.kids, open: v.open });
};

function groupingOptions(ctx: Ctx): GroupingOptions {
  const pick = (name: string, fallback: number) => {
    const n = toInt(ctx.query[name]);
    return n !== null && n >= 1 && n <= 20 ? n : fallback;
  };
  return {
    kidsAgeStep: pick('kids_age_step', DEFAULT_GROUPING.kidsAgeStep),
    kidsWeightStep: pick('kids_weight_step', DEFAULT_GROUPING.kidsWeightStep),
    openWeightStep: pick('open_weight_step', DEFAULT_GROUPING.openWeightStep),
  };
}

type EntryRow = GroupableEntry & {
  full_name: string;
  club: string | null;
  coach_full_name: string | null;
  profile_id: number;
};

async function loadGroupEntries(event: EventRow): Promise<{ entries: EntryRow[]; skipped: Array<{ id: number; full_name: string; reason: string }> }> {
  const rows = await query(
    `SELECT e.id, e.block, e.weight_kg, e.belt, e.group_key, e.group_manual, e.profile_id,
            f.full_name, f.sex, f.birth_date, f.age_years, p.club, p.coach_full_name
     FROM shingi_entries e
     JOIN shingi_fighters f ON f.id = e.fighter_id
     JOIN shingi_profiles p ON p.id = e.profile_id
     WHERE e.event_id = $1 AND e.status = ANY($2::text[])
     ORDER BY e.id`,
    [event.id, [...GROUPABLE_ENTRY_STATUSES]],
  );
  const entries: EntryRow[] = [];
  const skipped: Array<{ id: number; full_name: string; reason: string }> = [];
  for (const row of rows) {
    const age = resolveAge(row, event.event_date);
    if (age === null || !isBeltCode(row.belt)) {
      skipped.push({ id: row.id, full_name: row.full_name, reason: age === null ? 'не вказано вік' : 'невідомий пояс' });
      continue;
    }
    entries.push({
      id: row.id,
      block: row.block,
      sex: row.sex,
      age,
      weight_kg: row.weight_kg,
      belt: row.belt as BeltCode,
      group_key: row.group_key,
      group_manual: row.group_manual,
      full_name: row.full_name,
      club: row.club,
      coach_full_name: row.coach_full_name,
      profile_id: row.profile_id,
    });
  }
  return { entries, skipped };
}

const serializeGroups = (entries: EntryRow[], groups: ReturnType<typeof buildGroups>) => {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return groups.map((g) => ({
    key: g.key,
    block: g.block,
    sex: g.sex,
    age_bucket: g.ageBucket,
    weight_band: g.weightBand,
    belt_cat: g.beltCat,
    size: g.members.length,
    single: g.single,
    members: g.members.map((m) => {
      const e = byId.get(m.id)!;
      return {
        entry_id: e.id,
        full_name: e.full_name,
        club: e.club,
        coach: e.coach_full_name,
        age: e.age,
        weight_kg: e.weight_kg,
        belt: e.belt,
        manual: Boolean(e.group_manual),
      };
    }),
  }));
};

/** Прибирає з рядка CSV/XLSX початок формули (=, +, -, @), щоб Excel її не виконав. */
const safeCell = (value: unknown) => {
  if (typeof value !== 'string') return value ?? '';
  if (/^\+\d[\d\s()-]*$/.test(value)) return value; // телефон +380..., не формула
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
};

const csvLine = (cells: unknown[]) =>
  cells
    .map((c) => {
      const s = String(safeCell(c));
      return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');

const notReady = (stage: number, what: string) => async (): Promise<never> => {
  throw new HttpError(501, `${what} з'явиться на етапі ${stage}`, 'not_implemented');
};

export const adminRoutes: Route[] = [
  {
    method: 'GET',
    path: 'admin/migrate',
    auth: 'admin',
    handler: async () => {
      await ensureSchema();
      const tables = await query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'shingi\\_%' ORDER BY table_name`,
      );
      return { ok: true, tables: tables.map((t) => t.table_name) };
    },
  },

  // --- події ---
  {
    method: 'GET',
    path: 'admin/events',
    auth: 'admin',
    handler: async () => {
      const events = await query<EventRow>('SELECT * FROM shingi_events ORDER BY event_date DESC');
      const withCounters = await Promise.all(events.map(async (event) => ({ ...event, counters: await eventCounters(event) })));
      return { events: withCounters };
    },
  },
  {
    method: 'POST',
    path: 'admin/events',
    auth: 'admin',
    handler: async (ctx) => {
      const b = ctx.body || {};
      const title = capped(b.title, 200);
      const slug = capped(b.slug, 80);
      if (!title || !slug || !/^[a-z0-9-]+$/.test(slug)) throw new HttpError(400, 'Вкажіть назву та slug (латиниця, цифри, дефіс)');
      if (!isIsoDate(b.event_date)) throw new HttpError(400, 'Вкажіть дату події (РРРР-ММ-ДД)');
      const status = b.status ?? 'draft';
      if (!(EVENT_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, 'Невідомий статус події');
      const d = b.event_date;
      try {
        const rows = await query<EventRow>(
          `INSERT INTO shingi_events (slug, title, event_date, status, fee_uah, limit_kids, limit_open, deadline_apps, deadline_pay, groups_publish_date, address, schedule_json, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'Київ, вул. Сім''ї Бродських, 31/33, зал Black Bear Dojo'), COALESCE($12::jsonb, '{"kids":"10:00","open":"13:00"}'::jsonb), $13)
           RETURNING *`,
          [
            slug, title, d, status,
            optionalInt(b.fee_uah, 'Внесок', 0) ?? 400,
            optionalInt(b.limit_kids, 'Ліміт Kids', 1),
            optionalInt(b.limit_open, 'Ліміт Open', 1),
            optionalDate(b.deadline_apps, 'Дедлайн заявок') ?? addDays(d, -10),
            optionalDate(b.deadline_pay, 'Дедлайн внеску') ?? addDays(d, -7),
            optionalDate(b.groups_publish_date, 'Дата публікації груп') ?? addDays(d, -5),
            capped(b.address, 300),
            parseSchedule(b.schedule_json) ?? null,
            capped(b.notes, 2000),
          ],
        );
        await logAction(actor(ctx), 'event.create', 'event', rows[0].id, { slug });
        return new Reply(201, { event: rows[0] });
      } catch (error: any) {
        if (error?.code === '23505') throw new HttpError(409, 'Подія з таким slug уже є');
        throw error;
      }
    },
  },
  {
    method: 'PUT',
    path: 'admin/events/:id',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const b = ctx.body || {};
      const sets: string[] = [];
      const values: unknown[] = [id];
      const set = (column: string, value: unknown, cast = '') => {
        values.push(value);
        sets.push(`${column} = $${values.length}${cast}`);
      };
      if (b.title !== undefined) {
        const title = capped(b.title, 200);
        if (!title) throw new HttpError(400, 'Назва не може бути порожньою');
        set('title', title);
      }
      if (b.event_date !== undefined) {
        if (!isIsoDate(b.event_date)) throw new HttpError(400, 'Дата події: формат РРРР-ММ-ДД');
        set('event_date', b.event_date);
      }
      if (b.status !== undefined) {
        if (!(EVENT_STATUSES as readonly string[]).includes(b.status)) throw new HttpError(400, 'Невідомий статус події');
        set('status', b.status);
      }
      if (b.fee_uah !== undefined) set('fee_uah', optionalInt(b.fee_uah, 'Внесок', 0) ?? 400);
      if (b.limit_kids !== undefined) set('limit_kids', optionalInt(b.limit_kids, 'Ліміт Kids', 1));
      if (b.limit_open !== undefined) set('limit_open', optionalInt(b.limit_open, 'Ліміт Open', 1));
      if (b.deadline_apps !== undefined) set('deadline_apps', optionalDate(b.deadline_apps, 'Дедлайн заявок'));
      if (b.deadline_pay !== undefined) set('deadline_pay', optionalDate(b.deadline_pay, 'Дедлайн внеску'));
      if (b.groups_publish_date !== undefined) set('groups_publish_date', optionalDate(b.groups_publish_date, 'Дата публікації груп'));
      if (b.address !== undefined) set('address', capped(b.address, 300));
      if (b.notes !== undefined) set('notes', capped(b.notes, 2000));
      if (b.schedule_json !== undefined) set('schedule_json', parseSchedule(b.schedule_json) ?? null, '::jsonb');
      if (sets.length === 0) throw new HttpError(400, 'Нічого оновлювати');

      const rows = await query<EventRow>(`UPDATE shingi_events SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, values);
      if (!rows[0]) throw new HttpError(404, 'Подію не знайдено');
      await logAction(actor(ctx), 'event.update', 'event', id, Object.keys(b));
      return { event: rows[0] };
    },
  },

  // --- заявки ---
  {
    method: 'GET',
    path: 'admin/entries',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx);
      const where = ['e.event_id = $1'];
      const values: unknown[] = [event.id];
      const filter = (sql: string, value: unknown) => {
        values.push(value);
        where.push(sql.replace('?', `$${values.length}`));
      };
      if (ctx.query.block === 'kids' || ctx.query.block === 'open') filter('e.block = ?', ctx.query.block);
      if (ctx.query.status && (ENTRY_STATUSES as readonly string[]).includes(ctx.query.status)) filter('e.status = ?', ctx.query.status);
      if (clean(ctx.query.club)) filter('p.club ILIKE ?', `%${ctx.query.club.trim().replace(/[%_]/g, '')}%`);

      const rows = await query(
        `SELECT e.id, e.event_id, e.status, e.block, e.block_override, e.weight_kg, e.belt, e.group_key, e.group_manual, e.fights_count,
                f.id AS fighter_id, f.full_name, f.sex, f.birth_date, f.age_years,
                p.id AS profile_id, p.club, p.coach_full_name, p.federation, p.city, p.phone, p.tg_username,
                (SELECT pay.status FROM shingi_payments pay WHERE e.id = ANY(pay.entries_ids) ORDER BY pay.created_at DESC LIMIT 1) AS payment_status
         FROM shingi_entries e
         JOIN shingi_fighters f ON f.id = e.fighter_id
         JOIN shingi_profiles p ON p.id = e.profile_id
         WHERE ${where.join(' AND ')}
         ORDER BY p.club, f.full_name`,
        values,
      );
      const entries = rows.map((row) => ({
        ...row,
        age: resolveAge(row, event.event_date),
        belt_cat: isBeltCode(row.belt) ? beltCategory(row.belt) : null,
      }));
      return { event, entries, total: entries.length };
    },
  },
  {
    // ручне створення команди від імені тренера без Telegram
    method: 'POST',
    path: 'admin/entries',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx, 'body');
      const fightersRaw = ctx.body?.fighters;
      if (!Array.isArray(fightersRaw) || fightersRaw.length === 0) throw new HttpError(400, 'Додайте хоча б одного бійця');
      if (fightersRaw.length > 100) throw new HttpError(413, 'Забагато бійців за раз (максимум 100)');
      const fighters = fightersRaw.map((item, i) => ({ input: validateFighter(item, `Боєць ${i + 1}`), override: Boolean(item?.block_override) }));

      const result = await withTx(async (run) => {
        let profileId = toInt(ctx.body?.profile_id);
        if (profileId === null) {
          const p = ctx.body?.profile || {};
          const club = capped(p.club, 120);
          const coach = capped(p.coach_full_name, 120);
          if (!club || !coach) throw new HttpError(400, 'Вкажіть клуб і ПІБ тренера');
          const created = await run(
            `INSERT INTO shingi_profiles (role, federation, club, city, coach_full_name, phone)
             VALUES ('coach', $1, $2, $3, $4, $5) RETURNING id`,
            [capped(p.federation, 80), club, capped(p.city, 80) || 'Київ', coach, normalizePhone(p.phone)],
          );
          profileId = created[0].id;
        } else {
          const exists = await run('SELECT id FROM shingi_profiles WHERE id = $1', [profileId]);
          if (!exists[0]) throw new HttpError(404, 'Профіль не знайдено');
        }

        const entries = [];
        for (const { input: f, override } of fighters) {
          const fighter = await run(
            `INSERT INTO shingi_fighters (profile_id, full_name, sex, birth_date, age_years, weight_kg, belt, guardian_name, guardian_phone, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (profile_id, lower(full_name), (COALESCE(birth_date, DATE '1900-01-01')))
             DO UPDATE SET weight_kg = EXCLUDED.weight_kg, belt = EXCLUDED.belt, updated_at = now()
             RETURNING id`,
            [profileId, f.full_name, f.sex, f.birth_date, f.age_years, f.weight_kg, f.belt, f.guardian_name, f.guardian_phone, f.notes],
          );
          const age = resolveAge(f, event.event_date)!;
          const entry = await run(
            `INSERT INTO shingi_entries (event_id, fighter_id, profile_id, block, block_override, weight_kg, belt, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted')
             ON CONFLICT (event_id, fighter_id) DO UPDATE SET
               block = EXCLUDED.block, weight_kg = EXCLUDED.weight_kg, belt = EXCLUDED.belt,
               status = CASE WHEN shingi_entries.status IN ('paid', 'fought') THEN shingi_entries.status ELSE 'submitted' END,
               updated_at = now()
             RETURNING *`,
            [event.id, fighter[0].id, profileId, resolveBlock(age, override), override, f.weight_kg, f.belt],
          );
          entries.push(entry[0]);
        }
        return { profile_id: profileId, entries };
      });
      await logAction(actor(ctx), 'entries.manual', 'event', event.id, { profile_id: result.profile_id, count: result.entries.length });
      return new Reply(201, result);
    },
  },
  {
    method: 'PUT',
    path: 'admin/entries/:id',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const b = ctx.body || {};
      const sets: string[] = [];
      const values: unknown[] = [id];
      const set = (column: string, value: unknown) => {
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      };
      if (b.status !== undefined) {
        if (!(ENTRY_STATUSES as readonly string[]).includes(b.status)) throw new HttpError(400, 'Невідомий статус заявки');
        set('status', b.status);
      }
      if (b.weight_kg !== undefined) {
        const w = Number(b.weight_kg);
        if (!Number.isFinite(w) || w < 15 || w > 150) throw new HttpError(400, 'Вага поза межами 15–150 кг');
        set('weight_kg', Math.round(w * 10) / 10);
      }
      if (b.belt !== undefined) {
        if (!isBeltCode(b.belt)) throw new HttpError(400, 'Невідомий пояс');
        set('belt', b.belt);
      }
      if (b.block !== undefined) {
        if (b.block !== 'kids' && b.block !== 'open') throw new HttpError(400, 'Блок: kids або open');
        set('block', b.block);
        set('block_override', true);
      }
      if (b.fights_count !== undefined) {
        const n = toInt(b.fights_count);
        if (n === null || n < 0 || n > 50) throw new HttpError(400, 'Кількість боїв: 0–50');
        set('fights_count', n);
      }
      if (b.group_key !== undefined) {
        const key = clean(b.group_key);
        if (key && !GROUP_KEY_RE.test(key)) throw new HttpError(400, 'Некоректний ключ групи');
        set('group_key', key);
        set('group_manual', Boolean(key));
      }
      if (sets.length === 0) throw new HttpError(400, 'Нічого оновлювати');
      const rows = await query(`UPDATE shingi_entries SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`, values);
      if (!rows[0]) throw new HttpError(404, 'Заявку не знайдено');
      await logAction(actor(ctx), 'entry.update', 'entry', id, Object.keys(b));
      return { entry: rows[0] };
    },
  },

  {
    // той самий парсер, що в тренера, але без прив'язки до профілю — для ручного додавання команди
    method: 'POST',
    path: 'admin/fighters/parse',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx, 'body');
      const text = typeof ctx.body?.text === 'string' ? ctx.body.text : '';
      if (text.length > 30000 || text.split('\n').length > 400) throw new HttpError(413, 'Забагато рядків — розбийте список на частини');
      return parseFighters(text, event.event_date);
    },
  },

  // --- групи ---
  {
    method: 'GET',
    path: 'admin/groups',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx);
      const opts = groupingOptions(ctx);
      const { entries, skipped } = await loadGroupEntries(event);
      const assignments = entries.map((e) => ({ entryId: e.id, group_key: e.group_key || groupKeyFor(e, opts), group_manual: Boolean(e.group_manual) }));
      const groups = serializeGroups(entries, buildGroups(entries, assignments));
      return { event_status: event.status, groups, skipped, unassigned: entries.filter((e) => !e.group_key).length };
    },
  },
  {
    method: 'POST',
    path: 'admin/groups/build',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx);
      const opts = groupingOptions(ctx);
      const resetManual = ctx.query.reset_manual === '1';
      const { entries, skipped } = await loadGroupEntries(event);
      const assignments = assignGroups(entries, opts, resetManual);
      if (assignments.length > 0) {
        await query(
          `UPDATE shingi_entries e SET group_key = x.group_key, group_manual = x.group_manual, updated_at = now()
           FROM json_to_recordset($2::json) AS x(id int, group_key text, group_manual boolean)
           WHERE e.id = x.id AND e.event_id = $1`,
          [event.id, JSON.stringify(assignments.map((a) => ({ id: a.entryId, group_key: a.group_key, group_manual: a.group_manual })))],
        );
      }
      // у відповіді групи вже з оновленими ключами
      const updated = entries.map((e) => ({ ...e, group_key: assignments.find((a) => a.entryId === e.id)!.group_key }));
      const groups = serializeGroups(updated, buildGroups(updated, assignments));
      await logAction(actor(ctx), 'groups.build', 'event', event.id, { entries: entries.length, groups: groups.length, resetManual });
      return {
        groups,
        skipped,
        stats: { entries: entries.length, groups: groups.length, singles: groups.filter((g) => g.single).length },
      };
    },
  },
  {
    method: 'POST',
    path: 'admin/groups/publish',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx);
      if (event.status !== 'registration' && event.status !== 'groups_published') {
        throw new HttpError(409, 'Групи можна публікувати, коли подія в статусі «реєстрація»', 'bad_status');
      }
      const [{ missing }] = await query<{ missing: number }>(
        `SELECT COUNT(*)::int AS missing FROM shingi_entries WHERE event_id = $1 AND status = ANY($2::text[]) AND group_key IS NULL`,
        [event.id, [...GROUPABLE_ENTRY_STATUSES]],
      );
      if (missing > 0) throw new HttpError(409, `У ${missing} заявок немає групи — спершу натисніть «Сформувати групи»`, 'groups_missing');
      await query(`UPDATE shingi_events SET status = 'groups_published' WHERE id = $1`, [event.id]);
      // сповіщення тренерам ботом — етап 4
      await logAction(actor(ctx), 'groups.publish', 'event', event.id);
      return { ok: true, status: 'groups_published' };
    },
  },

  // --- оплати, статистика, експорт ---
  {
    method: 'GET',
    path: 'admin/payments',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx);
      const payments = await query(
        `SELECT pay.id, pay.reference, pay.amount_uah, pay.status, pay.entries_ids, pay.created_at, pay.paid_at,
                p.club, p.coach_full_name
         FROM shingi_payments pay JOIN shingi_profiles p ON p.id = pay.profile_id
         WHERE pay.event_id = $1 ORDER BY pay.created_at DESC`,
        [event.id],
      );
      return { payments };
    },
  },
  {
    method: 'GET',
    path: 'admin/stats',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx);
      const rows = await query(
        `SELECT e.block, e.belt, e.status, p.federation, lower(p.club) AS club
         FROM shingi_entries e JOIN shingi_profiles p ON p.id = e.profile_id
         WHERE e.event_id = $1 AND e.status IN ('submitted', 'paid', 'fought')`,
        [event.id],
      );
      const count = (keyOf: (row: any) => string) => {
        const out: Record<string, number> = {};
        for (const row of rows) {
          const key = keyOf(row);
          out[key] = (out[key] || 0) + 1;
        }
        return out;
      };
      const [money] = await query<{ paid_uah: number }>(
        `SELECT COALESCE(SUM(amount_uah) FILTER (WHERE status = 'success'), 0)::int AS paid_uah FROM shingi_payments WHERE event_id = $1`,
        [event.id],
      );
      const unpaid = rows.filter((r) => r.status === 'submitted').length;
      const history = await query(
        `SELECT ev.id AS event_id, ev.title, ev.event_date,
                COUNT(e.id) FILTER (WHERE e.status IN ('submitted', 'paid', 'fought', 'no_show'))::int AS fighters,
                COUNT(DISTINCT lower(p.club)) FILTER (WHERE e.status IN ('submitted', 'paid', 'fought', 'no_show'))::int AS clubs
         FROM shingi_events ev
         LEFT JOIN shingi_entries e ON e.event_id = ev.id
         LEFT JOIN shingi_profiles p ON p.id = e.profile_id
         GROUP BY ev.id ORDER BY ev.event_date DESC`,
      );
      return {
        event_id: event.id,
        clubs: new Set(rows.map((r) => r.club)).size,
        fighters: rows.length,
        by_block: count((r) => r.block),
        by_category: count((r) => (isBeltCode(r.belt) ? beltCategory(r.belt) : '?')),
        by_federation: count((r) => r.federation || '—'),
        money: { paid_uah: money?.paid_uah ?? 0, pending_uah: unpaid * event.fee_uah, fee_uah: event.fee_uah },
        events: history,
      };
    },
  },
  {
    method: 'GET',
    path: 'admin/export',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx);
      const format = ctx.query.format === 'csv' ? 'csv' : 'xlsx';
      const rows = await query(
        `SELECT e.id, e.status, e.block, e.weight_kg, e.belt, e.group_key,
                f.full_name, f.sex, f.birth_date, f.age_years,
                p.club, p.coach_full_name, p.federation, p.city, p.phone
         FROM shingi_entries e
         JOIN shingi_fighters f ON f.id = e.fighter_id
         JOIN shingi_profiles p ON p.id = e.profile_id
         WHERE e.event_id = $1 AND e.status NOT IN ('draft', 'withdrawn')
         ORDER BY p.club, f.full_name`,
        [event.id],
      );
      const header = ['№', 'Клуб', 'Тренер', 'Федерація', 'Місто', 'Телефон', 'Боєць', 'Стать', 'Вік', 'Вага, кг', 'Пояс', 'Кат.', 'Блок', 'Статус', 'Група'];
      const table = rows.map((r, i) => [
        i + 1, r.club, r.coach_full_name, r.federation, r.city, r.phone, r.full_name,
        r.sex === 'm' ? 'ч' : 'ж', resolveAge(r, event.event_date), r.weight_kg,
        isBeltCode(r.belt) ? BELT_LABELS[r.belt] : r.belt, isBeltCode(r.belt) ? beltCategory(r.belt) : '',
        r.block === 'kids' ? 'Kids' : 'Open', r.status, r.group_key,
      ]);
      const filename = `shingi-${event.slug}-${event.event_date}`;

      if (format === 'csv') {
        // на початку рядка невидимий BOM (U+FEFF), щоб Excel розпізнав UTF-8
        const body = '﻿' + [csvLine(header), ...table.map(csvLine)].join('\r\n');
        return new RawReply(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}.csv"` }, body);
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Заявки');
      sheet.addRow(header).font = { bold: true };
      table.forEach((row) => sheet.addRow(row.map(safeCell)));
      sheet.columns.forEach((column) => { column.width = 16; });

      const grouped = await loadGroupEntries(event);
      const assignments = grouped.entries.map((e) => ({ entryId: e.id, group_key: e.group_key || groupKeyFor(e), group_manual: Boolean(e.group_manual) }));
      const groupsSheet = workbook.addWorksheet('Групи');
      groupsSheet.addRow(['Група', 'Боєць', 'Клуб', 'Тренер', 'Вік', 'Вага, кг', 'Пояс']).font = { bold: true };
      for (const g of serializeGroups(grouped.entries, buildGroups(grouped.entries, assignments))) {
        for (const m of g.members) {
          groupsSheet.addRow([g.key, safeCell(m.full_name), safeCell(m.club), safeCell(m.coach), m.age, m.weight_kg, BELT_LABELS[m.belt]]);
        }
      }
      groupsSheet.columns.forEach((column) => { column.width = 18; });

      const payments = await query(
        `SELECT pay.reference, pay.amount_uah, pay.status, pay.created_at, pay.paid_at, p.club
         FROM shingi_payments pay JOIN shingi_profiles p ON p.id = pay.profile_id WHERE pay.event_id = $1 ORDER BY pay.created_at`,
        [event.id],
      );
      const paySheet = workbook.addWorksheet('Оплати');
      paySheet.addRow(['Клуб', 'Сума, грн', 'Статус', 'Створено', 'Оплачено', 'Референс']).font = { bold: true };
      payments.forEach((p) => paySheet.addRow([safeCell(p.club), p.amount_uah, p.status, p.created_at, p.paid_at, p.reference]));
      paySheet.columns.forEach((column) => { column.width = 20; });

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      return new RawReply(
        200,
        {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
        buffer,
      );
    },
  },

  // --- наступні етапи ---
  { method: 'GET', path: 'admin/certificates', auth: 'admin', handler: notReady(5, 'Грамоти PDF') },
  { method: 'POST', path: 'admin/broadcast', auth: 'admin', handler: notReady(4, 'Розсилки') },
  { method: 'GET', path: 'admin/questions', auth: 'admin', handler: notReady(4, 'Питання тренерів') },
  { method: 'POST', path: 'admin/questions/:id/answer', auth: 'admin', handler: notReady(4, 'Відповіді на питання') },
  { method: 'GET', path: 'admin/bot/setup', auth: 'admin', handler: notReady(4, 'Налаштування бота') },
];
