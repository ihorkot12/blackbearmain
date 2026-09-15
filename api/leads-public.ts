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

/** Обрізає рядок до ліміту — щоб у базу не можна було залити мегабайти. */
const capped = (value: any, max: number) => {
  const v = clean(value);
  return v ? v.slice(0, max) : null;
};

/** Екранування для Telegram parse_mode=HTML: інакше вміст заявки ламає розмітку. */
const escapeHtml = (value: any) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const ALLOWED_ORIGINS = [
  'https://shin-karate.kyiv.ua',
  'https://www.shin-karate.kyiv.ua',
  'https://blackbear-nu.vercel.app',
];

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
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_ip TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_agent TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_days TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_time TEXT;
    CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);

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
    ['META_CAPI_ACCESS_TOKEN', 'META_PIXEL_ACCESS_TOKEN'],
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

/** Скільки заявок з цього IP або телефону вже прийнято за останні хвилини. */
async function recentCount(column: string, value: string, minutes: number) {
  if (!pool || !value) return 0;
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM leads
      WHERE ${column} = $1 AND created_at > NOW() - ($2 || ' minutes')::interval`,
    [value, String(minutes)]
  );
  return result.rows[0]?.n ?? 0;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Форма живе на нашому домені. Запит із чужого Origin — не наш відвідувач.
  const origin = clean(req.headers?.origin);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body || {};

  // Пастка для ботів: поле приховане від людей, заповнене — значить це скрипт.
  if (clean(body.company) || clean(body.website)) {
    return res.json({ success: true, telegramSent: false, metaSent: false });
  }

  const name = clean(body.name);
  const phone = clean(body.phone);

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  // Захист від сміття: випадкові натискання і боти заповнюють поля невалідними значеннями.
  const phoneDigits = (phone.match(/\d/g) || []).length;
  const nameHasLetters = /\p{L}{2}/u.test(name);
  if (
    name.length < 2 ||
    name.length > 60 ||
    !nameHasLetters ||
    phone.length > 25 ||
    phoneDigits < 9 ||
    phoneDigits > 15
  ) {
    return res.status(400).json({ error: 'Вкажіть імʼя і коректний номер телефону' });
  }

  const ip = clientIp(req) || null;
  const userAgent = capped(req.headers?.['user-agent'], 300);

  try {
    if (pool) {
      await ensureLeadSchema();

      // Той самий номер протягом 10 хвилин — повторне натискання, а не нова заявка.
      if (await recentCount('phone', phone, 10)) {
        return res.json({ success: true, duplicate: true, telegramSent: false, metaSent: false });
      }

      // Не більше 3 заявок з одного IP за 15 хвилин.
      if (ip && (await recentCount('client_ip', ip, 15)) >= 3) {
        return res.status(429).json({ error: 'Забагато заявок. Спробуйте за кілька хвилин.' });
      }

      await pool.query(
        `INSERT INTO leads (
          name,
          phone,
          age_group,
          location,
          preferred_days,
          preferred_time,
          client_ip,
          user_agent,
          ${leadColumns.join(', ')}
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )`,
        [
          name,
          phone,
          capped(body.age_group, 60),
          capped(body.location, 120),
          capped(body.preferred_days, 60),
          capped(body.preferred_time, 120),
          ip,
          userAgent,
          ...leadColumns.map((column) =>
            capped(body[column], column.endsWith('_page') || column === 'page_url' || column === 'referrer' ? 500 : 200)
          ),
        ]
      );
    }

    const source = capped(body.source, 60) || 'main';
    const message = `
<b>Нова заявка на пробне заняття</b>
<b>Джерело:</b> ${escapeHtml(source)}
<b>Ім'я:</b> ${escapeHtml(name)}
<b>Телефон:</b> ${escapeHtml(phone)}
<b>Вікова група:</b> ${escapeHtml(capped(body.age_group, 60) || 'Не вказано')}
<b>Локація:</b> ${escapeHtml(capped(body.location, 120) || 'Не вказано')}
<b>Зручні дні:</b> ${escapeHtml(capped(body.preferred_days, 60) || 'Не вказано')}
<b>Зручний час:</b> ${escapeHtml(capped(body.preferred_time, 120) || 'Не вказано')}
<b>Кампанія:</b> ${escapeHtml(capped(body.utm_campaign, 200) || 'Не вказано')}
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
