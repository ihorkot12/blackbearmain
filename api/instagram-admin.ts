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

type InstagramInsight = {
  name: string;
  period?: string;
  values?: Array<{ value: number | string; end_time?: string }>;
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

  const result = await pool.query(
    'SELECT id, role, name FROM admin_users WHERE id = $1 AND role = $2 LIMIT 1',
    [Number(payload.sub), 'admin']
  );
  return result.rows[0] || null;
}

async function ensureSmmPostsSchema() {
  if (!pool) return;

  await pool.query(`
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
      content JSONB,
      scoring JSONB,
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
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS content JSONB;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS scoring JSONB;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'generated';
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{}';
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS result_tag TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE smm_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);
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

  await ensureSmmPostsSchema();
}

const activeInstagramAccountSql = (selectAll = false) => `
  SELECT ${selectAll ? '*' : 'id, username, instagram_business_account_id, facebook_page_id, updated_at, COALESCE(is_active, FALSE) AS is_active'}
  FROM instagram_accounts
  WHERE admin_user_id = $1
  ORDER BY COALESCE(is_active, FALSE) DESC, updated_at DESC NULLS LAST, id DESC
  LIMIT 1
`;

async function fetchGraph(url: string, required = true) {
  const response = await fetch(url);
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const message = data?.error?.message || `Graph API error ${response.status}`;
    if (required) throw new Error(message);
    console.warn('Optional Instagram Graph request failed:', message);
    return { data: [], error: message };
  }
  return data;
}

const numericValue = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};

const latestInsightValue = (insights: InstagramInsight[] = [], name: string) => {
  const insight = insights.find((item) => item?.name === name);
  const values = Array.isArray(insight?.values) ? insight!.values! : [];
  if (!values.length) return 0;
  return numericValue(values[values.length - 1]?.value);
};

const makeInsight = (name: string, value: number): InstagramInsight => ({
  name,
  period: 'day',
  values: [{ value: Math.max(0, Math.round(value)) }],
});

const mergeSyntheticInsight = (insights: InstagramInsight[], name: string, value: number) => {
  const current = latestInsightValue(insights, name);
  if (current > 0 || value <= 0) return insights;
  return [...insights, makeInsight(name, value)];
};

const sumMetric = (items: Array<{ insights?: InstagramInsight[] }>, names: string[]) =>
  items.reduce((total, item) => {
    const metric = names.map((name) => latestInsightValue(item.insights || [], name)).find((value) => value > 0) || 0;
    return total + metric;
  }, 0);

async function fetchMediaInsights(media: any[], encodedToken: string) {
  const metricSetsByType = (type: string) => {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'VIDEO' || normalized === 'REELS') {
      return [
        ['reach', 'plays', 'saved', 'shares', 'total_interactions'],
        ['reach', 'views', 'saved', 'shares', 'total_interactions'],
        ['reach'],
      ];
    }
    return [
      ['reach', 'impressions', 'saved', 'shares', 'total_interactions'],
      ['reach', 'views', 'saved', 'shares', 'total_interactions'],
      ['reach'],
    ];
  };

  const result: any[] = [];
  const queue = media.slice(0, 25);
  const workers = Array.from({ length: Math.min(4, queue.length || 1) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item?.id) continue;

      let insights: InstagramInsight[] = [];
      for (const metrics of metricSetsByType(item.media_type)) {
        const url = `https://graph.facebook.com/${GRAPH_VERSION}/${item.id}/insights?metric=${metrics.join(',')}&access_token=${encodedToken}`;
        const data = await fetchGraph(url, false);
        if (Array.isArray(data?.data) && data.data.length) {
          insights = data.data;
          break;
        }
      }

      result.push({ id: item.id, insights });
    }
  });

  await Promise.all(workers);
  const byId = new Map(result.map((item) => [item.id, item.insights]));
  return media.map((item) => ({ ...item, insights: byId.get(item.id) || [] }));
}

function buildInstagramSummary(profileData: any, accountInsights: InstagramInsight[], mediaWithInsights: any[]) {
  const reach = latestInsightValue(accountInsights, 'reach') || sumMetric(mediaWithInsights, ['reach']);
  const impressions =
    latestInsightValue(accountInsights, 'impressions') ||
    sumMetric(mediaWithInsights, ['impressions', 'views', 'plays']);
  const followers = latestInsightValue(accountInsights, 'follower_count') || numericValue(profileData?.followers_count);
  const mediaCount = numericValue(profileData?.media_count) || mediaWithInsights.length;
  const interactions = mediaWithInsights.reduce(
    (total, item) => total + numericValue(item.like_count) + numericValue(item.comments_count),
    0
  );
  const engagementRate = followers > 0 && interactions > 0
    ? Number(((interactions / followers) * 100).toFixed(2))
    : 0;

  let mergedInsights = Array.isArray(accountInsights) ? [...accountInsights] : [];
  mergedInsights = mergeSyntheticInsight(mergedInsights, 'reach', reach);
  mergedInsights = mergeSyntheticInsight(mergedInsights, 'impressions', impressions);
  mergedInsights = mergeSyntheticInsight(mergedInsights, 'follower_count', followers);

  return {
    account_insights: mergedInsights,
    summary: {
      reach: Math.round(reach),
      impressions: Math.round(impressions),
      followers: Math.round(followers),
      media_count: Math.round(mediaCount),
      posts_count: Math.round(mediaCount),
      interactions: Math.round(interactions),
      engagement_rate: engagementRate,
    },
  };
}

