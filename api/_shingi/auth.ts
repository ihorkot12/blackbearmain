import crypto from 'crypto';

export const SESSION_COOKIE = 'shingi_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

export type VerifyResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; reason: 'bad_hash' | 'expired' | 'malformed' };

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

const safeEqualHex = (a: string, b: string) => {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const dataCheckString = (fields: Record<string, string>) =>
  Object.keys(fields)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');

function checkAge(authDate: number, nowMs: number, maxAgeSeconds: number): boolean {
  if (!Number.isFinite(authDate) || authDate <= 0) return false;
  const nowSeconds = Math.floor(nowMs / 1000);
  // допускаємо розбіжність годинників до 5 хв у майбутнє
  return authDate <= nowSeconds + 300 && nowSeconds - authDate <= maxAgeSeconds;
}

/** Telegram Login Widget: secret = SHA256(bot_token), hash = HMAC_SHA256(data_check_string, secret). */
export function verifyLoginWidget(
  fields: Record<string, unknown>,
  botToken: string,
  nowMs = Date.now(),
  maxAgeSeconds = TELEGRAM_AUTH_MAX_AGE_SECONDS,
): VerifyResult<TelegramUser> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (value === undefined || value === null) continue;
    flat[key] = String(value);
  }
  const hash = flat.hash;
  if (!botToken || !hash || !flat.id || !flat.auth_date) return { ok: false, reason: 'malformed' };

  const secret = crypto.createHash('sha256').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString(flat)).digest('hex');
  if (!safeEqualHex(expected, hash.toLowerCase())) return { ok: false, reason: 'bad_hash' };
  if (!checkAge(Number(flat.auth_date), nowMs, maxAgeSeconds)) return { ok: false, reason: 'expired' };

  const id = Number(flat.id);
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, reason: 'malformed' };
  return {
    ok: true,
    data: {
      id,
      first_name: flat.first_name,
      last_name: flat.last_name,
      username: flat.username,
      photo_url: flat.photo_url,
    },
  };
}

/** Mini App: secret = HMAC_SHA256(key="WebAppData", bot_token), hash = HMAC_SHA256(data_check_string, secret). */
export function verifyWebAppInitData(
  initData: string,
  botToken: string,
  nowMs = Date.now(),
  maxAgeSeconds = TELEGRAM_AUTH_MAX_AGE_SECONDS,
): VerifyResult<TelegramUser> {
  if (!initData || !botToken) return { ok: false, reason: 'malformed' };
  const params = new URLSearchParams(initData);
  const fields: Record<string, string> = {};
  params.forEach((value, key) => {
    fields[key] = value;
  });
  const hash = fields.hash;
  if (!hash || !fields.auth_date || !fields.user) return { ok: false, reason: 'malformed' };

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString(fields)).digest('hex');
  if (!safeEqualHex(expected, hash.toLowerCase())) return { ok: false, reason: 'bad_hash' };
  if (!checkAge(Number(fields.auth_date), nowMs, maxAgeSeconds)) return { ok: false, reason: 'expired' };

  try {
    const user = JSON.parse(fields.user) as TelegramUser;
    if (!Number.isSafeInteger(user?.id) || user.id <= 0) return { ok: false, reason: 'malformed' };
    return { ok: true, data: user };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

export function getSessionSecret(): string {
  return (
    process.env.SHINGI_JWT_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.AUTH_TOKEN_SECRET ||
    (process.env.DATABASE_URL
      ? crypto.createHash('sha256').update(`shingi-session:${process.env.DATABASE_URL}`).digest('hex')
      : 'shingi-local-dev-secret')
  );
}

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (input: string, secret: string) => crypto.createHmac('sha256', secret).update(input).digest('base64url');

/** JWT HS256 з єдиним claim `pid` (id профілю). */
export function signSession(profileId: number, secret = getSessionSecret(), nowMs = Date.now()): string {
  const now = Math.floor(nowMs / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ pid: profileId, iat: now, exp: now + SESSION_TTL_SECONDS });
  return `${head}.${body}.${sign(`${head}.${body}`, secret)}`;
}

export function verifySession(token: string, secret = getSessionSecret(), nowMs = Date.now()): number | null {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [head, body, signature] = parts;
  if (!safeEqualHex(sign(`${head}.${body}`, secret), signature)) return null;
  try {
    const header = JSON.parse(Buffer.from(head, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(payload.pid) || !payload.exp || payload.exp < Math.floor(nowMs / 1000)) return null;
    return payload.pid;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, secure = true): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export const clearSessionCookie = (secure = true) =>
  [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0', secure ? 'Secure' : ''].filter(Boolean).join('; ');

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}
