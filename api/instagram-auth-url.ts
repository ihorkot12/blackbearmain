import crypto from 'crypto';
import pkg from 'pg';

const { Pool } = pkg;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

type AuthTokenRole = 'admin' | 'coach' | 'parent';
type AuthTokenPayload = {
  sub: string;
  role: AuthTokenRole;
  accessId?: number | null;
  iat: number;
  exp: number;
};

const AUTH_TOKEN_PREFIX = 'bb1';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.DATABASE_URL
    ? crypto.createHash('sha256').update(`black-bear-session:${process.env.DATABASE_URL}`).digest('hex')
    : 'black-bear-local-dev-secret');

const clean = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

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

async function getSetting(keys: string[]) {
  if (!pool) return null;
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
    const result = await pool.query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys]);
    for (const key of keys) {
      const value = clean(result.rows.find((row: any) => row.key === key)?.value);
      if (value) return value;
    }
  } catch (error) {
    console.error('Failed to read Instagram setting:', error);
  }
  return null;
}

async function getConfiguredValue(envKeys: string[], settingKeys: string[]) {
  for (const key of envKeys) {
    const value = clean(process.env[key]);
    if (value) return value;
  }
  return getSetting(settingKeys);
}

async function requireAdmin(req: any) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;

  const payload = verifyAuthToken(value.slice('Bearer '.length));
  if (payload?.role !== 'admin') return null;
  if (!pool) return null;

  const result = await pool.query('SELECT id, role, name FROM admin_users WHERE id = $1 AND role = $2 LIMIT 1', [Number(payload.sub), 'admin']);
  return result.rows[0] || null;
}

const signState = (payload: Record<string, any>) => {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
};

function getBaseUrl(req: any) {
  const configured = clean(process.env.APP_URL) || clean(process.env.PUBLIC_SITE_URL) || clean(process.env.SITE_URL);
  if (configured) return configured.replace(/\/+$/, '');
  const hostHeader = req.headers?.['x-forwarded-host'] || req.headers?.host || 'shin-karate.kyiv.ua';
  const host = Array.isArray(hostHeader) ? hostHeader[0] : String(hostHeader);
  const protocolHeader = req.headers?.['x-forwarded-proto'];
  const protocol = Array.isArray(protocolHeader) ? protocolHeader[0] : String(protocolHeader || 'https');
  return host.startsWith('http') ? host.replace(/\/+$/, '') : `${protocol}://${host}`.replace(/\/+$/, '');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = await getConfiguredValue(
    ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_APP_ID', 'META_APP_ID', 'FACEBOOK_CLIENT_ID'],
    ['instagram_client_id', 'INSTAGRAM_CLIENT_ID', 'instagram_app_id', 'META_APP_ID']
  );

  if (!clientId) {
    return res.status(500).json({ error: 'Instagram Client ID not configured' });
  }

  const action = String(req.query?.action || 'connect') === 'login' ? 'login' : 'connect';
  let userId: number | null = null;
  if (action === 'connect') {
    const admin = await requireAdmin(req);
    if (!admin) return res.status(403).json({ error: 'Доступ тільки для головного адміна' });
    userId = Number(admin.id);
  }

  const configuredAppUrl = await getSetting(['app_url', 'APP_URL']);
  const baseUrl = (clean(configuredAppUrl) || getBaseUrl(req)).replace(/\/+$/, '');
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;

  const scopes = [
    'instagram_basic',
    'instagram_manage_insights',
    'pages_read_engagement',
    'pages_show_list',
    'business_management'
  ].join(',');

  const state = signState({ action, userId, iat: Date.now() });
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${encodeURIComponent(state)}`;

  return res.status(200).json({ url: authUrl });
}
