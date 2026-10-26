import crypto from 'crypto';
import { query } from './db.js';
import { isTelegramAdmin } from './store.js';
import type { Profile } from './http.js';

/**
 * Секрет і токени адмінки сайту — той самий, що в api/index.ts, щоб існуючий вхід в адмінку
 * працював і для /api/shingi/admin/*.
 */
const SITE_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.DATABASE_URL
    ? crypto.createHash('sha256').update(`black-bear-session:${process.env.DATABASE_URL}`).digest('hex')
    : 'black-bear-local-dev-secret');

const AUTH_TOKEN_PREFIX = 'bb1';
const SITE_ADMIN_TOKEN = crypto.createHash('sha256').update(SITE_SECRET + 'admin-token-v1').digest('hex');

const equal = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

function verifySiteToken(token: string): { sub: string; role: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== AUTH_TOKEN_PREFIX) return null;
  const [, encoded, signature] = parts;
  const expected = crypto.createHmac('sha256', SITE_SECRET).update(encoded).digest('base64url');
  if (!equal(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.sub || !/^\d+$/.test(payload.sub)) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

const bearer = (req: any): string | null => {
  const header = req.headers?.authorization || req.headers?.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : null;
};

const ALLOWED_ORIGINS = [
  'https://shin-karate.kyiv.ua',
  'https://www.shin-karate.kyiv.ua',
  'https://blackbear-nu.vercel.app',
];

/** Захист від CSRF для мутацій по cookie: Origin/Referer мають бути наші. */
export function originAllowed(req: any): boolean {
  const extra = [process.env.PUBLIC_BASE_URL, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '']
    .filter(Boolean)
    .map((v) => String(v).replace(/\/+$/, ''));
  const allowed = [...ALLOWED_ORIGINS, ...extra];
  const origin = req.headers?.origin;
  if (typeof origin === 'string' && origin) {
    return allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  }
  const referer = req.headers?.referer;
  if (typeof referer === 'string' && referer) {
    try {
      const u = new URL(referer);
      return allowed.includes(u.origin) || u.hostname === 'localhost';
    } catch {
      return false;
    }
  }
  return false;
}

/** Повертає ідентифікатор адміна або null. */
export async function resolveAdmin(req: any, profile: Profile | null): Promise<string | null> {
  const token = bearer(req);
  if (token) {
    if (equal(token, SITE_ADMIN_TOKEN)) return 'system';
    const payload = verifySiteToken(token);
    if (payload?.role === 'admin') {
      const rows = await query('SELECT id FROM admin_users WHERE id = $1 AND role = $2 LIMIT 1', [Number(payload.sub), 'admin']).catch(() => []);
      if (rows[0]) return `admin:${rows[0].id}`;
    }
    return null;
  }

  if (profile && isTelegramAdmin(profile)) {
    if (req.method !== 'GET' && !originAllowed(req)) return null;
    return `tg:${profile.tg_id ?? `p${profile.id}`}`;
  }
  return null;
}
