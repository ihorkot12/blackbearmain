import {
  clearSessionCookie,
  sessionCookie,
  signSession,
  verifyLoginWidget,
  verifyWebAppInitData,
  type TelegramUser,
} from './auth.js';
import { beltCategory, type BeltCode } from './belts.js';
import { logAction, query, withTx } from './db.js';
import { resolveAge, resolveBlock, type Block } from './grouping.js';
import {
  HttpError,
  Reply,
  capped,
  kyivToday,
  normalizePhone,
  toInt,
  validateFighter,
  type Ctx,
  type Profile,
  type Route,
} from './http.js';
import { parseFighters } from './parser.js';
import {
  ACTIVE_ENTRY_STATUSES,
  decorateEntry,
  eventCounters,
  getEventById,
  isTelegramAdmin,
  profileView,
  publicEvent,
  resolveEvent,
} from './store.js';
import { originAllowed } from './admin-auth.js';
import { publicBaseUrl, secretMatches, startReply } from './bot.js';
import { getBotToken, sendMessage } from './telegram-client.js';

const isSecure = (ctx: Ctx) => !/^localhost(:\d+)?$/.test(String(ctx.req.headers?.host || ''));

async function loginTelegramUser(ctx: Ctx, user: TelegramUser) {
  const rows = await query<Profile>(
    `INSERT INTO shingi_profiles (tg_id, tg_username, tg_first_name, tg_photo_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tg_id) WHERE tg_id IS NOT NULL DO UPDATE SET
       tg_username = EXCLUDED.tg_username,
       tg_first_name = EXCLUDED.tg_first_name,
       tg_photo_url = COALESCE(EXCLUDED.tg_photo_url, shingi_profiles.tg_photo_url),
       updated_at = now()
     RETURNING *`,
    [user.id, user.username ?? null, user.first_name ?? null, user.photo_url ?? null],
  );
  const profile = rows[0];
  ctx.setHeader('Set-Cookie', sessionCookie(signSession(profile.id), isSecure(ctx)));
  return profile;
}

/** Вхід — теж мутація: без перевірки Origin можна залогінити жертву в чужий профіль (login CSRF). */
function requireOrigin(ctx: Ctx) {
  if (!originAllowed(ctx.req)) throw new HttpError(403, 'Запит з невідомого джерела', 'bad_origin');
}

function requireBotToken() {
  const token = getBotToken();
  if (!token) throw new HttpError(503, 'Вхід через Telegram ще не налаштований', 'bot_not_configured');
  return token;
}

const authFailure = (reason: string) =>
  new HttpError(401, reason === 'expired' ? 'Сесія Telegram застаріла — увійдіть ще раз' : 'Не вдалося підтвердити вхід через Telegram', reason);

const idParam = (ctx: Ctx, name = 'id') => {
  const id = toInt(ctx.params[name]);
  if (id === null || id <= 0) throw new HttpError(400, 'Некоректний id');
  return id;
};

function ensureDeadline(deadline: string | null, message: string) {
  if (deadline && kyivToday() > deadline) throw new HttpError(409, message, 'deadline_passed');
}

const FIGHTER_COLUMNS = `x.full_name, x.sex, x.birth_date, x.age_years, x.weight_kg, x.belt, x.guardian_name, x.guardian_phone, x.notes`;
const FIGHTER_RECORD = `full_name text, sex text, birth_date date, age_years int, weight_kg numeric, belt text, guardian_name text, guardian_phone text, notes text`;

