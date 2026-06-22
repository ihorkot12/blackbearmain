import crypto from 'crypto';
import fetch from 'node-fetch';
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

type InstagramAccountCandidate = {
  username: string;
  accessToken: string;
  instagramBusinessAccountId: string;
  facebookPageId: string | null;
  pageName?: string | null;
};

const AUTH_TOKEN_PREFIX = 'bb1';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.DATABASE_URL
    ? crypto.createHash('sha256').update(`black-bear-session:${process.env.DATABASE_URL}`).digest('hex')
    : 'black-bear-local-dev-secret');

const GRAPH_VERSION = 'v19.0';

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

async function readBody(req: any) {
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

async function ensureSchema() {
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
  `);
}

async function graphGet(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const message = data?.error?.message || `Graph API error ${response.status}`;
    throw new Error(message);
  }
  return data;
}

const scoreInstagramCandidate = (account: InstagramAccountCandidate) => {
  const haystack = `${account.username || ''} ${account.pageName || ''}`.toLowerCase();
  const positive = ['karate', 'карате', 'dojo', 'доджо', 'blackbear', 'black bear', 'bbdojo', 'shin', 'shinkyokushin', 'kyokushin', 'кіокушин', 'киокушин', 'kyiv', 'київ', 'kiev'];
  const negative = ['uafrontarmour', 'front armour', 'front armor', 'front', 'armour', 'armor', 'military', 'tactical'];
  let score = 0;
  positive.forEach((word) => {
    if (haystack.includes(word)) score += 20;
  });
  negative.forEach((word) => {
    if (haystack.includes(word)) score -= 100;
  });
  return score;
};

const sortInstagramCandidates = (accounts: InstagramAccountCandidate[]) =>
  [...accounts].sort((a, b) => scoreInstagramCandidate(b) - scoreInstagramCandidate(a));

async function findInstagramAccounts(inputToken: string): Promise<InstagramAccountCandidate[]> {
  const token = inputToken.replace(/^Bearer\s+/i, '').trim();
  if (token.length < 30) {
    throw new Error('Токен занадто короткий. Потрібен long-lived Facebook/Instagram access token.');
  }

  try {
    const pages = await graphGet('/me/accounts', token, {
      fields: 'id,name,access_token,instagram_business_account',
      limit: '100',
    });

    const accounts: InstagramAccountCandidate[] = [];
    const seen = new Set<string>();

    for (const page of pages?.data || []) {
      const pageToken = clean(page.access_token) || token;
      let instagram = page.instagram_business_account;

      if (!instagram?.id) {
        try {
          const pageDetails = await graphGet(`/${page.id}`, pageToken, { fields: 'instagram_business_account' });
          instagram = pageDetails.instagram_business_account;
        } catch {
          // Try next page if this one cannot be read with the token.
        }
      }

      if (!instagram?.id || seen.has(String(instagram.id))) continue;
      seen.add(String(instagram.id));

      let username = 'Connected Account';
      try {
        const igUser = await graphGet(`/${instagram.id}`, pageToken, { fields: 'username,name' });
        username = clean(igUser.username) || clean(igUser.name) || username;
      } catch {
        username = clean(page.name) || username;
      }

      accounts.push({
        username,
        accessToken: pageToken,
        instagramBusinessAccountId: String(instagram.id),
        facebookPageId: String(page.id),
        pageName: clean(page.name),
      });
    }

    if (accounts.length > 0) return sortInstagramCandidates(accounts);
  } catch (error: any) {
    // Fall through to direct Instagram token check below.
    console.warn('Manual Instagram page lookup failed:', error?.message || error);
  }

  const me = await graphGet('/me', token, { fields: 'id,username,account_type' });
  if (me?.id && me?.username) {
    return [{
      username: clean(me.username) || 'Connected Account',
      accessToken: token,
      instagramBusinessAccountId: String(me.id),
      facebookPageId: null,
      pageName: null,
    }];
  }

  throw new Error('Не знайшов Instagram Business акаунт у цьому токені. Перевір, що Instagram привʼязаний до Facebook Page і token має потрібні permissions.');
}

async function saveInstagramAccounts(adminUserId: number, accounts: InstagramAccountCandidate[]) {
  if (!pool) throw new Error('База даних не налаштована');

  const rankedAccounts = sortInstagramCandidates(accounts);
  const selected = rankedAccounts[0];
  await pool.query('UPDATE instagram_accounts SET is_active = FALSE WHERE admin_user_id = $1', [adminUserId]);

  for (const account of rankedAccounts) {
    const isActive = account.instagramBusinessAccountId === selected.instagramBusinessAccountId;
    await pool.query(
      `INSERT INTO instagram_accounts (admin_user_id, username, access_token, instagram_business_account_id, facebook_page_id, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (instagram_business_account_id)
       DO UPDATE SET
         admin_user_id = EXCLUDED.admin_user_id,
         username = EXCLUDED.username,
         access_token = EXCLUDED.access_token,
         facebook_page_id = EXCLUDED.facebook_page_id,
         is_active = EXCLUDED.is_active,
         updated_at = CURRENT_TIMESTAMP`,
      [adminUserId, account.username, account.accessToken, account.instagramBusinessAccountId, account.facebookPageId, isActive]
    );
  }

  return { selected, accounts: rankedAccounts };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!pool) {
    return res.status(500).json({ error: 'База даних не налаштована' });
  }

  const admin = await requireAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Доступ тільки для головного адміна' });
  }

  await ensureSchema();

  const body = await readBody(req);
  const accessToken = clean(body.accessToken || body.token);
  if (!accessToken) {
    return res.status(400).json({ error: 'Встав long-lived Instagram/Facebook access token' });
  }

  try {
    const accounts = await findInstagramAccounts(accessToken);
    const saved = await saveInstagramAccounts(admin.id, accounts);

    return res.status(200).json({
      success: true,
      connected: true,
      account: {
        username: saved.selected.username,
        instagram_business_account_id: saved.selected.instagramBusinessAccountId,
        facebook_page_id: saved.selected.facebookPageId,
      },
      accounts: saved.accounts.map((account) => ({
        username: account.username,
        instagram_business_account_id: account.instagramBusinessAccountId,
        facebook_page_id: account.facebookPageId,
        page_name: account.pageName || null,
      })),
    });
  } catch (error: any) {
    console.error('Manual Instagram connect failed:', error?.message || error);
    return res.status(400).json({ error: error?.message || 'Не вдалося підключити Instagram по токену' });
  }
}
