import { logAction, query } from './db.js';
import { feeInfo } from './fee.js';
import { dueReminders, questionTag, reminderText } from './reminders.js';
import { getCurrentEvent, type EventRow } from './store.js';
import { escapeHtml, sendMessage } from './telegram-client.js';

/* ───────────── отримувачі ───────────── */

export const AUDIENCES = ['event', 'unpaid', 'paid', 'all'] as const;
export type Audience = (typeof AUDIENCES)[number];
export const isAudience = (value: unknown): value is Audience => (AUDIENCES as readonly string[]).includes(String(value));

export type Recipient = { profile_id: number; tg_id: number | string; club: string | null; unpaid: number; fighters: number };

const HAVING: Record<Audience, string> = {
  all: 'TRUE',
  event: `COUNT(e.id) FILTER (WHERE e.status IN ('submitted', 'paid', 'fought')) > 0`,
  unpaid: `COUNT(e.id) FILTER (WHERE e.status = 'submitted') > 0`,
  paid: `COUNT(e.id) FILTER (WHERE e.status = 'paid') > 0`,
};

/** Хто отримає розсилку: профілі з Telegram, відфільтровані за станом заявок на подію. */
export const recipientsFor = (eventId: number, audience: Audience) =>
  query<Recipient>(
    `SELECT p.id AS profile_id, p.tg_id, p.club,
            COUNT(e.id) FILTER (WHERE e.status = 'submitted')::int AS unpaid,
            COUNT(e.id) FILTER (WHERE e.status IN ('submitted', 'paid', 'fought'))::int AS fighters
     FROM shingi_profiles p
     LEFT JOIN shingi_entries e ON e.profile_id = p.id AND e.event_id = $1
     WHERE p.tg_id IS NOT NULL
     GROUP BY p.id
     HAVING ${HAVING[audience]}
     ORDER BY p.id
     LIMIT 500`,
    [eventId],
  );

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Надсилає пачками по 10 із паузою — вкладаємось у ліміт Telegram (~30 повідомлень на секунду). */
export async function deliver(list: Recipient[], textFor: (recipient: Recipient) => string): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < list.length; i += 10) {
    const batch = list.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map((r) => sendMessage(r.tg_id, textFor(r))));
    for (const result of results) {
      if (result.status === 'fulfilled') sent += 1;
      else failed += 1;
    }
    if (i + 10 < list.length) await sleep(400);
  }
  return { sent, failed };
}

