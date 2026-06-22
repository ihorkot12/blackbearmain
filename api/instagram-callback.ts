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

const GRAPH_VERSION = 'v19.0';
const AUTH_TOKEN_PREFIX = 'bb1';
const AUTH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.DATABASE_URL
    ? crypto.createHash('sha256').update(`black-bear-session:${process.env.DATABASE_URL}`).digest('hex')
    : 'black-bear-local-dev-secret');

const clean = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

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

const signAuthTokenPayload = (encodedPayload: string) =>
  crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url');

const createAuthToken = (params: { id: number | string; role: 'admin' | 'coach' | 'parent'; accessId?: number | null }) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(params.id),
    role: params.role,
    accessId: params.accessId ?? null,
    iat: now,
    exp: now + AUTH_TOKEN_TTL_SECONDS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${AUTH_TOKEN_PREFIX}.${encodedPayload}.${signAuthTokenPayload(encodedPayload)}`;
};

const parseState = (stateValue: unknown) => {
  const state = String(stateValue || '');
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload || !['connect', 'login'].includes(payload.action)) return null;
    if (payload.iat && Date.now() - Number(payload.iat) > 30 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
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

async function graphGet(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `Graph API error ${response.status}`);
  }
  return data;
}

async function ensureInstagramSchema() {
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

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instagram_accounts_instagram_business_account_id_key') THEN
        ALTER TABLE instagram_accounts ADD CONSTRAINT instagram_accounts_instagram_business_account_id_key UNIQUE (instagram_business_account_id);
      END IF;
    END $$;
  `);
}

async function findInstagramAccount(accessToken: string) {
  const pagesData = await graphGet('/me/accounts', accessToken, {
    fields: 'id,name,access_token,instagram_business_account',
    limit: '50'
  });

  for (const page of pagesData?.data || []) {
    const pageToken = clean(page.access_token) || accessToken;
    let instagram = page.instagram_business_account;

    if (!instagram?.id) {
      try {
        const pageDetails = await graphGet(`/${page.id}`, pageToken, { fields: 'instagram_business_account' });
        instagram = pageDetails.instagram_business_account;
      } catch {
        // Continue with next page.
      }
    }

    if (instagram?.id) {
      let username = 'Connected Account';
      try {
        const userData = await graphGet(`/${instagram.id}`, pageToken, { fields: 'username' });
        username = clean(userData.username) || username;
      } catch {
        username = clean(page.name) || username;
      }
      return {
        username,
        accessToken: pageToken,
        instagramBusinessAccountId: String(instagram.id),
        facebookPageId: String(page.id)
      };
    }
  }

  throw new Error('No Instagram Business Account linked to your Facebook Pages found.');
}

const htmlScript = (script: string) => `<!doctype html><html><body><script>${script}</script></body></html>`;

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }

  if (!pool) return res.status(500).send('Database not configured');

  const code = clean(req.query?.code);
  const state = parseState(req.query?.state);
  if (!code) return res.status(400).send('No code provided');
  if (!state) return res.status(400).send('Invalid state');

  const clientId = await getConfiguredValue(
    ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_APP_ID', 'META_APP_ID', 'FACEBOOK_CLIENT_ID'],
    ['instagram_client_id', 'INSTAGRAM_CLIENT_ID', 'instagram_app_id', 'META_APP_ID']
  );
  const clientSecret = await getConfiguredValue(
    ['INSTAGRAM_CLIENT_SECRET', 'INSTAGRAM_APP_SECRET', 'META_APP_SECRET', 'FACEBOOK_CLIENT_SECRET'],
    ['instagram_client_secret', 'INSTAGRAM_CLIENT_SECRET', 'instagram_app_secret', 'META_APP_SECRET']
  );

  if (!clientId || !clientSecret) {
    return res.status(500).send('Instagram app credentials are not configured');
  }

  const configuredAppUrl = await getSetting(['app_url', 'APP_URL']);
  const baseUrl = (clean(configuredAppUrl) || getBaseUrl(req)).replace(/\/+$/, '');
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;

  try {
    const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', clientId);
    tokenUrl.searchParams.set('client_secret', clientSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || tokenData?.error) throw new Error(tokenData?.error?.message || 'Failed to exchange Instagram code');

    const account = await findInstagramAccount(tokenData.access_token);
    await ensureInstagramSchema();

    if (state.action === 'login') {
      const result = await pool.query(
        'SELECT admin_users.* FROM admin_users JOIN instagram_accounts ON admin_users.id = instagram_accounts.admin_user_id WHERE instagram_accounts.instagram_business_account_id = $1',
        [account.instagramBusinessAccountId]
      );
      if (result.rows.length === 0) {
        return res.send(htmlScript('alert("Цей Instagram акаунт не привʼязаний до жодного адміна."); window.close();'));
      }
      const user = result.rows[0];
      const role = user.role === 'coach' ? 'coach' : 'admin';
      const payload = JSON.stringify({ role, name: user.name, token: createAuthToken({ id: user.id, role }) });
      return res.send(htmlScript(`if (window.opener) { window.opener.postMessage({ type: 'instagram_login_success', user: ${payload} }, '*'); window.close(); } else { window.location.href = '/admin'; }`));
    }

    const adminUserId = Number(state.userId);
    if (!Number.isFinite(adminUserId)) return res.status(400).send('Invalid admin state');

    await pool.query(
      `INSERT INTO instagram_accounts (admin_user_id, username, access_token, instagram_business_account_id, facebook_page_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (instagram_business_account_id)
       DO UPDATE SET
         admin_user_id = EXCLUDED.admin_user_id,
         username = EXCLUDED.username,
         access_token = EXCLUDED.access_token,
         facebook_page_id = EXCLUDED.facebook_page_id,
         updated_at = CURRENT_TIMESTAMP`,
      [adminUserId, account.username, account.accessToken, account.instagramBusinessAccountId, account.facebookPageId]
    );

    return res.send(htmlScript(`if (window.opener) { window.opener.postMessage('instagram_connected', '*'); window.close(); } else { window.location.href = '/admin'; }`));
  } catch (error: any) {
    console.error('Instagram OAuth callback failed:', error?.message || error);
    const message = JSON.stringify(error?.message || 'Instagram OAuth failed');
    return res.status(500).send(htmlScript(`alert(${message}); window.close();`));
  }
}
