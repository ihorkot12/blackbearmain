import { beltCategory, type BeltCode } from './belts.js';
import { resolveAge } from './grouping.js';
import { query } from './db.js';
import { feeInfo } from './fee.js';
import { daysBetween, kyivToday, type Profile } from './http.js';

export type EventRow = {
  id: number;
  slug: string;
  title: string;
  event_date: string;
  status: 'draft' | 'announced' | 'registration' | 'groups_published' | 'done' | 'cancelled';
  fee_uah: number;
  fee_kind: string;
  fee_label: string | null;
  limit_kids: number | null;
  limit_open: number | null;
  deadline_apps: string | null;
  deadline_pay: string | null;
  groups_publish_date: string | null;
  address: string | null;
  schedule_json: { kids?: string; open?: string } | null;
  notes: string | null;
};

/** Статуси заявки, що займають місце в ліміті блоку. */
export const ACTIVE_ENTRY_STATUSES = ['submitted', 'paid', 'fought'] as const;
/** Заявки, які потрапляють у групи. */
export const GROUPABLE_ENTRY_STATUSES = ['submitted', 'paid', 'fought'] as const;

export async function getEventById(id: number): Promise<EventRow | null> {
  const rows = await query<EventRow>('SELECT * FROM shingi_events WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getCurrentEvent(): Promise<EventRow | null> {
  const rows = await query<EventRow>(
    `SELECT * FROM shingi_events
     WHERE status IN ('announced', 'registration', 'groups_published')
     ORDER BY event_date ASC LIMIT 1`,
  );
  return rows[0] || null;
}

export async function getLatestEvent(): Promise<EventRow | null> {
  const rows = await query<EventRow>(
    `SELECT * FROM shingi_events WHERE status <> 'cancelled' ORDER BY event_date DESC LIMIT 1`,
  );
  return rows[0] || null;
}

/** Подія за `event_id` із запиту; без нього — активна, інакше остання. */
export async function resolveEvent(eventId: unknown): Promise<EventRow | null> {
  const id = Number(eventId);
  if (Number.isInteger(id) && id > 0) return getEventById(id);
  return (await getCurrentEvent()) || (await getLatestEvent());
}

/** Подія для публічного API: без нотаток адмінів, з готовими текстами внеску (`fee_info`) для сайту, бота й оферти. */
export const publicEvent = (event: EventRow) => {
  const { notes: _notes, ...rest } = event;
  return { ...rest, fee_info: feeInfo(event) };
};

export async function eventCounters(event: EventRow) {
  const [row] = await query<{ clubs: number; kids_count: number; open_count: number }>(
    `SELECT COUNT(DISTINCT lower(p.club))::int AS clubs,
            COUNT(*) FILTER (WHERE e.block = 'kids')::int AS kids_count,
            COUNT(*) FILTER (WHERE e.block = 'open')::int AS open_count
     FROM shingi_entries e
     JOIN shingi_profiles p ON p.id = e.profile_id
     WHERE e.event_id = $1 AND e.status IN ('submitted', 'paid', 'fought')`,
    [event.id],
  );
  const today = kyivToday();
  const until = (date: string | null) => (date ? daysBetween(today, date) : null);
  const free = (limit: number | null, used: number) => (limit === null ? null : Math.max(0, limit - used));
  return {
    clubs: row?.clubs ?? 0,
    fighters: {
      kids: row?.kids_count ?? 0,
      open: row?.open_count ?? 0,
      total: (row?.kids_count ?? 0) + (row?.open_count ?? 0),
    },
    free: { kids: free(event.limit_kids, row?.kids_count ?? 0), open: free(event.limit_open, row?.open_count ?? 0) },
    days_to: {
      event: until(event.event_date),
      apps: until(event.deadline_apps),
      pay: until(event.deadline_pay),
      groups: until(event.groups_publish_date),
    },
  };
}

const adminTgIds = () =>
  (process.env.SHINGI_ADMIN_TG_IDS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export const isTelegramAdmin = (profile: Pick<Profile, 'tg_id' | 'is_admin'> | null) =>
  Boolean(profile && (profile.is_admin || (profile.tg_id !== null && adminTgIds().includes(String(profile.tg_id)))));

export const profileView = (p: Profile) => ({
  id: p.id,
  tg_username: p.tg_username,
  tg_first_name: p.tg_first_name,
  tg_photo_url: p.tg_photo_url,
  role: p.role,
  federation: p.federation,
  club: p.club,
  city: p.city,
  coach_full_name: p.coach_full_name,
  phone: p.phone,
  is_admin: isTelegramAdmin(p),
  complete: Boolean(p.role && p.club && p.coach_full_name),
});

export async function getProfileById(id: number): Promise<Profile | null> {
  const rows = await query<Profile>('SELECT * FROM shingi_profiles WHERE id = $1', [id]);
  return rows[0] || null;
}

/** Рядок заявки з даними бійця; вік — на дату події. */
export function decorateEntry<T extends { birth_date: string | null; age_years: number | null; belt: string | null }>(
  row: T,
  eventDate: string,
) {
  return {
    ...row,
    age: resolveAge(row, eventDate),
    belt_cat: row.belt ? beltCategory(row.belt as BeltCode) : null,
  };
}