const recordBroadcast = async (event: EventRow, audience: string, text: string, urgent: boolean, sent: number, failed: number, actor: string) => {
  const [row] = await query<{ id: number }>(
    `INSERT INTO shingi_broadcasts (event_id, audience, text, urgent, sent_count, failed_count, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [event.id, audience, text, urgent, sent, failed, actor],
  );
  return row.id;
};

/** Розсилка від адміна: однаковий текст усій аудиторії. Текст екранується, переноси рядків зберігаються. */
export async function sendBroadcast(opts: { event: EventRow; audience: Audience; text: string; urgent: boolean; actor: string }) {
  const list = await recipientsFor(opts.event.id, opts.audience);
  const body = escapeHtml(opts.text);
  const text = opts.urgent ? `❗ ${body}` : body;
  const { sent, failed } = await deliver(list, () => text);
  const id = await recordBroadcast(opts.event, opts.audience, opts.text, opts.urgent, sent, failed, opts.actor);
  await logAction(opts.actor, 'broadcast.send', 'broadcast', id, { audience: opts.audience, recipients: list.length, sent, failed });
  return { id, recipients: list.length, sent, failed };
}

/* ───────────── сповіщення про групи ───────────── */

export async function notifyGroupsPublished(event: EventRow, actor: string) {
  const list = await recipientsFor(event.id, 'event');
  const text = `Групи SHIN GI опубліковано. Подивіться, у якій групі ваші бійці, у кабінеті.`;
  const { sent, failed } = await deliver(list, () => text);
  await recordBroadcast(event, 'auto:groups', text, false, sent, failed, actor);
  return { recipients: list.length, sent, failed };
}

/* ───────────── автонагадування ───────────── */

export type ReminderRun = { key: string; recipients: number; sent: number; failed: number; skipped?: 'already_sent' };

/**
 * Нагадування за дедлайнами для активної події. Кожне нагадування (ключ `apps:d3`, `pay:d1` …) надсилається по події один раз.
 * `dryRun` лише показує, що було б надіслано.
 */
export async function runReminders(opts: { today: string; actor: string; dryRun: boolean; event?: EventRow | null }) {
  const event = opts.event ?? (await getCurrentEvent());
  if (!event) return { event_id: null as number | null, due: [] as ReminderRun[] };
  const info = feeInfo(event);
  const due = dueReminders(event, opts.today);
  const runs: ReminderRun[] = [];

  for (const reminder of due) {
    const marker = `auto:${reminder.key}`;
    const [done] = await query(`SELECT id FROM shingi_broadcasts WHERE event_id = $1 AND audience = $2 LIMIT 1`, [event.id, marker]);
    const audience: Audience = reminder.kind === 'pay' ? 'unpaid' : 'all';
    const list = await recipientsFor(event.id, audience);
    if (done) {
      runs.push({ key: reminder.key, recipients: list.length, sent: 0, failed: 0, skipped: 'already_sent' });
      continue;
    }
    if (opts.dryRun) {
      runs.push({ key: reminder.key, recipients: list.length, sent: 0, failed: 0 });
      continue;
    }
    const { sent, failed } = await deliver(list, (r) =>
      escapeHtml(reminderText(reminder, { unpaid: r.unpaid, feeUah: event.fee_uah, noun: info.noun })),
    );
    await recordBroadcast(event, marker, reminderText(reminder, { unpaid: 0, feeUah: event.fee_uah, noun: info.noun }), false, sent, failed, opts.actor);
    runs.push({ key: reminder.key, recipients: list.length, sent, failed });
  }
  return { event_id: event.id, due: runs };
}

/* ───────────── питання тренерів ───────────── */

export const staffTgIds = () =>
  (process.env.SHINGI_ADMIN_TG_IDS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/** Пересилає питання штабу. Організатор відповідає реплаєм на повідомлення — бот знаходить питання за міткою #Q. */
export async function forwardQuestion(
  questionId: number,
  profile: { club?: string | null; coach_full_name?: string | null; tg_username?: string | null },
  text: string,
): Promise<number> {
  const ids = staffTgIds();
  if (ids.length === 0) return 0;
  const who = [profile.club, profile.coach_full_name].filter(Boolean).map(escapeHtml).join(' · ') || 'тренер';
  const body =
    `❓ <b>Питання ${questionTag(questionId)}</b>\n${who}${profile.tg_username ? ` · @${escapeHtml(profile.tg_username)}` : ''}\n\n${escapeHtml(text)}\n\n` +
    `<i>Дайте відповідь реплаєм на це повідомлення — бот передасть її тренеру. Або відповідайте в адмінці, вкладка «Питання».</i>`;
  const results = await Promise.allSettled(ids.map((id) => sendMessage(id, body)));
  return results.filter((r) => r.status === 'fulfilled').length;
}

export type AnswerResult = { ok: true } | { ok: false; reason: 'not_found' | 'no_telegram' | 'send_failed' };

/** Відповідь організатора на питання: надсилає тренеру в Telegram, зберігає в історії й позначає питання відповідженим. */
export async function answerQuestion(questionId: number, text: string, actor: string): Promise<AnswerResult> {
  const [question] = await query<{ id: number; profile_id: number; tg_id: number | string | null }>(
    `SELECT m.id, m.profile_id, p.tg_id FROM shingi_messages m JOIN shingi_profiles p ON p.id = m.profile_id
     WHERE m.id = $1 AND m.direction = 'in'`,
    [questionId],
  );
  if (!question) return { ok: false, reason: 'not_found' };
  if (!question.tg_id) return { ok: false, reason: 'no_telegram' };
  try {
    await sendMessage(question.tg_id, `💬 <b>Відповідь організаторів</b>\n\n${escapeHtml(text)}`);
  } catch (error) {
    console.error('shingi answer failed:', (error as Error).message);
    return { ok: false, reason: 'send_failed' };
  }
  await query(`INSERT INTO shingi_messages (profile_id, direction, text) VALUES ($1, 'out', $2)`, [question.profile_id, text]);
  await query(`UPDATE shingi_messages SET answered = true WHERE id = $1`, [questionId]);
  await logAction(actor, 'question.answer', 'message', questionId);
  return { ok: true };
}

export async function isStaffTelegram(tgId: unknown): Promise<boolean> {
  if (tgId === undefined || tgId === null) return false;
  if (staffTgIds().includes(String(tgId))) return true;
  const rows = await query(`SELECT 1 FROM shingi_profiles WHERE tg_id = $1 AND is_admin = true LIMIT 1`, [tgId]);
  return rows.length > 0;
}
