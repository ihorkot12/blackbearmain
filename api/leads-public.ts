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

const leadColumns = [
  'source',
  'event_id',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'fbp',
  'fbc',
  'landing_page',
  'page_url',
  'referrer',
];

let schemaReady = false;

const clean = (value: any) => (typeof value === 'string' && value.trim() ? value.trim() : null);

async function ensureLeadSchema() {
  if (!pool || schemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      age_group TEXT,
      location TEXT,
      status TEXT DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE leads ADD COLUMN IF NOT EXISTS value DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_coach_id INTEGER;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_participant_id INTEGER;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS event_id TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS fbclid TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS fbp TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS fbc TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS landing_page TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS page_url TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer TEXT;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  schemaReady = true;
}

async function getSetting(keys: string[]) {
  if (!pool) return null;

  await ensureLeadSchema();
  const result = await pool.query(
    'SELECT key, value FROM settings WHERE key = ANY($1)',
    [keys]
  );

  for (const key of keys) {
    const row = result.rows.find((item) => item.key === key);
    const value = clean(row?.value);
    if (value) return value;
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

function hash(value: any) {
  const normalized = clean(value);
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized.toLowerCase()).digest('hex');
}

function clientIp(req: any) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.socket?.remoteAddress;
}

async function sendTelegramMessage(text: string) {
  const token = await getConfiguredValue(
    ['TELEGRAM_BOT_TOKEN'],
    ['telegram_bot_token', 'TELEGRAM_BOT_TOKEN']
  );
  const chatId = await getConfiguredValue(
    ['TELEGRAM_CHAT_ID'],
    ['telegram_chat_id', 'TELEGRAM_CHAT_ID']
  );
  if (!token || !chatId) return false;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });

  return response.ok;
}

async function sendMetaLeadEvent(body: any, req: any) {
  const pixelId =
    await getConfiguredValue(
      ['META_PIXEL_ID'],
      ['meta_pixel_id', 'META_PIXEL_ID']
    ) || '2370050340139768';
  const accessToken = await getConfiguredValue(
    ['META_CAPI_ACCESS_TOKEN', 'META_PIXEL_ACCESS_TOKEN', 'META_ACCESS_TOKEN'],
    ['meta_capi_access_token', 'meta_pixel_access_token', 'meta_access_token', 'META_CAPI_ACCESS_TOKEN', 'META_PIXEL_ACCESS_TOKEN', 'META_ACCESS_TOKEN']
  );

  if (!accessToken) return false;

  const event: any = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url:
      clean(body.page_url) ||
      clean(body.landing_page) ||
      req.headers.referer ||
      process.env.APP_URL ||
      'https://shin-karate.kyiv.ua/',
    event_id: clean(body.event_id),
    user_data: {
      client_ip_address: clientIp(req),
      client_user_agent: req.headers['user-agent'],
      ph: body.phone ? [hash(body.phone)] : undefined,
      fn: body.name ? [hash(body.name)] : undefined,
      fbp: clean(body.fbp) || undefined,
      fbc: clean(body.fbc) || undefined,
    },
    custom_data: {
      content_name: 'Trial Lesson Signup',
      currency: 'UAH',
      value: 1.0,
      source: clean(body.source) || undefined,
      age_group: clean(body.age_group) || undefined,
      location: clean(body.location) || undefined,
      utm_source: clean(body.utm_source) || undefined,
      utm_medium: clean(body.utm_medium) || undefined,
      utm_campaign: clean(body.utm_campaign) || undefined,
      utm_content: clean(body.utm_content) || undefined,
      utm_term: clean(body.utm_term) || undefined,
    },
  };

  const payload: any = { data: [event] };
  const testEventCode = await getConfiguredValue(
    ['META_TEST_EVENT_CODE'],
    ['meta_test_event_code', 'META_TEST_EVENT_CODE']
  );
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${pixelId}/events?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  return response.ok;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const name = clean(body.name);
  const phone = clean(body.phone);

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  try {
    if (pool) {
      await ensureLeadSchema();
      await pool.query(
        `INSERT INTO leads (
          name,
          phone,
          age_group,
          location,
          ${leadColumns.join(', ')}
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        )`,
        [
          name,
          phone,
          clean(body.age_group),
          clean(body.location),
          ...leadColumns.map((column) => clean(body[column])),
        ]
      );
    }

    const source = clean(body.source) || 'main';
    const message = `
<b>🔔 Нова заявка на пробне заняття!</b>
<b>Джерело:</b> ${source}
<b>Ім'я:</b> ${name}
<b>Телефон:</b> ${phone}
<b>Вікова група:</b> ${clean(body.age_group) || 'Не вказано'}
<b>Локація:</b> ${clean(body.location) || 'Не вказано'}
<b>Кампанія:</b> ${clean(body.utm_campaign) || 'Не вказано'}
    `;

    const [telegramSent, metaSent] = await Promise.allSettled([
      sendTelegramMessage(message),
      sendMetaLeadEvent(body, req),
    ]);

    return res.json({
      success: true,
      telegramSent: telegramSent.status === 'fulfilled' ? telegramSent.value : false,
      metaSent: metaSent.status === 'fulfilled' ? metaSent.value : false,
    });
  } catch (error) {
    console.error('Lead submission failed:', error);
    return res.status(500).json({ error: 'Failed to save lead' });
  }
}
