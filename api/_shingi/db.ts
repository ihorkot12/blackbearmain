import pkg from 'pg';
import { BELT_CODES } from './belts.js';

const { Pool, types } = pkg;

// DATE лишаємо рядком YYYY-MM-DD (без зсуву часових поясів), NUMERIC — числом.
// Лише для нашого пулу: api/index.ts живе в тому самому бандлі, глобальний setTypeParser
// змінив би розбір DATE/NUMERIC в усіх його запитах.
const shingiTypes = {
  getTypeParser: (oid: number, format?: any) => {
    if (oid === 1082) return (value: string) => value;
    if (oid === 1700) return (value: string) => parseFloat(value);
    return types.getTypeParser(oid, format);
  },
};

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      // без таймаутів запит, що чекає з'єднання чи лок, висить вічно; з ними — падає з помилкою за секунди
      connectionTimeoutMillis: 10_000,
      statement_timeout: 20_000,
      types: shingiTypes as any,
    })
  : null;

export const EVENT_STATUSES = ['draft', 'announced', 'registration', 'groups_published', 'done', 'cancelled'] as const;
export const ENTRY_STATUSES = ['draft', 'submitted', 'paid', 'withdrawn', 'no_show', 'fought'] as const;
export const PAYMENT_STATUSES = ['created', 'processing', 'success', 'failure', 'expired', 'reversed'] as const;

