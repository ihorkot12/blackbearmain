import crypto from 'crypto';
import pkg from 'pg';

const { Pool } = pkg;

export type AuthTokenRole = 'admin' | 'coach' | 'parent';
export type AuthTokenPayload = {
  sub: string;
  role: AuthTokenRole;
  accessId?: number | null;
  iat: number;
  exp: number;
};

export type AdminUser = {
  id: number;
  role: string;
  name?: string | null;
};

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

const AUTH_TOKEN_PREFIX = 'bb1';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.DATABASE_URL
    ? crypto.createHash('sha256').update(`black-bear-session:${process.env.DATABASE_URL}`).digest('hex')
    : 'black-bear-local-dev-secret');

const signAuthTokenPayload = (encodedPayload: string) =>
  crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url');

export const verifyAuthToken = (token: string): AuthTokenPayload | null => {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== AUTH_TOKEN_PREFIX) return null;

  const [, encodedPayload, signature] = parts;
  const expectedSignature = signAuthTokenPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AuthTokenPayload;
    if (!payload.sub || !/^\d+$/.test(payload.sub)) return null;
    if (!['admin', 'coach', 'parent'].includes(payload.role)) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

export async function readJsonBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function requireAdmin(req: any): Promise<AdminUser | null> {
  const header = req.headers?.authorization || req.headers?.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;

  const payload = verifyAuthToken(value.slice('Bearer '.length));
  if (payload?.role !== 'admin') return null;
  if (!pool) return null;

  const result = await pool.query(
    'SELECT id, role, name FROM admin_users WHERE id = $1 AND role = $2 LIMIT 1',
    [Number(payload.sub), 'admin']
  );
  return result.rows[0] || null;
}

export async function ensureInstagramSchema() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS instagram_accounts (
      id SERIAL PRIMARY KEY,
      admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
      username TEXT,
      access_token TEXT NOT NULL,
      instagram_business_account_id TEXT UNIQUE,
      facebook_page_id TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE;
    ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS access_token TEXT;
    ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT;
    ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;
    ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instagram_accounts_instagram_business_account_id_key') THEN
        ALTER TABLE instagram_accounts ADD CONSTRAINT instagram_accounts_instagram_business_account_id_key UNIQUE (instagram_business_account_id);
      END IF;
    END $$;

    UPDATE instagram_accounts ia
    SET is_active = TRUE
    WHERE ia.admin_user_id IS NOT NULL
      AND COALESCE(ia.is_active, FALSE) = FALSE
      AND ia.id IN (
        SELECT DISTINCT ON (admin_user_id) id
        FROM instagram_accounts
        WHERE admin_user_id IS NOT NULL
        ORDER BY admin_user_id, updated_at DESC NULLS LAST, id DESC
      )
      AND NOT EXISTS (
        SELECT 1
        FROM instagram_accounts active_ia
        WHERE active_ia.admin_user_id = ia.admin_user_id
          AND COALESCE(active_ia.is_active, FALSE) = TRUE
      );
  `);
}

export function activeInstagramAccountSql(selectAll = false) {
  return `
    SELECT ${selectAll ? '*' : 'id, username, instagram_business_account_id, facebook_page_id, updated_at, COALESCE(is_active, FALSE) AS is_active'}
    FROM instagram_accounts
    WHERE admin_user_id = $1
    ORDER BY COALESCE(is_active, FALSE) DESC, updated_at DESC NULLS LAST, id DESC
    LIMIT 1
  `;
}

export function setNoStore(res: any) {
  res.setHeader('Cache-Control', 'no-store');
}