function resolveMode(req: any) {
  const queryMode = String(req.query?.mode || '').trim();
  if (queryMode) return queryMode;
  const url = new URL(req.url || '/', `https://${req.headers?.host || 'shin-karate.kyiv.ua'}`);
  if (url.pathname.endsWith('/status')) return 'status';
  if (url.pathname.endsWith('/sync')) return 'sync';
  if (url.pathname.endsWith('/accounts')) return 'accounts';
  if (url.pathname.endsWith('/select-account')) return 'select-account';
  return '';
}

async function handleStatus(adminId: number, res: any) {
  await ensureInstagramSchema();
  const result = await pool!.query(activeInstagramAccountSql(false), [adminId]);
  if (result.rows.length === 0) return res.status(200).json({ connected: false });
  return res.status(200).json({ connected: true, account: result.rows[0] });
}

async function handleAccounts(adminId: number, res: any) {
  await ensureInstagramSchema();
  const result = await pool!.query(
    `SELECT id,
            username,
            instagram_business_account_id,
            facebook_page_id,
            updated_at,
            COALESCE(is_active, FALSE) AS is_active
     FROM instagram_accounts
     WHERE admin_user_id = $1
     ORDER BY COALESCE(is_active, FALSE) DESC, updated_at DESC NULLS LAST, id DESC`,
    [adminId]
  );
  return res.status(200).json({ accounts: result.rows });
}

async function handleSync(adminId: number, res: any) {
  await ensureInstagramSchema();
  const accountRes = await pool!.query(activeInstagramAccountSql(true), [adminId]);
  if (accountRes.rows.length === 0) return res.status(404).json({ error: 'No account connected' });

  const account = accountRes.rows[0];
  const igId = account.instagram_business_account_id;
  const token = account.access_token;
  if (!igId || !token) return res.status(400).json({ error: 'Instagram account is incomplete' });

  const encodedToken = encodeURIComponent(token);
  const profileUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${igId}?fields=username,followers_count,media_count&access_token=${encodedToken}`;
  const insightsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${igId}/insights?metric=impressions,reach,follower_count&period=day&access_token=${encodedToken}`;
  const mediaUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=25&access_token=${encodedToken}`;

  const [profileData, insightsData, mediaData] = await Promise.all([
    fetchGraph(profileUrl, false),
    fetchGraph(insightsUrl, false),
    fetchGraph(mediaUrl, true),
  ]);

  const media = Array.isArray(mediaData?.data) ? mediaData.data : [];
  const mediaWithInsights = await fetchMediaInsights(media, encodedToken);
  const summaryData = buildInstagramSummary(
    profileData,
    Array.isArray(insightsData?.data) ? insightsData.data : [],
    mediaWithInsights
  );

  return res.status(200).json({
    success: true,
    username: profileData?.username || account.username,
    account: {
      username: profileData?.username || account.username,
      instagram_business_account_id: account.instagram_business_account_id,
      facebook_page_id: account.facebook_page_id,
      is_active: Boolean(account.is_active),
    },
    summary: summaryData.summary,
    account_insights: summaryData.account_insights,
    media: mediaWithInsights,
    media_insights: mediaWithInsights.map((item) => ({ id: item.id, insights: item.insights || [] })),
  });
}

async function handleSelect(adminId: number, req: any, res: any) {
  await ensureInstagramSchema();
  const body = await readJsonBody(req);
  const instagramBusinessAccountId = String(
    body?.instagram_business_account_id ||
    body?.instagramBusinessAccountId ||
    body?.id ||
    ''
  ).trim();

  if (!instagramBusinessAccountId) {
    return res.status(400).json({ error: 'Instagram account id is required' });
  }

  const client = await pool!.connect();
  try {
    await client.query('BEGIN');
    const accountRes = await client.query(
      `SELECT id, username, instagram_business_account_id, facebook_page_id
       FROM instagram_accounts
       WHERE admin_user_id = $1 AND instagram_business_account_id = $2
       LIMIT 1`,
      [adminId, instagramBusinessAccountId]
    );

    if (accountRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Цей Instagram акаунт не знайдений у підключених акаунтах адміна' });
    }

    await client.query('UPDATE instagram_accounts SET is_active = FALSE WHERE admin_user_id = $1', [adminId]);
    const updated = await client.query(
      `UPDATE instagram_accounts
       SET is_active = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE admin_user_id = $1 AND instagram_business_account_id = $2
       RETURNING id, username, instagram_business_account_id, facebook_page_id, updated_at, is_active`,
      [adminId, instagramBusinessAccountId]
    );
    await client.query('COMMIT');

    return res.status(200).json({ success: true, account: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const mode = resolveMode(req);
  const expectedMethod: Record<string, string> = {
    status: 'GET',
    accounts: 'GET',
    sync: 'POST',
    'select-account': 'POST',
  };

  if (!expectedMethod[mode]) return res.status(404).json({ error: 'Unknown Instagram API route' });
  if (req.method !== expectedMethod[mode]) {
    res.setHeader('Allow', expectedMethod[mode]);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Доступ тільки для головного адміна' });

  try {
    if (mode === 'status') return await handleStatus(admin.id, res);
    if (mode === 'accounts') return await handleAccounts(admin.id, res);
    if (mode === 'sync') return await handleSync(admin.id, res);
    if (mode === 'select-account') return await handleSelect(admin.id, req, res);
    return res.status(404).json({ error: 'Unknown Instagram API route' });
  } catch (error: any) {
    console.error(`Instagram admin ${mode} failed:`, error?.message || error);
    return res.status(500).json({ error: error?.message || 'Instagram admin API failed' });
  }
}