const list = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS shingi_events (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (${list(EVENT_STATUSES)})),
    fee_uah INTEGER NOT NULL DEFAULT 400,
    limit_kids INTEGER,
    limit_open INTEGER,
    deadline_apps DATE,
    deadline_pay DATE,
    groups_publish_date DATE,
    address TEXT DEFAULT 'Київ, вул. Сім''ї Бродських, 31/33, зал Black Bear Dojo',
    schedule_json JSONB DEFAULT '{"kids":"10:00","open":"13:00"}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS shingi_profiles (
    id SERIAL PRIMARY KEY,
    tg_id BIGINT,
    tg_username TEXT,
    tg_first_name TEXT,
    tg_photo_url TEXT,
    role TEXT CHECK (role IS NULL OR role IN ('coach', 'solo')),
    federation TEXT,
    club TEXT,
    city TEXT DEFAULT 'Київ',
    coach_full_name TEXT,
    phone TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS shingi_profiles_tg_id_uniq ON shingi_profiles (tg_id) WHERE tg_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS shingi_fighters (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES shingi_profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    sex TEXT NOT NULL CHECK (sex IN ('m', 'f')),
    birth_date DATE,
    age_years INTEGER,
    weight_kg NUMERIC(5,1),
    belt TEXT NOT NULL CHECK (belt IN (${list(BELT_CODES)})),
    guardian_name TEXT,
    guardian_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CHECK (birth_date IS NOT NULL OR age_years IS NOT NULL)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS shingi_fighters_dedupe
    ON shingi_fighters (profile_id, lower(full_name), (COALESCE(birth_date, DATE '1900-01-01')));

  CREATE TABLE IF NOT EXISTS shingi_entries (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES shingi_events(id) ON DELETE CASCADE,
    fighter_id INTEGER NOT NULL REFERENCES shingi_fighters(id) ON DELETE CASCADE,
    profile_id INTEGER NOT NULL REFERENCES shingi_profiles(id) ON DELETE CASCADE,
    block TEXT NOT NULL CHECK (block IN ('kids', 'open')),
    block_override BOOLEAN DEFAULT false,
    weight_kg NUMERIC(5,1),
    belt TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (${list(ENTRY_STATUSES)})),
    group_key TEXT,
    group_manual BOOLEAN DEFAULT false,
    fights_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (event_id, fighter_id)
  );
  CREATE INDEX IF NOT EXISTS shingi_entries_event_status ON shingi_entries (event_id, status);
  CREATE INDEX IF NOT EXISTS shingi_entries_profile ON shingi_entries (profile_id);

  CREATE TABLE IF NOT EXISTS shingi_payments (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES shingi_events(id) ON DELETE CASCADE,
    profile_id INTEGER NOT NULL REFERENCES shingi_profiles(id) ON DELETE CASCADE,
    reference TEXT UNIQUE NOT NULL,
    amount_uah INTEGER NOT NULL,
    entries_ids INTEGER[] NOT NULL DEFAULT '{}',
    provider TEXT DEFAULT 'monobank',
    invoice_id TEXT,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN (${list(PAYMENT_STATUSES)})),
    raw_webhook JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS shingi_payments_reference ON shingi_payments (reference);
  -- amount_uah — те, що списано з платника; base_uah — внесок за бійців; fee_uah — комісія банку, яку сплатив платник
  ALTER TABLE shingi_payments ADD COLUMN IF NOT EXISTS base_uah INTEGER;
  ALTER TABLE shingi_payments ADD COLUMN IF NOT EXISTS fee_uah INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE shingi_payments ADD COLUMN IF NOT EXISTS invoice_url TEXT;
  ALTER TABLE shingi_payments ADD COLUMN IF NOT EXISTS note TEXT;
  ALTER TABLE shingi_payments ADD COLUMN IF NOT EXISTS marked_by TEXT;
  -- згода платника з офертою: версія редакції й момент акцепту
  ALTER TABLE shingi_payments ADD COLUMN IF NOT EXISTS offer_version TEXT;
  ALTER TABLE shingi_payments ADD COLUMN IF NOT EXISTS offer_accepted_at TIMESTAMPTZ;
  CREATE INDEX IF NOT EXISTS shingi_payments_invoice ON shingi_payments (invoice_id);
  -- вид внеску події: fee | charity | custom (підпис у fee_label); сума 0 = безкоштовно
  ALTER TABLE shingi_events ADD COLUMN IF NOT EXISTS fee_kind TEXT NOT NULL DEFAULT 'fee';
  ALTER TABLE shingi_events ADD COLUMN IF NOT EXISTS fee_label TEXT;

  CREATE TABLE IF NOT EXISTS shingi_messages (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES shingi_profiles(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    text TEXT,
    tg_message_id BIGINT,
    staff_message_id BIGINT,
    answered BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS shingi_broadcasts (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES shingi_events(id) ON DELETE SET NULL,
    audience TEXT,
    text TEXT,
    urgent BOOLEAN DEFAULT false,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    ack_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS shingi_log (
    id SERIAL PRIMARY KEY,
    actor TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id INTEGER,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  INSERT INTO shingi_events (slug, title, event_date, status, deadline_apps, deadline_pay, groups_publish_date)
  SELECT 'shin-gi-1', 'SHIN GI · Kyokushin Open', CURRENT_DATE + 60, 'draft',
         CURRENT_DATE + 50, CURRENT_DATE + 53, CURRENT_DATE + 55
  WHERE NOT EXISTS (SELECT 1 FROM shingi_events);
`;

let schemaPromise: Promise<void> | null = null;

export function requirePool() {
  if (!pool) throw new Error('DATABASE_URL is not set');
  return pool;
}

// Інший ключ, ніж у попередній версії: сесійний лок 727301 міг лишитися висіти на з'єднанні пулера.
const SCHEMA_LOCK_ID = 727302;

/**
 * DDL під транзакційним advisory-lock: паралельні холодні старти не змагаються за каталог Postgres.
 * Лок знімається разом із транзакцією, тож не переживає з'єднання через пулер (на відміну від pg_advisory_lock).
 */
async function runMigration() {
  const client = await requirePool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [SCHEMA_LOCK_ID]);
    await client.query(SCHEMA_SQL);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Створює таблиці при першому виклику функції; прапорець живе, поки живий інстанс. */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = runMigration().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const result = await requirePool().query(text, params as any[]);
  return result.rows as T[];
}

export async function withTx<T>(fn: (run: (text: string, params?: unknown[]) => Promise<any[]>) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await requirePool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(async (text, params = []) => (await client.query(text, params as any[])).rows);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function logAction(actor: string, action: string, entity: string, entityId: number | null, payload: unknown = null) {
  try {
    await query(
      'INSERT INTO shingi_log (actor, action, entity, entity_id, payload) VALUES ($1, $2, $3, $4, $5)',
      [actor, action, entity, entityId, payload === null ? null : JSON.stringify(payload)],
    );
  } catch (error) {
    console.error('shingi_log failed:', (error as Error).message);
  }
}
