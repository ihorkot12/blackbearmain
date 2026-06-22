import crypto from 'crypto';
import pkg from 'pg';

const { Pool } = pkg;

const pool = process.env.DATABASE_URL
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

type AuthTokenRole = 'admin' | 'coach' | 'parent';
type AuthTokenPayload = {
  sub: string;
  role: AuthTokenRole;
  accessId?: number | null;
  iat: number;
  exp: number;
};

const signAuthTokenPayload = (encodedPayload: string) =>
  crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url');

const verifyAuthToken = (token: string): AuthTokenPayload | null => {
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

async function readJsonBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); }
    catch { return {}; }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); }
  catch { return {}; }
}

function requireStaff(req: any) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;
  const payload = verifyAuthToken(value.slice('Bearer '.length));
  if (!payload || !['admin', 'coach'].includes(payload.role)) return null;
  return payload;
}

async function ensureSmmPostsSchema() {
  await pool!.query(`
    CREATE TABLE IF NOT EXISTS smm_posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      audience TEXT,
      goal TEXT,
      pain TEXT,
      format TEXT,
      source_signal TEXT,
      score INTEGER,
      reason TEXT,
      content JSONB DEFAULT '{}',
      scoring JSONB DEFAULT '{}',
      status TEXT DEFAULT 'generated',
      metrics JSONB DEFAULT '{}',
      result_tag TEXT,
      notes TEXT,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS audience TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS goal TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS pain TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS format TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS source_signal TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS score INTEGER;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS reason TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}';
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS scoring JSONB DEFAULT '{}';
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'generated';
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{}';
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS result_tag TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);
}

const cleanText = (value: unknown, fallback = '') => String(value ?? fallback).trim().slice(0, 4000);
const cleanNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
};

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const staff = requireStaff(req);
  if (!staff) return res.status(403).json({ error: 'Доступ тільки для адміна або тренера' });

  try {
    await ensureSmmPostsSchema();
    const body = await readJsonBody(req);
    const title = cleanText(body.title, 'SMM ідея');
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = await pool.query(
      `INSERT INTO smm_posts (
        title, audience, goal, pain, format, score, reason, content, scoring, status, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        title,
        cleanText(body.audience),
        cleanText(body.goal),
        cleanText(body.pain),
        cleanText(body.format, 'Reels'),
        cleanNumber(body.score, 80),
        cleanText(body.reason),
        JSON.stringify(body.content || {}),
        JSON.stringify(body.scoring || {}),
        cleanText(body.status, 'selected') || 'selected',
      ]
    );

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('SMM repair post save failed:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to save SMM post' });
  }
}
