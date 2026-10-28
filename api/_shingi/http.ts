import { isBeltCode, type BeltCode } from './belts.js';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Відповідь зі своїм статусом (201, 501...). Звичайний return = 200. */
export class Reply {
  constructor(public status: number, public body: unknown) {}
}

/** Сира відповідь (файли). */
export class RawReply {
  constructor(public status: number, public headers: Record<string, string>, public body: Buffer | string) {}
}

export type Profile = {
  id: number;
  tg_id: string | number | null;
  tg_username: string | null;
  tg_first_name: string | null;
  tg_photo_url: string | null;
  role: 'coach' | 'solo' | null;
  federation: string | null;
  club: string | null;
  city: string | null;
  coach_full_name: string | null;
  phone: string | null;
  is_admin: boolean;
};

export type Ctx = {
  req: any;
  res: any;
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  profile: Profile | null;
  /** Хто виконує адмін-дію: `system`, `admin:<id>` або `tg:<id>`. */
  admin: string | null;
  setHeader: (name: string, value: string) => void;
};

export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  /** public — без входу; session — є сесія; member — профіль із роллю; admin — адміністратор. */
  auth: 'public' | 'session' | 'member' | 'admin';
  handler: (ctx: Ctx) => Promise<unknown>;
};

export const clean = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export const capped = (value: unknown, max: number): string | null => {
  const v = clean(value);
  return v ? v.slice(0, max) : null;
};

export const toInt = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  return Number.isInteger(n) ? n : null;
};

/** Поточна дата в Києві, YYYY-MM-DD. */
export const kyivToday = (now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(now);

export const addDays = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);

export const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

export async function readJsonBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export type FighterInput = {
  full_name: string;
  sex: 'm' | 'f';
  birth_date: string | null;
  age_years: number | null;
  weight_kg: number;
  belt: BeltCode;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
};

/** Перевіряє одного бійця з тіла запиту. Кидає HttpError 400 з людським повідомленням. */
export function validateFighter(raw: any, label = 'Боєць'): FighterInput {
  const fail = (message: string): never => {
    throw new HttpError(400, `${label}: ${message}`);
  };
  const fullName = capped(raw?.full_name, 120)?.replace(/\s+/g, ' ');
  if (!fullName || fullName.split(' ').length < 2) fail("вкажіть прізвище та ім'я");
  if (raw?.sex !== 'm' && raw?.sex !== 'f') fail('вкажіть стать (m або f)');

  const birthDate = raw?.birth_date ? raw.birth_date : null;
  if (birthDate !== null && !isIsoDate(birthDate)) fail('дата народження має бути у форматі РРРР-ММ-ДД');
  const ageYears = raw?.age_years === null || raw?.age_years === undefined || raw?.age_years === '' ? null : toInt(raw.age_years);
  if (birthDate === null && ageYears === null) fail('вкажіть вік або дату народження');
  if (ageYears !== null && (ageYears < 4 || ageYears > 60)) fail('вік поза межами 4–60 років');

  const weight = Number(raw?.weight_kg);
  if (!Number.isFinite(weight) || weight < 15 || weight > 150) fail('вага поза межами 15–150 кг');
  if (!isBeltCode(raw?.belt)) fail('невідомий пояс');

  return {
    full_name: fullName!,
    sex: raw.sex,
    birth_date: birthDate,
    age_years: birthDate ? null : ageYears,
    weight_kg: Math.round(weight * 10) / 10,
    belt: raw.belt,
    guardian_name: capped(raw?.guardian_name, 120),
    guardian_phone: capped(raw?.guardian_phone, 40),
    notes: capped(raw?.notes, 500),
  };
}

/** Телефон: лишаємо цифри, + та пробіли. */
export const normalizePhone = (value: unknown): string | null => {
  const v = capped(value, 40);
  return v ? v.replace(/[^\d+\s()-]/g, '') || null : null;
};
