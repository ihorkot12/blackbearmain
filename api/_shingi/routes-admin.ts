import ExcelJS from 'exceljs';
import { randomBytes } from 'crypto';
import { isFeeKind } from './fee.js';
import { answerQuestion, isAudience, notifyGroupsPublished, recipientsFor, runReminders, sendBroadcast } from './notify.js';
import { emptyRevenue, summarizeRevenue, type PaidRow, type PendingRow } from './payments.js';
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
  kyivToday,
  normalizePhone,
  toInt,
  validateFighter,
  type Ctx,
  type Route,
} from './http.js';
import { publicBaseUrl, webhookSecret } from './bot.js';
import { getBotToken, tgCall } from './telegram-client.js';
import { parseFighters } from './parser.js';
import { GROUPABLE_ENTRY_STATUSES, getEventById, eventCounters, type EventRow } from './store.js';

const actor = (ctx: Ctx) => ctx.admin || 'admin';

/** Успішний платіж, що покриває заявку (гроші по ній уже в обліку). */
const coveringPayment = async (entryId: number) =>
  (await query<{ id: number }>(`SELECT id FROM shingi_payments WHERE status = 'success' AND $1 = ANY(entries_ids) LIMIT 1`, [entryId]))[0] ?? null;

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
          `INSERT INTO shingi_events (slug, title, event_date, status, fee_uah, fee_kind, fee_label, limit_kids, limit_open, deadline_apps, deadline_pay, groups_publish_date, address, schedule_json, notes)
           VALUES ($1, $2, $3, $4, $5, $14, $15, $6, $7, $8, $9, $10, COALESCE($11, 'Київ, вул. Сім''ї Бродських, 31/33, зал Black Bear Dojo'), COALESCE($12::jsonb, '{"kids":"10:00","open":"13:00"}'::jsonb), $13)
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
            isFeeKind(b.fee_kind) ? b.fee_kind : 'fee',
            capped(b.fee_label, 80) || null,
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
      if (b.fee_uah !== undefined) {
        const fee = optionalInt(b.fee_uah, 'Внесок', 0);
        if (fee === null) throw new HttpError(400, 'Вкажіть внесок у гривнях (0 — безкоштовно)');
        set('fee_uah', fee);
      }
      if (b.fee_kind !== undefined) {
        if (!isFeeKind(b.fee_kind)) throw new HttpError(400, 'Невідомий вид внеску');
        set('fee_kind', b.fee_kind);
      }
      if (b.fee_label !== undefined) set('fee_label', capped(b.fee_label, 80) || null);
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

  {
    // Видалення події разом із її заявками й платежами (каскад у БД). Захист: підтвердження slug у ?confirm_slug=
    // і заборона, якщо вже є успішні оплати — щоб не втратити облік грошей (такі події краще скасувати статусом).
    method: 'DELETE',
    path: 'admin/events/:id',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const event = await getEventById(id);
      if (!event) throw new HttpError(404, 'Подію не знайдено');
      if (String(ctx.query.confirm_slug || '') !== event.slug) {
        throw new HttpError(400, 'Для видалення підтвердьте slug події', 'confirm_required');
      }
      const [paid] = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM shingi_payments WHERE event_id = $1 AND status = 'success'`, [id]);
      if ((paid?.n ?? 0) > 0) {
        throw new HttpError(409, `У події є оплати (${paid.n}). Видаляти її не можна, щоб не втратити облік грошей. Поставте статус «Скасовано».`, 'has_payments');
      }
      const [counts] = await query<{ entries: number }>('SELECT COUNT(*)::int AS entries FROM shingi_entries WHERE event_id = $1', [id]);
      await query('DELETE FROM shingi_events WHERE id = $1', [id]);
      await logAction(actor(ctx), 'event.delete', 'event', id, { slug: event.slug, title: event.title, entries: counts?.entries ?? 0 });
      return { ok: true, deleted_entries: counts?.entries ?? 0 };
    },
  },

  // --- клуби й бійці: перегляд, пошук, редагування, видалення ---
  {
    method: 'GET',
    path: 'admin/clubs',
    auth: 'admin',
    handler: async (ctx) => {
      const eventId = toInt(ctx.query.event_id) ?? 0;
      const clubs = await query(
        `SELECT p.id, p.role, p.club, p.branch, p.coach_full_name, p.federation, p.city, p.phone, p.tg_id, p.tg_username, p.is_admin, p.created_at,
                (SELECT COUNT(*)::int FROM shingi_fighters f WHERE f.profile_id = p.id) AS fighters,
                (SELECT COUNT(*)::int FROM shingi_entries e WHERE e.profile_id = p.id AND e.event_id = $1 AND e.status IN ('submitted', 'paid', 'fought')) AS entries,
                (SELECT COUNT(*)::int FROM shingi_entries e WHERE e.profile_id = p.id AND e.event_id = $1 AND e.status = 'paid') AS paid_entries,
                COALESCE((SELECT SUM(COALESCE(pay.base_uah, pay.amount_uah)) FROM shingi_payments pay WHERE pay.profile_id = p.id AND pay.status = 'success'), 0)::int AS paid_uah
         FROM shingi_profiles p
         WHERE p.club IS NOT NULL OR p.coach_full_name IS NOT NULL
         ORDER BY lower(COALESCE(p.club, '')), p.id
         LIMIT 500`,
        [eventId],
      );
      return { clubs };
    },
  },
  {
    method: 'PUT',
    path: 'admin/clubs/:id',
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
      if (b.club !== undefined) {
        const club = capped(b.club, 120);
        if (!club) throw new HttpError(400, 'Назва клубу не може бути порожньою');
        set('club', club);
      }
      if (b.coach_full_name !== undefined) {
        const coach = capped(b.coach_full_name, 120);
        if (!coach) throw new HttpError(400, "Вкажіть прізвище та ім'я тренера");
        set('coach_full_name', coach);
      }
      if (b.role !== undefined) {
        if (b.role !== 'coach' && b.role !== 'solo') throw new HttpError(400, 'Роль: тренер або одиночний боєць');
        set('role', b.role);
      }
      if (b.federation !== undefined) set('federation', capped(b.federation, 80) || null);
      if (b.branch !== undefined) set('branch', capped(b.branch, 80) || null);
      if (b.city !== undefined) set('city', capped(b.city, 80) || 'Київ');
      if (b.phone !== undefined) set('phone', normalizePhone(b.phone));
      if (sets.length === 0) throw new HttpError(400, 'Нічого оновлювати');
      const rows = await query(`UPDATE shingi_profiles SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING id`, values);
      if (!rows[0]) throw new HttpError(404, 'Клуб не знайдено');
      await logAction(actor(ctx), 'club.update', 'profile', id, Object.keys(b));
      return { ok: true };
    },
  },
  {
    // Видалення клубу (профілю тренера) разом із його бійцями, заявками й платежами. Підтвердження — назва клубу в ?confirm_club=.
    // Заборона, якщо є успішні оплати (облік грошей) або це профіль адміна.
    method: 'DELETE',
    path: 'admin/clubs/:id',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const [profile] = await query<{ id: number; club: string | null; coach_full_name: string | null; is_admin: boolean }>(
        'SELECT id, club, coach_full_name, is_admin FROM shingi_profiles WHERE id = $1',
        [id],
      );
      if (!profile) throw new HttpError(404, 'Клуб не знайдено');
      if (profile.is_admin) throw new HttpError(409, 'Це профіль адміністратора, його видаляти не можна', 'is_admin');
      const expected = (profile.club || profile.coach_full_name || String(id)).trim().toLowerCase();
      if (String(ctx.query.confirm_club || '').trim().toLowerCase() !== expected) {
        throw new HttpError(400, 'Для видалення підтвердьте назву клубу', 'confirm_required');
      }
      const [paid] = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM shingi_payments WHERE profile_id = $1 AND status = 'success'`, [id]);
      if ((paid?.n ?? 0) > 0) {
        throw new HttpError(409, `У клубу є оплати (${paid.n}). Видаляти його не можна, щоб не втратити облік грошей. Скасуйте оплату у вкладці «Оплати» або залиште клуб.`, 'has_payments');
      }
      const [counts] = await query<{ fighters: number; entries: number }>(
        `SELECT (SELECT COUNT(*)::int FROM shingi_fighters WHERE profile_id = $1) AS fighters,
                (SELECT COUNT(*)::int FROM shingi_entries WHERE profile_id = $1) AS entries`,
        [id],
      );
      await query('DELETE FROM shingi_profiles WHERE id = $1', [id]);
      await logAction(actor(ctx), 'club.delete', 'profile', id, { club: profile.club, ...counts });
      return { ok: true, deleted_fighters: counts?.fighters ?? 0, deleted_entries: counts?.entries ?? 0 };
    },
  },
  {
    method: 'GET',
    path: 'admin/fighters',
    auth: 'admin',
    handler: async (ctx) => {
      const eventId = toInt(ctx.query.event_id) ?? 0;
      const fighters = await query(
        `SELECT f.id, f.profile_id, f.full_name, f.sex, f.birth_date, f.age_years, f.weight_kg, f.belt, f.guardian_name, f.guardian_phone, f.notes,
                p.club, p.branch, p.coach_full_name, p.federation, p.city,
                en.id AS entry_id, en.status AS entry_status, en.block, en.group_key
         FROM shingi_fighters f
         JOIN shingi_profiles p ON p.id = f.profile_id
         LEFT JOIN shingi_entries en ON en.fighter_id = f.id AND en.event_id = $1
         ORDER BY lower(COALESCE(p.club, '')), lower(f.full_name)
         LIMIT 3000`,
        [eventId],
      );
      return { fighters };
    },
  },
  {
    method: 'PUT',
    path: 'admin/fighters/:id',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const [current] = await query('SELECT * FROM shingi_fighters WHERE id = $1', [id]);
      if (!current) throw new HttpError(404, 'Бійця не знайдено');
      const f = validateFighter({ ...current, ...ctx.body });
      try {
        await query(
          `UPDATE shingi_fighters SET full_name = $2, sex = $3, birth_date = $4, age_years = $5, weight_kg = $6, belt = $7,
                  guardian_name = $8, guardian_phone = $9, notes = $10, updated_at = now()
           WHERE id = $1`,
          [id, f.full_name, f.sex, f.birth_date, f.age_years, f.weight_kg, f.belt, f.guardian_name, f.guardian_phone, f.notes],
        );
        // знімок ваги, поясу й блоку оновлюємо лише в неоплачених заявках, як і в кабінеті тренера
        const open = await query(
          `SELECT e.id, e.block_override, ev.event_date FROM shingi_entries e JOIN shingi_events ev ON ev.id = e.event_id
           WHERE e.fighter_id = $1 AND e.status IN ('draft', 'submitted')`,
          [id],
        );
        for (const entry of open) {
          const age = resolveAge(f, entry.event_date);
          await query(`UPDATE shingi_entries SET weight_kg = $2, belt = $3, block = $4, updated_at = now() WHERE id = $1`, [
            entry.id,
            f.weight_kg,
            f.belt,
            age === null ? 'kids' : resolveBlock(age, entry.block_override),
          ]);
        }
      } catch (error: any) {
        if (error?.code === '23505') throw new HttpError(409, 'Такий боєць уже є в цьому клубі', 'duplicate');
        throw error;
      }
      await logAction(actor(ctx), 'fighter.update', 'fighter', id);
      return { ok: true };
    },
  },
  {
    // Видалення бійця разом із його заявками. Якщо є оплачена заявка — спершу скасуйте оплату, інакше облік грошей розійдеться.
    method: 'DELETE',
    path: 'admin/fighters/:id',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const [fighter] = await query<{ id: number; full_name: string }>('SELECT id, full_name FROM shingi_fighters WHERE id = $1', [id]);
      if (!fighter) throw new HttpError(404, 'Бійця не знайдено');
      const [paid] = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM shingi_entries WHERE fighter_id = $1 AND status IN ('paid', 'fought')`, [id]);
      if ((paid?.n ?? 0) > 0) {
        throw new HttpError(409, 'У бійця є оплачена заявка. Спершу скасуйте оплату (вкладка «Оплати») або поставте статус «Знято» у заявках.', 'has_paid_entry');
      }
      await query('DELETE FROM shingi_fighters WHERE id = $1', [id]);
      await logAction(actor(ctx), 'fighter.delete', 'fighter', id, { full_name: fighter.full_name });
      return { ok: true };
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
      const [current] = await query<{ id: number; status: string; profile_id: number; event_id: number; fee_uah: number }>(
        `SELECT e.id, e.status, e.profile_id, e.event_id, ev.fee_uah FROM shingi_entries e JOIN shingi_events ev ON ev.id = e.event_id WHERE e.id = $1`,
        [id],
      );
      if (!current) throw new HttpError(404, 'Заявку не знайдено');
      let needCashPayment = false;
      if (b.status !== undefined) {
        if (!(ENTRY_STATUSES as readonly string[]).includes(b.status)) throw new HttpError(400, 'Невідомий статус заявки');
        if (b.status !== current.status) {
          const covered = await coveringPayment(id);
          // оплачену заявку не можна «розоплатити» зміною статусу — гроші вже в обліку; спершу скасовують оплату
          if (current.status === 'paid' && covered && ['submitted', 'draft', 'withdrawn'].includes(b.status)) {
            throw new HttpError(409, `Заявка оплачена (платіж №${covered.id}). Спершу скасуйте оплату у вкладці «Оплати».`, 'paid_entry');
          }
          // «Оплачено» вручну = готівка: створюємо платіж, щоб гроші потрапили в статистику
          if (b.status === 'paid' && !covered && current.fee_uah > 0) needCashPayment = true;
        }
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
      if (needCashPayment) {
        await query(
          `INSERT INTO shingi_payments (event_id, profile_id, reference, amount_uah, base_uah, fee_uah, entries_ids, provider, status, paid_at, note, marked_by)
           VALUES ($1, $2, $3, $4, $4, 0, ARRAY[$5]::int[], 'cash', 'success', now(), 'відмічено в заявках', $6)`,
          [current.event_id, current.profile_id, `cash-${current.event_id}-${randomBytes(4).toString('hex')}`, current.fee_uah, id, actor(ctx)],
        );
      }
      const rows = await query(`UPDATE shingi_entries SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`, values);
      if (!rows[0]) throw new HttpError(404, 'Заявку не знайдено');
      await logAction(actor(ctx), 'entry.update', 'entry', id, Object.keys(b));
      return { entry: rows[0], cash_payment_created: needCashPayment };
    },
  },
  {
    // Видалення заявки. Оплачену не видаляємо: спершу скасовують оплату, інакше облік грошей розійдеться.
    method: 'DELETE',
    path: 'admin/entries/:id',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const [entry] = await query<{ id: number; status: string; full_name: string }>(
        `SELECT e.id, e.status, f.full_name FROM shingi_entries e JOIN shingi_fighters f ON f.id = e.fighter_id WHERE e.id = $1`,
        [id],
      );
      if (!entry) throw new HttpError(404, 'Заявку не знайдено');
      if (['paid', 'fought'].includes(entry.status) || (await coveringPayment(id))) {
        throw new HttpError(409, 'Заявка оплачена або вже була на змаганнях. Спершу скасуйте оплату у вкладці «Оплати».', 'paid_entry');
      }
      await query('DELETE FROM shingi_entries WHERE id = $1', [id]);
      await logAction(actor(ctx), 'entry.delete', 'entry', id, { full_name: entry.full_name });
      return { ok: true };
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
      await logAction(actor(ctx), 'groups.publish', 'event', event.id);
      // тренерам з заявками ботом іде повідомлення, що групи опубліковано (помилка розсилки не скасовує публікацію)
      const notified = getBotToken() ? await notifyGroupsPublished(event, actor(ctx)).catch(() => null) : null;
      return { ok: true, status: 'groups_published', notified };
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
        `SELECT pay.id, pay.reference, pay.amount_uah, pay.base_uah, pay.fee_uah, pay.provider, pay.note, pay.marked_by,
                pay.offer_version, pay.offer_accepted_at,
                pay.status, pay.entries_ids, pay.created_at, pay.paid_at, p.club, p.coach_full_name,
                (SELECT string_agg(f.full_name, ', ' ORDER BY f.full_name)
                 FROM shingi_entries e JOIN shingi_fighters f ON f.id = e.fighter_id
                 WHERE e.id = ANY(pay.entries_ids)) AS fighters
         FROM shingi_payments pay JOIN shingi_profiles p ON p.id = pay.profile_id
         WHERE pay.event_id = $1 ORDER BY pay.created_at DESC`,
        [event.id],
      );
      return { payments };
    },
  },
  {
    // Готівка: адмін вручну відмічає, що бійці сплатили. Створюється платіж (по одному на клуб), заявки стають «Оплачено».
    method: 'POST',
    path: 'admin/payments/cash',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx, 'body');
      const rawIds: unknown[] = Array.isArray(ctx.body?.entry_ids) ? ctx.body.entry_ids : [];
      const ids = [...new Set(rawIds.map((v) => toInt(v)).filter((n): n is number => n !== null && n > 0))];
      if (ids.length === 0) throw new HttpError(400, 'Оберіть бійців, які сплатили');
      if (ids.length > 300) throw new HttpError(400, 'Забагато бійців за раз');
      const note = capped(ctx.body?.note, 300) || null;

      const created = await withTx(async (run) => {
        const rows = await run(
          `SELECT id, profile_id, status FROM shingi_entries WHERE id = ANY($1::int[]) AND event_id = $2 FOR UPDATE`,
          [ids, event.id],
        );
        if (rows.length !== ids.length) throw new HttpError(404, 'Частину заявок не знайдено в цій події');
        const notPayable = rows.filter((r) => r.status !== 'submitted');
        if (notPayable.length > 0) {
          throw new HttpError(409, `Відмітити готівку можна лише для статусу «Очікує оплати» (не підходять: ${notPayable.length})`, 'not_payable');
        }
        const byProfile = new Map<number, number[]>();
        for (const r of rows) byProfile.set(r.profile_id, [...(byProfile.get(r.profile_id) ?? []), r.id]);

        const payments: Array<{ id: number; reference: string; amount_uah: number; fighters: number }> = [];
        for (const [profileId, entryIds] of byProfile) {
          const amount = entryIds.length * event.fee_uah;
          const [pay] = await run(
            `INSERT INTO shingi_payments
               (event_id, profile_id, reference, amount_uah, base_uah, fee_uah, entries_ids, provider, status, paid_at, note, marked_by)
             VALUES ($1, $2, $3, $4, $4, 0, $5::int[], 'cash', 'success', now(), $6, $7)
             RETURNING id, reference, amount_uah`,
            [event.id, profileId, `cash-${event.id}-${randomBytes(4).toString('hex')}`, amount, entryIds, note, actor(ctx)],
          );
          await run(`UPDATE shingi_entries SET status = 'paid', updated_at = now() WHERE id = ANY($1::int[])`, [entryIds]);
          payments.push({ ...pay, fighters: entryIds.length });
        }
        return payments;
      });
      for (const p of created) await logAction(actor(ctx), 'payment.cash', 'payment', p.id, { fighters: p.fighters, amount_uah: p.amount_uah });
      return new Reply(201, { payments: created, paid_fighters: ids.length });
    },
  },
  {
    // Помилкову відмітку готівки можна скасувати: платіж стає «Повернуто», заявки знову «Очікує оплати».
    method: 'POST',
    path: 'admin/payments/:id/reverse',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const reason = capped(ctx.body?.reason, 300) || 'без причини';
      await withTx(async (run) => {
        const [pay] = await run('SELECT id, provider, status, entries_ids FROM shingi_payments WHERE id = $1 FOR UPDATE', [id]);
        if (!pay) throw new HttpError(404, 'Платіж не знайдено');
        if (pay.provider !== 'cash') {
          throw new HttpError(409, 'Скасувати можна лише готівковий платіж. Повернення за картку робиться в кабінеті Monobank.', 'not_cash');
        }
        if (pay.status !== 'success') throw new HttpError(409, 'Цей платіж уже скасовано', 'already_reversed');
        await run(`UPDATE shingi_payments SET status = 'reversed', note = trim(coalesce(note, '') || ' | скасовано: ' || $2) WHERE id = $1`, [id, reason]);
        await run(`UPDATE shingi_entries SET status = 'submitted', updated_at = now() WHERE id = ANY($1::int[]) AND status = 'paid'`, [pay.entries_ids]);
      });
      await logAction(actor(ctx), 'payment.cash_reverse', 'payment', id, { reason });
      return { ok: true };
    },
  },
  {
    // Редагування платежу. action:
    //  to_cash — неоплачений картковий рахунок (створено, прострочено, помилка) перетворюємо на готівкову оплату;
    //  edit    — змінити суму й примітку готівкового платежу;
    //  restore — повернути скасований готівковий платіж.
    // Картковий платіж, що вже сплачено через банк, не змінюємо: гроші прийшли через Monobank.
    method: 'PUT',
    path: 'admin/payments/:id',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const action = String(ctx.body?.action || '');
      const note = capped(ctx.body?.note, 300);
      if (!['to_cash', 'edit', 'restore'].includes(action)) throw new HttpError(400, 'Невідома дія з платежем');

      await withTx(async (run) => {
        const [pay] = await run(
          `SELECT p.id, p.provider, p.status, p.entries_ids, p.amount_uah, ev.fee_uah AS event_fee
           FROM shingi_payments p JOIN shingi_events ev ON ev.id = p.event_id WHERE p.id = $1 FOR UPDATE OF p`,
          [id],
        );
        if (!pay) throw new HttpError(404, 'Платіж не знайдено');

        if (action === 'to_cash') {
          if (pay.provider !== 'monobank') throw new HttpError(409, 'Це вже готівковий платіж', 'already_cash');
          if (pay.status === 'success') throw new HttpError(409, 'Картковий платіж уже сплачено через банк, спосіб змінювати не можна', 'card_paid');
          if (pay.status === 'processing') throw new HttpError(409, 'Банк ще обробляє платіж. Зачекайте або перевірте його в кабінеті Monobank.', 'processing');
          const open = await run(`SELECT id FROM shingi_entries WHERE id = ANY($1::int[]) AND status = 'submitted' FOR UPDATE`, [pay.entries_ids]);
          if (open.length === 0) throw new HttpError(409, 'У платежі немає бійців, що чекають на оплату', 'nothing_to_pay');
          const amount = open.length * pay.event_fee;
          await run(
            `UPDATE shingi_payments
             SET provider = 'cash', status = 'success', amount_uah = $2, base_uah = $2, fee_uah = 0, paid_at = now(), marked_by = $3,
                 note = trim(coalesce(note, '') || ' | замінено на готівку' || CASE WHEN $4::text IS NULL THEN '' ELSE ': ' || $4 END)
             WHERE id = $1`,
            [id, amount, actor(ctx), note],
          );
          await run(`UPDATE shingi_entries SET status = 'paid', updated_at = now() WHERE id = ANY($1::int[]) AND status = 'submitted'`, [pay.entries_ids]);
          return;
        }

        if (pay.provider !== 'cash') throw new HttpError(409, 'Редагувати можна лише готівкові платежі', 'not_cash');

        if (action === 'edit') {
          if (pay.status !== 'success') throw new HttpError(409, 'Редагувати можна лише чинний платіж', 'not_active');
          const amount = ctx.body?.amount_uah === undefined ? null : optionalInt(ctx.body.amount_uah, 'Сума', 0);
          if (amount === null && note === null && ctx.body?.note === undefined) throw new HttpError(400, 'Вкажіть суму або примітку');
          if (amount !== null && amount > 1_000_000) throw new HttpError(400, 'Сума завелика');
          await run(
            `UPDATE shingi_payments
             SET amount_uah = COALESCE($2, amount_uah), base_uah = COALESCE($2, base_uah), fee_uah = 0,
                 note = CASE WHEN $3::boolean THEN $4 ELSE note END, marked_by = $5
             WHERE id = $1`,
            [id, amount, ctx.body?.note !== undefined, note, actor(ctx)],
          );
          return;
        }

        // restore
        if (pay.status !== 'reversed') throw new HttpError(409, 'Відновити можна лише скасований платіж', 'not_reversed');
        await run(`UPDATE shingi_payments SET status = 'success', paid_at = now(), marked_by = $2 WHERE id = $1`, [id, actor(ctx)]);
        await run(`UPDATE shingi_entries SET status = 'paid', updated_at = now() WHERE id = ANY($1::int[]) AND status = 'submitted'`, [pay.entries_ids]);
      });
      await logAction(actor(ctx), `payment.${action}`, 'payment', id);
      return { ok: true };
    },
  },
  {
    // Прибрати зайвий запис: лише платежі без грошей (створено, помилка, прострочено, скасовано). Заявки не чіпаємо.
    method: 'DELETE',
    path: 'admin/payments/:id',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const [pay] = await query<{ id: number; status: string; provider: string }>('SELECT id, status, provider FROM shingi_payments WHERE id = $1', [id]);
      if (!pay) throw new HttpError(404, 'Платіж не знайдено');
      if (pay.status === 'success') throw new HttpError(409, 'Чинний платіж видаляти не можна: спершу скасуйте його', 'is_success');
      if (pay.status === 'processing') throw new HttpError(409, 'Банк ще обробляє платіж', 'processing');
      await query('DELETE FROM shingi_payments WHERE id = $1', [id]);
      await logAction(actor(ctx), 'payment.delete', 'payment', id, { status: pay.status, provider: pay.provider });
      return { ok: true };
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
      // Виручка по подіях, блоках (Kids/Open) і способах оплати. Внесок і комісію банку рахуємо окремо:
      // платіж розкладається порівну на бійців, яких оплачує.
      const paidRows = await query<PaidRow>(
        `SELECT pay.event_id, e.block, pay.provider AS method, COUNT(*)::int AS fighters,
                ROUND(SUM(COALESCE(pay.base_uah, pay.amount_uah)::numeric / cardinality(pay.entries_ids)))::int AS base_uah,
                ROUND(SUM(pay.fee_uah::numeric / cardinality(pay.entries_ids)))::int AS fee_uah
         FROM shingi_payments pay
         CROSS JOIN LATERAL unnest(pay.entries_ids) AS x(entry_id)
         JOIN shingi_entries e ON e.id = x.entry_id
         WHERE pay.status = 'success' AND cardinality(pay.entries_ids) > 0
         GROUP BY pay.event_id, e.block, pay.provider`,
      );
      const pendingRows = await query<PendingRow>(
        `SELECT event_id, block, COUNT(*)::int AS fighters FROM shingi_entries WHERE status = 'submitted' GROUP BY event_id, block`,
      );
      const feeRows = await query<{ id: number; fee_uah: number }>('SELECT id, fee_uah FROM shingi_events');
      const revenueByEvent = summarizeRevenue(paidRows, pendingRows, Object.fromEntries(feeRows.map((r) => [r.id, r.fee_uah])));
      const revenue = revenueByEvent.find((r) => r.event_id === event.id) ?? emptyRevenue(event.id);
      // «Оплачено» виставлено вручну в заявках, а платежу немає — гроші в обліку не видно
      const [unaccounted] = await query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM shingi_entries e
         WHERE e.event_id = $1 AND e.status IN ('paid', 'fought')
           AND NOT EXISTS (SELECT 1 FROM shingi_payments pay WHERE pay.status = 'success' AND e.id = ANY(pay.entries_ids))`,
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
        money: {
          paid_uah: revenue.total.paid_uah,
          fee_collected_uah: revenue.total.fee_uah,
          pending_uah: unpaid * event.fee_uah,
          fee_uah: event.fee_uah,
        },
        revenue,
        unaccounted_paid: unaccounted?.n ?? 0,
        events: history.map((h: any) => ({ ...h, revenue: revenueByEvent.find((r) => r.event_id === h.event_id) ?? emptyRevenue(h.event_id) })),
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
        `SELECT pay.reference, pay.provider, pay.amount_uah, pay.base_uah, pay.fee_uah, pay.status, pay.created_at, pay.paid_at, p.club
         FROM shingi_payments pay JOIN shingi_profiles p ON p.id = pay.profile_id WHERE pay.event_id = $1 ORDER BY pay.created_at`,
        [event.id],
      );
      const paySheet = workbook.addWorksheet('Оплати');
      paySheet.addRow(['Клуб', 'Спосіб', 'Внесок, грн', 'Комісія банку, грн', 'Сплачено, грн', 'Статус', 'Створено', 'Оплачено', 'Референс']).font = { bold: true };
      payments.forEach((p) =>
        paySheet.addRow([safeCell(p.club), p.provider === 'cash' ? 'готівка' : 'картка', p.base_uah ?? p.amount_uah, p.fee_uah ?? 0, p.amount_uah, p.status, p.created_at, p.paid_at, p.reference]),
      );
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

  // --- розсилки, питання тренерів, нагадування ---
  {
    method: 'GET',
    path: 'admin/broadcast/preview',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx);
      const audience = ctx.query.audience;
      if (!isAudience(audience)) throw new HttpError(400, 'Невідома аудиторія');
      const list = await recipientsFor(event.id, audience);
      return { audience, recipients: list.length };
    },
  },
  {
    method: 'POST',
    path: 'admin/broadcast',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx, 'body');
      const audience = ctx.body?.audience;
      if (!isAudience(audience)) throw new HttpError(400, 'Невідома аудиторія');
      const text = capped(ctx.body?.text, 3000);
      if (!text) throw new HttpError(400, 'Напишіть текст розсилки');
      if (!getBotToken()) throw new HttpError(503, 'SHINGI_BOT_TOKEN не задано для цього середовища', 'bot_not_configured');
      const result = await sendBroadcast({ event, audience, text, urgent: ctx.body?.urgent === true, actor: actor(ctx) });
      return new Reply(201, result);
    },
  },
  {
    method: 'GET',
    path: 'admin/broadcasts',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx);
      const broadcasts = await query(
        `SELECT id, audience, text, urgent, sent_count, failed_count, created_by, created_at
         FROM shingi_broadcasts WHERE event_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [event.id],
      );
      return { broadcasts };
    },
  },
  {
    method: 'GET',
    path: 'admin/questions',
    auth: 'admin',
    handler: async () => {
      const messages = await query(
        `SELECT m.id, m.profile_id, m.direction, m.text, m.answered, m.created_at,
                p.club, p.coach_full_name, p.tg_username
         FROM shingi_messages m JOIN shingi_profiles p ON p.id = m.profile_id
         ORDER BY m.created_at DESC, m.id DESC LIMIT 300`,
      );
      return { messages };
    },
  },
  {
    method: 'POST',
    path: 'admin/questions/:id/answer',
    auth: 'admin',
    handler: async (ctx) => {
      const id = toInt(ctx.params.id);
      if (id === null) throw new HttpError(400, 'Некоректний id');
      const text = capped(ctx.body?.text, 2000);
      if (!text) throw new HttpError(400, 'Напишіть відповідь');
      if (!getBotToken()) throw new HttpError(503, 'SHINGI_BOT_TOKEN не задано для цього середовища', 'bot_not_configured');
      const result = await answerQuestion(id, text, actor(ctx));
      if (result.ok === false) {
        if (result.reason === 'not_found') throw new HttpError(404, 'Питання не знайдено');
        if (result.reason === 'no_telegram') throw new HttpError(409, 'Тренер не підключений до Telegram, відповісти ботом не можна', 'no_telegram');
        throw new HttpError(502, 'Telegram не прийняв повідомлення. Спробуйте ще раз', 'send_failed');
      }
      return { ok: true };
    },
  },
  {
    // «Нагадати зараз»: за замовчуванням лише показує, що буде надіслано (dry_run); справжня відправка — dry_run: false
    method: 'POST',
    path: 'admin/reminders/run',
    auth: 'admin',
    handler: async (ctx) => {
      const event = await eventFromQuery(ctx, 'body');
      const dryRun = ctx.body?.dry_run !== false;
      if (!dryRun && !getBotToken()) throw new HttpError(503, 'SHINGI_BOT_TOKEN не задано для цього середовища', 'bot_not_configured');
      return runReminders({ today: kyivToday(), actor: actor(ctx), dryRun, event });
    },
  },
  {
    // Для зовнішнього планувальника (cron): Authorization: Bearer <CRON_SECRET>. Без змінної CRON_SECRET вимкнено.
    method: 'GET',
    path: 'cron/reminders',
    auth: 'public',
    handler: async (ctx) => {
      const secret = (process.env.CRON_SECRET || '').trim();
      if (!secret) throw new HttpError(503, 'CRON_SECRET не задано', 'cron_not_configured');
      if (ctx.req.headers?.authorization !== `Bearer ${secret}`) throw new HttpError(401, 'Unauthorized');
      if (!getBotToken()) throw new HttpError(503, 'SHINGI_BOT_TOKEN не задано для цього середовища', 'bot_not_configured');
      return runReminders({ today: kyivToday(), actor: 'cron', dryRun: false });
    },
  },
  {
    // Одна кнопка в адмінці: вебхук, команда /start і кнопка меню «Кабінет» (Mini App).
    // `base` — домен, на якому працює кабінет (https). Запускати з головного домену, не з preview.
    method: 'POST',
    path: 'admin/bot/setup',
    auth: 'admin',
    handler: async (ctx) => {
      const token = getBotToken();
      if (!token) throw new HttpError(503, 'SHINGI_BOT_TOKEN не задано для цього середовища', 'bot_not_configured');
      let base = publicBaseUrl();
      if (ctx.body?.base) {
        try {
          const u = new URL(String(ctx.body.base));
          if (u.protocol !== 'https:') throw new Error('not https');
          base = u.origin;
        } catch {
          throw new HttpError(400, 'base має бути адресою https://…');
        }
      }
      await tgCall('setWebhook', {
        url: `${base}/api/shingi/bot/webhook`,
        secret_token: webhookSecret(token),
        allowed_updates: ['message'],
      });
      await tgCall('setMyCommands', { commands: [{ command: 'start', description: 'Відкрити кабінет SHIN GI' }] });
      await tgCall('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Кабінет', web_app: { url: `${base}/shin-gi/cabinet` } } });
      const info = await tgCall('getWebhookInfo');
      await logAction(actor(ctx), 'bot.setup', 'bot', null, { base });
      return { ok: true, base, webhook_url: info.url, pending_updates: info.pending_update_count, last_error: info.last_error_message || null };
    },
  },
];
