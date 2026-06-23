import fetch from 'node-fetch';
import pkg from 'pg';

const { Pool } = pkg;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

const PAYMENT_VISIBILITY_KEYS = [
  'monobank_payments_enabled',
  'MONOBANK_PAYMENTS_ENABLED',
  'parent_monobank_payments_enabled',
];

const FALSE_VALUES = new Set(['false', '0', 'off', 'disabled', 'hidden', 'hide', 'no']);

const clean = (value: unknown) => {
  if (Array.isArray(value)) return clean(value[0]);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const isEnabledValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return true;
  return !FALSE_VALUES.has(String(value).trim().toLowerCase());
};

function getQuery(req: any) {
  if (req.query) return req.query;
  try {
    const url = new URL(req.url || '/', 'https://shin-karate.kyiv.ua');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

function getAuthHeader(req: any) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  return Array.isArray(header) ? header[0] : header;
}

async function readPaymentVisibility() {
  if (!pool) return true;

  try {
    const result = await pool.query('SELECT key, value FROM settings WHERE key = ANY($1)', [PAYMENT_VISIBILITY_KEYS]);
    for (const key of PAYMENT_VISIBILITY_KEYS) {
      const row = result.rows.find((item: any) => item.key === key);
      if (row) return isEnabledValue(row.value);
    }
  } catch (error) {
    console.error('Failed to read Monobank payment visibility:', error);
  }

  return true;
}

const getParentBotUsername = () => clean(process.env.TELEGRAM_PARENT_BOT_USERNAME) || 'karate_kyiv_bot';

const getTelegramWebhookUrl = () => {
  const baseUrl =
    clean(process.env.APP_URL) ||
    clean(process.env.PUBLIC_SITE_URL) ||
    clean(process.env.SITE_URL) ||
    'https://shin-karate.kyiv.ua';
  return `${baseUrl.replace(/\/+$/, '')}/api/telegram/parent-webhook`;
};

function sanitizeWebhookInfo(result: any) {
  if (!result || typeof result !== 'object') return null;
  return {
    url: clean(result.url) || '',
    pendingUpdateCount: Number(result.pending_update_count || 0),
    lastErrorDate: result.last_error_date || null,
    lastErrorMessage: clean(result.last_error_message) || null,
    maxConnections: result.max_connections || null,
    allowedUpdates: Array.isArray(result.allowed_updates) ? result.allowed_updates : null,
  };
}

async function callParentTelegram(method: string, payload?: Record<string, any>) {
  const token = clean(process.env.TELEGRAM_PARENT_BOT_TOKEN);
  if (!token) return { ok: false, skipped: 'TELEGRAM_PARENT_BOT_TOKEN is not configured' };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok || data?.ok === false) {
      return {
        ok: false,
        status: response.status,
        description: clean(data?.description) || text.slice(0, 240) || 'Telegram API request failed',
      };
    }

    return { ok: true, result: data?.result };
  } catch (error: any) {
    return { ok: false, description: clean(error?.message) || 'Telegram API request failed' };
  }
}

async function handleTelegramBotInfo(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botUsername = getParentBotUsername();
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ botUsername, username: botUsername });
}

async function handleTelegramWebhookStatus(req: any, res: any) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = clean(process.env.CRON_SECRET);
  if (cronSecret && getAuthHeader(req) !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const desiredUrl = getTelegramWebhookUrl();
  const before = await callParentTelegram('getWebhookInfo');
  const beforeInfo = sanitizeWebhookInfo((before as any).result);
  let setWebhook: any = null;

  if (!before.ok || beforeInfo?.url !== desiredUrl || clean(getQuery(req).force) === '1') {
    const payload: Record<string, any> = {
      url: desiredUrl,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    };
    const secretToken = clean(process.env.TELEGRAM_PARENT_WEBHOOK_SECRET);
    if (secretToken) payload.secret_token = secretToken;
    setWebhook = await callParentTelegram('setWebhook', payload);
  }

  const after = await callParentTelegram('getWebhookInfo');
  const afterInfo = sanitizeWebhookInfo((after as any).result);

  return res.status(200).json({
    ok: Boolean(after.ok && afterInfo?.url === desiredUrl),
    configured: Boolean(after.ok && afterInfo?.url === desiredUrl),
    desiredUrl,
    before: beforeInfo,
    webhook: afterInfo,
    setWebhook: setWebhook
      ? {
          ok: Boolean(setWebhook.ok),
          description: clean(setWebhook.description) || null,
        }
      : null,
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  const mode = clean(getQuery(req).mode);
  if (mode === 'telegram-webhook-status') {
    return handleTelegramWebhookStatus(req, res);
  }
  if (mode === 'telegram-bot-info') {
    return handleTelegramBotInfo(req, res);
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const enabled = await readPaymentVisibility();
  return res.status(200).json({
    success: true,
    enabled,
    monobankPaymentsEnabled: enabled,
  });
}
