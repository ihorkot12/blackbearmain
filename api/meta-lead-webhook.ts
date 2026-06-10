import fetch from 'node-fetch';
import pkg from 'pg';

const { Pool } = pkg;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

const clean = (value: any) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function htmlEscape(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getField(fields: Record<string, string>, names: string[]) {
  for (const name of names) {
    if (fields[name]) return fields[name];
  }
  return null;
}

function fieldDataToMap(fieldData: any[] = []) {
  const fields: Record<string, string> = {};

  fieldData.forEach((field) => {
    if (!field?.name) return;
    const values = Array.isArray(field.values) ? field.values : [];
    fields[field.name] = values.join(', ');
  });

  return fields;
}

async function ensureSchema() {
  if (!pool) return;

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

    ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS event_id TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_lead_id TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_form_id TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_ad_id TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_campaign_id TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS page_url TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer TEXT;

    CREATE TABLE IF NOT EXISTS meta_lead_events (
      leadgen_id TEXT PRIMARY KEY,
      form_id TEXT,
      ad_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

async function getSetting(keys: string[]) {
  if (!pool) return null;

  await ensureSchema();
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

async function markLeadSeen(leadgenId: string, formId?: string, adId?: string) {
  if (!pool) return true;

  await ensureSchema();
  const result = await pool.query(
    `INSERT INTO meta_lead_events (leadgen_id, form_id, ad_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (leadgen_id) DO NOTHING
     RETURNING leadgen_id`,
    [leadgenId, formId || null, adId || null]
  );

  return result.rowCount > 0;
}

async function saveLead(lead: any, fields: Record<string, string>, formName: string | null) {
  if (!pool) return;

  await ensureSchema();

  const name = clean(getField(fields, ['full_name', 'first_name', 'name'])) || 'Meta Lead';
  const phone = clean(getField(fields, ['phone_number', 'phone'])) || 'Не вказано';
  const age = clean(getField(fields, ['child_age', 'вік_дитини']));
  const addressFit = clean(getField(fields, ['address_fit']));

  await pool.query(
    `INSERT INTO leads (
      name,
      phone,
      age_group,
      location,
      source,
      event_id,
      meta_lead_id,
      meta_form_id,
      meta_ad_id,
      meta_campaign_id,
      page_url,
      referrer
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      name,
      phone,
      age,
      addressFit || "Сім'ї Бродських",
      formName ? `meta_instant_form: ${formName}` : 'meta_instant_form',
      lead.id,
      lead.id,
      lead.form_id || null,
      lead.ad_id || null,
      lead.campaign_id || null,
      'https://www.facebook.com/',
      'Meta Instant Form',
    ]
  );
}

async function sendTelegram(text: string) {
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
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  return response.ok;
}

async function graphGet(path: string, fields?: string) {
  const accessToken = await getConfiguredValue(
    ['META_PAGE_ACCESS_TOKEN', 'META_ACCESS_TOKEN', 'META_CAPI_ACCESS_TOKEN'],
    ['meta_page_access_token', 'meta_access_token', 'META_PAGE_ACCESS_TOKEN', 'META_ACCESS_TOKEN']
  );

  if (!accessToken) throw new Error('META_PAGE_ACCESS_TOKEN is not configured');

  const params = new URLSearchParams({ access_token: accessToken });
  if (fields) params.set('fields', fields);

  const response = await fetch(`https://graph.facebook.com/v25.0/${path}?${params}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message || 'Meta Graph request failed');
  }
  return body;
}

async function processLead(leadgenId: string, formId?: string, adId?: string) {
  const isNew = await markLeadSeen(leadgenId, formId, adId);
  if (!isNew) return { skipped: true, reason: 'duplicate' };

  const lead = await graphGet(
    leadgenId,
    'id,created_time,field_data,form_id,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,platform'
  );
  const form = lead.form_id ? await graphGet(lead.form_id, 'id,name').catch(() => null) : null;
  const fields = fieldDataToMap(lead.field_data);
  const name = clean(getField(fields, ['full_name', 'first_name', 'name'])) || 'Meta Lead';
  const phone = clean(getField(fields, ['phone_number', 'phone'])) || 'Не вказано';

  await saveLead(lead, fields, form?.name || null);

  const answers = Object.entries(fields)
    .map(([key, value]) => `<b>${htmlEscape(key)}:</b> ${htmlEscape(value)}`)
    .join('\n');

  const message = `
<b>🔔 Новий лід з Meta Instant Form</b>
<b>Форма:</b> ${htmlEscape(form?.name || lead.form_id || 'Не вказано')}
<b>Ім'я:</b> ${htmlEscape(name)}
<b>Телефон:</b> ${htmlEscape(phone)}
<b>Кампанія:</b> ${htmlEscape(lead.campaign_name || lead.campaign_id || 'Не вказано')}
<b>Оголошення:</b> ${htmlEscape(lead.ad_name || lead.ad_id || 'Не вказано')}

${answers}
  `.trim();

  const telegramSent = await sendTelegram(message);
  return { skipped: false, lead_id: lead.id, telegramSent };
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];
    const expectedToken = await getConfiguredValue(
      ['META_WEBHOOK_VERIFY_TOKEN'],
      ['meta_webhook_verify_token', 'META_WEBHOOK_VERIFY_TOKEN']
    );

    if (mode === 'subscribe' && token && expectedToken && token === expectedToken) {
      return res.status(200).send(challenge);
    }

    return res.status(403).json({ error: 'Webhook verification failed' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const processed: any[] = [];

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;
        const value = change.value || {};
        if (!value.leadgen_id) continue;

        processed.push(
          await processLead(value.leadgen_id, value.form_id, value.ad_id)
        );
      }
    }

    return res.status(200).json({ success: true, processed });
  } catch (error: any) {
    console.error('Meta lead webhook failed:', error);
    return res.status(500).json({ error: error?.message || 'Webhook failed' });
  }
}