export const publicRoutes: Route[] = [
  {
    method: 'GET',
    path: 'event/current',
    auth: 'public',
    handler: async () => {
      const event = await resolveEvent(null);
      if (!event || !['announced', 'registration', 'groups_published'].includes(event.status)) return { event: null };
      return { event: publicEvent(event), counters: await eventCounters(event) };
    },
  },

  // --- вхід ---
  {
    method: 'POST',
    path: 'auth/telegram',
    auth: 'public',
    handler: async (ctx) => {
      requireOrigin(ctx);
      const result = verifyLoginWidget(ctx.body, requireBotToken());
      if (result.ok === false) throw authFailure(result.reason);
      const profile = await loginTelegramUser(ctx, result.data);
      return { profile: profileView(profile) };
    },
  },
  {
    method: 'POST',
    path: 'auth/webapp',
    auth: 'public',
    handler: async (ctx) => {
      requireOrigin(ctx);
      const result = verifyWebAppInitData(String(ctx.body?.initData || ''), requireBotToken());
      if (result.ok === false) throw authFailure(result.reason);
      const profile = await loginTelegramUser(ctx, result.data);
      return { profile: profileView(profile) };
    },
  },
  {
    method: 'POST',
    path: 'auth/logout',
    auth: 'public',
    handler: async (ctx) => {
      ctx.setHeader('Set-Cookie', clearSessionCookie(isSecure(ctx)));
      return { ok: true };
    },
  },
  {
    method: 'GET',
    path: 'me',
    auth: 'public',
    handler: async (ctx) => {
      if (!ctx.profile) return { authenticated: false, profile: null, is_admin: false };
      return {
        authenticated: true,
        profile: profileView(ctx.profile),
        is_admin: isTelegramAdmin(ctx.profile),
        needs_profile: !(ctx.profile.role && ctx.profile.club && ctx.profile.coach_full_name),
      };
    },
  },

  // --- профіль ---
  {
    method: 'PUT',
    path: 'profile',
    auth: 'session',
    handler: async (ctx) => {
      const profile = ctx.profile!;
      const role = ctx.body?.role;
      if (role !== 'coach' && role !== 'solo') throw new HttpError(400, 'Оберіть роль: тренер або одиночний боєць');
      const club = capped(ctx.body?.club, 120);
      const coachName = capped(ctx.body?.coach_full_name, 120);
      if (!club) throw new HttpError(400, 'Вкажіть клуб');
      if (!coachName || coachName.split(/\s+/).length < 2) throw new HttpError(400, "Вкажіть прізвище та ім'я тренера");
      const rows = await query<Profile>(
        `UPDATE shingi_profiles
         SET role = $2, federation = $3, club = $4, city = $5, coach_full_name = $6, phone = $7, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [profile.id, role, capped(ctx.body?.federation, 80), club, capped(ctx.body?.city, 80) || 'Київ', coachName, normalizePhone(ctx.body?.phone)],
      );
      await logAction(`profile:${profile.id}`, 'profile.update', 'profile', profile.id, { role, club });
      return { profile: profileView(rows[0]) };
    },
  },

  // --- бійці ---
  {
    method: 'GET',
    path: 'fighters',
    auth: 'member',
    handler: async (ctx) => {
      const fighters = await query(
        `SELECT f.*,
                COALESCE((SELECT json_agg(json_build_object('event_id', e.event_id, 'status', e.status, 'block', e.block) ORDER BY e.event_id)
                          FROM shingi_entries e WHERE e.fighter_id = f.id), '[]'::json) AS history
         FROM shingi_fighters f WHERE f.profile_id = $1 ORDER BY f.full_name`,
        [ctx.profile!.id],
      );
      return { fighters };
    },
  },
  {
    method: 'POST',
    path: 'fighters/parse',
    auth: 'member',
    handler: async (ctx) => {
      const text = typeof ctx.body?.text === 'string' ? ctx.body.text : '';
      if (text.length > 30000 || text.split('\n').length > 400) throw new HttpError(413, 'Забагато рядків — розбийте список на частини');
      const event = await resolveEvent(ctx.body?.event_id);
      const result = parseFighters(text, event?.event_date || kyivToday());

      const existing = await query<{ id: number; n: string; birth_date: string | null }>(
        'SELECT id, lower(full_name) AS n, birth_date FROM shingi_fighters WHERE profile_id = $1',
        [ctx.profile!.id],
      );
      const parsed = result.parsed.map((fighter) => {
        const match = existing.find(
          (e) => e.n === fighter.full_name.toLowerCase() && (!e.birth_date || !fighter.birth_date || e.birth_date === fighter.birth_date),
        );
        return match
          ? { ...fighter, existing_id: match.id, warnings: [...fighter.warnings, 'вже є у вашому списку'] }
          : { ...fighter, existing_id: null };
      });
      return { parsed, errors: result.errors };
    },
  },
  {
    method: 'POST',
    path: 'fighters/bulk',
    auth: 'member',
    handler: async (ctx) => {
      const items = ctx.body?.fighters;
      if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Список бійців порожній');
      if (items.length > 300) throw new HttpError(413, 'Забагато бійців за раз (максимум 300)');
      const valid = items.map((item, i) => validateFighter(item, `Рядок ${i + 1}`));
      const created = await query<{ id: number; full_name: string }>(
        `INSERT INTO shingi_fighters (profile_id, full_name, sex, birth_date, age_years, weight_kg, belt, guardian_name, guardian_phone, notes)
         SELECT $1::int, ${FIGHTER_COLUMNS} FROM json_to_recordset($2::json) AS x(${FIGHTER_RECORD})
         ON CONFLICT (profile_id, lower(full_name), (COALESCE(birth_date, DATE '1900-01-01'))) DO NOTHING
         RETURNING id, full_name`,
        [ctx.profile!.id, JSON.stringify(valid)],
      );
      await logAction(`profile:${ctx.profile!.id}`, 'fighters.bulk', 'fighter', null, { created: created.length, total: valid.length });
      return new Reply(201, { created, skipped: valid.length - created.length });
    },
  },
  {
    method: 'POST',
    path: 'fighters',
    auth: 'member',
    handler: async (ctx) => {
      const f = validateFighter(ctx.body);
      const rows = await query(
        `INSERT INTO shingi_fighters (profile_id, full_name, sex, birth_date, age_years, weight_kg, belt, guardian_name, guardian_phone, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (profile_id, lower(full_name), (COALESCE(birth_date, DATE '1900-01-01'))) DO NOTHING
         RETURNING *`,
        [ctx.profile!.id, f.full_name, f.sex, f.birth_date, f.age_years, f.weight_kg, f.belt, f.guardian_name, f.guardian_phone, f.notes],
      );
      if (!rows[0]) throw new HttpError(409, 'Такий боєць уже є у вашому списку', 'duplicate');
      await logAction(`profile:${ctx.profile!.id}`, 'fighter.create', 'fighter', rows[0].id);
      return new Reply(201, { fighter: rows[0] });
    },
  },
  {
    method: 'PUT',
    path: 'fighters/:id',
    auth: 'member',
    handler: async (ctx) => {
      const id = idParam(ctx);
      const [current] = await query('SELECT * FROM shingi_fighters WHERE id = $1 AND profile_id = $2', [id, ctx.profile!.id]);
      if (!current) throw new HttpError(404, 'Бійця не знайдено');
      const f = validateFighter({ ...current, ...ctx.body });
      try {
        const rows = await query(
          `UPDATE shingi_fighters SET full_name = $3, sex = $4, birth_date = $5, age_years = $6, weight_kg = $7, belt = $8,
                  guardian_name = $9, guardian_phone = $10, notes = $11, updated_at = now()
           WHERE id = $1 AND profile_id = $2 RETURNING *`,
          [id, ctx.profile!.id, f.full_name, f.sex, f.birth_date, f.age_years, f.weight_kg, f.belt, f.guardian_name, f.guardian_phone, f.notes],
        );
        // знімок ваги й поясу оновлюємо лише в неоплачених заявках
        const open = await query(
          `SELECT e.id, e.block_override, ev.event_date FROM shingi_entries e JOIN shingi_events ev ON ev.id = e.event_id
           WHERE e.fighter_id = $1 AND e.status IN ('draft', 'submitted')`,
          [id],
        );
        for (const entry of open) {
          // вік або дата народження могли змінитись — блок перераховуємо на дату тієї події
          const age = resolveAge(f, entry.event_date);
          await query(
            `UPDATE shingi_entries SET weight_kg = $2, belt = $3, block = $4, updated_at = now() WHERE id = $1`,
            [entry.id, f.weight_kg, f.belt, age === null ? 'kids' : resolveBlock(age, entry.block_override)],
          );
        }
        await logAction(`profile:${ctx.profile!.id}`, 'fighter.update', 'fighter', id);
        return { fighter: rows[0] };
      } catch (error: any) {
        if (error?.code === '23505') throw new HttpError(409, 'Такий боєць уже є у вашому списку', 'duplicate');
        throw error;
      }
    },
  },
  {
    method: 'DELETE',
    path: 'fighters/:id',
    auth: 'member',
    handler: async (ctx) => {
      const id = idParam(ctx);
      const [fighter] = await query('SELECT id FROM shingi_fighters WHERE id = $1 AND profile_id = $2', [id, ctx.profile!.id]);
      if (!fighter) throw new HttpError(404, 'Бійця не знайдено');
      const [{ paid }] = await query<{ paid: number }>(
        `SELECT COUNT(*)::int AS paid FROM shingi_entries WHERE fighter_id = $1 AND status IN ('paid', 'fought')`,
        [id],
      );
      // оплачену заявку тренер не знімає ні тут, ні через entries/:id — лише організатор
      if (paid > 0) throw new HttpError(403, 'У бійця є оплачена заявка — його знімає лише організатор, напишіть нам', 'locked');
      await query('DELETE FROM shingi_fighters WHERE id = $1', [id]);
      await logAction(`profile:${ctx.profile!.id}`, 'fighter.delete', 'fighter', id);
      return { deleted: true };
    },
  },

  // --- заявки ---
  {
    method: 'POST',
    path: 'entries/repeat',
    auth: 'member',
    handler: async (ctx) => {
      const event = await getEventById(Number(ctx.body?.event_id));
      const fromId = toInt(ctx.body?.from_event_id);
      if (!event || fromId === null) throw new HttpError(400, 'Вкажіть event_id і from_event_id');
      const fighters = await query(
        `SELECT DISTINCT f.* FROM shingi_entries e JOIN shingi_fighters f ON f.id = e.fighter_id
         WHERE e.event_id = $1 AND e.profile_id = $2 AND e.status IN ('submitted', 'paid', 'fought')`,
        [fromId, ctx.profile!.id],
      );
      const rows = fighters
        .map((f) => ({ f, age: resolveAge(f, event.event_date) }))
        .filter((x) => x.age !== null)
        .map(({ f, age }) => ({ fighter_id: f.id, block: resolveBlock(age!), weight_kg: f.weight_kg, belt: f.belt }));
      if (rows.length === 0) return { created: 0 };
      const created = await query(
        `INSERT INTO shingi_entries (event_id, fighter_id, profile_id, block, weight_kg, belt, status)
         SELECT $1::int, x.fighter_id, $2::int, x.block, x.weight_kg, x.belt, 'draft'
         FROM json_to_recordset($3::json) AS x(fighter_id int, block text, weight_kg numeric, belt text)
         ON CONFLICT (event_id, fighter_id) DO NOTHING RETURNING id`,
        [event.id, ctx.profile!.id, JSON.stringify(rows)],
      );
      await logAction(`profile:${ctx.profile!.id}`, 'entries.repeat', 'event', event.id, { from: fromId, created: created.length });
      return new Reply(201, { created: created.length });
    },
  },
  {
    method: 'POST',
    path: 'entries',
    auth: 'member',
    handler: async (ctx) => {
      const eventId = toInt(ctx.body?.event_id);
      const ids: number[] = Array.isArray(ctx.body?.fighter_ids)
        ? [...new Set<number>(ctx.body.fighter_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))]
        : [];
      if (eventId === null || ids.length === 0) throw new HttpError(400, 'Вкажіть event_id і fighter_ids');
      if (ids.length > 300) throw new HttpError(413, 'Забагато бійців за раз (максимум 300)');
      const overrides = new Set<number>((Array.isArray(ctx.body?.block_override_ids) ? ctx.body.block_override_ids : []).map(Number));

      const event = await getEventById(eventId);
      if (!event) throw new HttpError(404, 'Подію не знайдено');
      if (event.status !== 'registration') throw new HttpError(409, 'Реєстрація на цю подію зараз не відкрита', 'registration_closed');
      ensureDeadline(event.deadline_apps, 'Дедлайн подачі заявок минув');

      const fighters = await query('SELECT * FROM shingi_fighters WHERE id = ANY($1::int[]) AND profile_id = $2', [ids, ctx.profile!.id]);
      if (fighters.length !== ids.length) throw new HttpError(404, 'Когось із бійців не знайдено у вашому списку');

      const planned = fighters.map((f) => {
        const age = resolveAge(f, event.event_date);
        if (age === null) throw new HttpError(400, `${f.full_name}: не вказано вік`);
        return { f, block: resolveBlock(age, overrides.has(f.id)) as Block, override: overrides.has(f.id) };
      });

      const entries = await withTx(async (run) => {
        await run('SELECT pg_advisory_xact_lock($1)', [event.id]);
        const active = await run(
          `SELECT block, fighter_id, status FROM shingi_entries WHERE event_id = $1 AND status = ANY($2::text[])`,
          [event.id, [...ACTIVE_ENTRY_STATUSES]],
        );
        const existing = new Map<number, { block: Block; status: string }>(active.map((r) => [r.fighter_id, r]));
        // оплачена/відіграна заявка не міняє блок; для решти блок міг змінитись (наприклад, прапорець open)
        for (const p of planned) {
          const current = existing.get(p.f.id);
          if (current && (current.status === 'paid' || current.status === 'fought')) p.block = current.block;
        }
        for (const block of ['kids', 'open'] as const) {
          const limit = block === 'kids' ? event.limit_kids : event.limit_open;
          if (limit === null) continue;
          const taken = active.filter((r) => r.block === block).length;
          const adding = planned.filter((p) => p.block === block && existing.get(p.f.id)?.block !== block).length;
          if (taken + adding > limit) {
            throw new HttpError(409, `У блоці ${block === 'kids' ? 'Kids' : 'Open'} залишилось ${Math.max(0, limit - taken)} місць`, 'limit_reached');
          }
        }
        const saved = [];
        for (const p of planned) {
          const rows = await run(
            `INSERT INTO shingi_entries (event_id, fighter_id, profile_id, block, block_override, weight_kg, belt, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted')
             ON CONFLICT (event_id, fighter_id) DO UPDATE SET
               block = CASE WHEN shingi_entries.status IN ('paid', 'fought') THEN shingi_entries.block ELSE EXCLUDED.block END,
               block_override = CASE WHEN shingi_entries.status IN ('paid', 'fought') THEN shingi_entries.block_override ELSE EXCLUDED.block_override END,
               weight_kg = CASE WHEN shingi_entries.status IN ('paid', 'fought') THEN shingi_entries.weight_kg ELSE EXCLUDED.weight_kg END,
               belt = CASE WHEN shingi_entries.status IN ('paid', 'fought') THEN shingi_entries.belt ELSE EXCLUDED.belt END,
               status = CASE WHEN shingi_entries.status IN ('paid', 'fought') THEN shingi_entries.status ELSE 'submitted' END,
               updated_at = now()
             RETURNING *`,
            [event.id, p.f.id, ctx.profile!.id, p.block, p.override, p.f.weight_kg, p.f.belt],
          );
          saved.push(rows[0]);
        }
        return saved;
      });

      await logAction(`profile:${ctx.profile!.id}`, 'entries.submit', 'event', event.id, { fighters: ids.length });
      const unpaid = entries.filter((e) => e.status === 'submitted').length;
      return new Reply(201, { entries, sum_due_uah: unpaid * event.fee_uah });
    },
  },
  {
    method: 'DELETE',
    path: 'entries/:id',
    auth: 'member',
    handler: async (ctx) => {
      const id = idParam(ctx);
      const [entry] = await query('SELECT * FROM shingi_entries WHERE id = $1 AND profile_id = $2', [id, ctx.profile!.id]);
      if (!entry) throw new HttpError(404, 'Заявку не знайдено');
      const event = await getEventById(entry.event_id);
      const locked = entry.status === 'paid' || entry.status === 'fought' || (event?.deadline_pay && kyivToday() > event.deadline_pay);
      if (locked) throw new HttpError(403, 'Після оплати або дедлайну внеску бійця знімає лише організатор — напишіть нам', 'locked');
      await query(`UPDATE shingi_entries SET status = 'withdrawn', updated_at = now() WHERE id = $1`, [id]);
      await logAction(`profile:${ctx.profile!.id}`, 'entry.withdraw', 'entry', id);
      return { ok: true };
    },
  },

  // --- кабінет ---
  {
    method: 'GET',
    path: 'cabinet',
    auth: 'member',
    handler: async (ctx) => {
      const profile = ctx.profile!;
      const event = await resolveEvent(ctx.query.event_id);
      if (!event) return { profile: profileView(profile), event: null };

      const rows = await query(
        `SELECT e.id, e.event_id, e.fighter_id, e.block, e.block_override, e.weight_kg, e.belt, e.status, e.group_key, e.fights_count,
                f.full_name, f.sex, f.birth_date, f.age_years
         FROM shingi_entries e JOIN shingi_fighters f ON f.id = e.fighter_id
         WHERE e.profile_id = $1 AND e.event_id = $2 ORDER BY f.full_name`,
        [profile.id, event.id],
      );
      const showGroups = event.status === 'groups_published' || event.status === 'done';
      const sizes = showGroups
        ? await query<{ group_key: string; size: number }>(
            `SELECT group_key, COUNT(*)::int AS size FROM shingi_entries
             WHERE event_id = $1 AND group_key IS NOT NULL AND status IN ('submitted', 'paid', 'fought') GROUP BY group_key`,
            [event.id],
          )
        : [];
      const sizeOf = new Map(sizes.map((s) => [s.group_key, s.size]));
      const entries = rows.map((row) => {
        const entry = decorateEntry(row, event.event_date);
        return showGroups ? { ...entry, group_size: row.group_key ? sizeOf.get(row.group_key) ?? 1 : null } : { ...entry, group_key: null };
      });

      const payments = await query(
        `SELECT id, reference, amount_uah, status, entries_ids, created_at, paid_at FROM shingi_payments
         WHERE profile_id = $1 AND event_id = $2 ORDER BY created_at DESC`,
        [profile.id, event.id],
      );
      const history = await query(
        `SELECT ev.id AS event_id, ev.title, ev.event_date, COUNT(*)::int AS fighters
         FROM shingi_entries e JOIN shingi_events ev ON ev.id = e.event_id
         WHERE e.profile_id = $1 AND e.status IN ('submitted', 'paid', 'fought', 'no_show') AND ev.id <> $2
         GROUP BY ev.id ORDER BY ev.event_date DESC`,
        [profile.id, event.id],
      );
      const [clubStats] = await query<{ fighters_total: number; repeat_fighters: number }>(
        `SELECT (SELECT COUNT(*)::int FROM shingi_fighters WHERE profile_id = $1) AS fighters_total,
                (SELECT COUNT(*)::int FROM (
                   SELECT fighter_id FROM shingi_entries
                   WHERE profile_id = $1 AND status IN ('submitted', 'paid', 'fought', 'no_show')
                   GROUP BY fighter_id HAVING COUNT(DISTINCT event_id) >= 2) t) AS repeat_fighters`,
        [profile.id],
      );

      const active = entries.filter((e) => ['submitted', 'paid', 'fought'].includes(e.status));
      const unpaid = active.filter((e) => e.status === 'submitted').length;
      const byCategory = { A: 0, B: 0, C: 0 };
      for (const e of active) byCategory[beltCategory(e.belt as BeltCode)] += 1;

      return {
        profile: profileView(profile),
        event: publicEvent(event),
        counters: await eventCounters(event),
        entries,
        payments,
        totals: {
          fighters: active.length,
          paid: active.length - unpaid,
          unpaid,
          sum_due_uah: unpaid * event.fee_uah,
          fee_uah: event.fee_uah,
        },
        payments_open: false,
        history,
        club_stats: { ...clubStats, by_category: byCategory },
      };
    },
  },

  // --- бот @shingii_bot: /start → кнопка «Відкрити кабінет» (Mini App, вхід без пароля й номера) ---
  {
    method: 'POST',
    path: 'bot/webhook',
    auth: 'public',
    handler: async (ctx) => {
      const token = getBotToken();
      if (!secretMatches(ctx.req.headers?.['x-telegram-bot-api-secret-token'], token)) throw new HttpError(401, 'Unauthorized');
      const message = ctx.body?.message;
      const chatId = message?.chat?.id;
      if (message?.chat?.type === 'private' && typeof message.text === 'string' && chatId) {
        const reply = startReply(message.text, publicBaseUrl());
        if (reply) {
          try {
            await sendMessage(chatId, reply.text, {
              reply_markup: { inline_keyboard: [[{ text: reply.buttonText, web_app: { url: reply.url } }]] },
            });
          } catch (error) {
            // відповідаємо Telegram 200 у будь-якому разі, щоб він не повторював оновлення
            console.error('shingi bot reply failed:', (error as Error).message);
          }
        }
      }
      return { ok: true };
    },
  },

  // --- оплата (етап 5) і питання ---
  {
    method: 'POST',
    path: 'pay/invoice',
    auth: 'member',
    handler: async () => {
      throw new HttpError(501, 'Оплата відкриється з анонсом дати', 'payments_not_ready');
    },
  },
  {
    method: 'POST',
    path: 'question',
    auth: 'member',
    handler: async (ctx) => {
      const text = capped(ctx.body?.text, 2000);
      if (!text) throw new HttpError(400, 'Напишіть питання');
      const rows = await query(
        `INSERT INTO shingi_messages (profile_id, direction, text) VALUES ($1, 'in', $2) RETURNING id`,
        [ctx.profile!.id, text],
      );
      // пересилання в штабний чат — етап 4
      return new Reply(201, { ok: true, id: rows[0].id });
    },
  },
];
