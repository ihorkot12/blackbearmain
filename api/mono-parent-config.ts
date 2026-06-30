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

type AuthenticatedUser = {
  id: number;
  role: AuthTokenRole;
  name?: string | null;
  coach_id?: number | null;
  accessId?: number | null;
};

type TelegramDeliveryStats = {
  sent: number;
  skipped: number;
  failed: number;
  recipients: number;
};

const PAYMENT_VISIBILITY_KEYS = [
  'monobank_payments_enabled',
  'MONOBANK_PAYMENTS_ENABLED',
  'parent_monobank_payments_enabled',
];

const FALSE_VALUES = new Set(['false', '0', 'off', 'disabled', 'hidden', 'hide', 'no']);
const AUTH_TOKEN_PREFIX = 'bb1';
const START_TOKEN_TTL_MINUTES = 20;
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.DATABASE_URL
    ? crypto.createHash('sha256').update(`black-bear-session:${process.env.DATABASE_URL}`).digest('hex')
    : 'black-bear-local-dev-secret');
const ADMIN_TOKEN = crypto.createHash('sha256').update(SESSION_SECRET + 'admin-token-v1').digest('hex');

const IMPORTANT_TELEGRAM_TYPES = [
  'homework',
  'homework_review',
  'payment',
  'message',
  'manual',
  'announcement',
  'absence',
  'birthday',
  'personal_event',
  'coach_message'
];

const clean = (value: unknown) => {
  if (Array.isArray(value)) return clean(value[0]);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const normalizeDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const normalizeLogin = (value: unknown) => String(value ?? '').trim();
const normalizePhone = (value: unknown) => String(value ?? '').replace(/[^\d+]/g, '');
const lower = (value: unknown) => String(value ?? '').trim().toLowerCase();

function formatAmount(amountUah: number) {
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: Number.isInteger(amountUah) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountUah);
}

function htmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

async function readJsonBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

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

function getBearerPayload(req: any): AuthTokenPayload | null {
  const authValue = getAuthHeader(req);
  if (!authValue?.startsWith('Bearer ')) return null;
  return verifyAuthToken(authValue.slice('Bearer '.length));
}

async function getRequestUser(req: any): Promise<AuthenticatedUser | null> {
  if (!pool) return null;
  const authValue = getAuthHeader(req);
  if (authValue === `Bearer ${ADMIN_TOKEN}`) {
    return { id: 0, role: 'admin', name: 'System' };
  }

  const payload = getBearerPayload(req);
  if (!payload) return null;
  const id = Number(payload.sub);
  if (!Number.isInteger(id) || id <= 0) return null;

  if (payload.role === 'parent') {
    const result = await pool.query('SELECT id, name FROM participants WHERE id = $1 LIMIT 1', [id]);
    if (!result.rows[0]) return null;
    return { id, role: 'parent', name: result.rows[0].name, accessId: payload.accessId ?? null };
  }

  const result = await pool.query('SELECT id, role, name, coach_id FROM admin_users WHERE id = $1 LIMIT 1', [id]);
  const user = result.rows[0];
  if (!user) return null;
  return {
    id,
    role: user.role === 'coach' ? 'coach' : 'admin',
    name: user.name,
    coach_id: user.coach_id ? Number(user.coach_id) : null,
  };
}

async function getSettingsValue(keys: string[]) {
  if (!pool) return null;

  try {
    const result = await pool.query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys]);
    for (const key of keys) {
      const value = clean(result.rows.find((row: any) => row.key === key)?.value);
      if (value) return value;
    }
  } catch {
    // Optional table on older deployments.
  }

  try {
    const result = await pool.query('SELECT key, value FROM site_content WHERE key = ANY($1)', [keys]);
    for (const key of keys) {
      const value = clean(result.rows.find((row: any) => row.key === key)?.value);
      if (value) return value;
    }
  } catch {
    // Optional table on older deployments.
  }

  return null;
}

async function getConfiguredValue(envKeys: string[], settingKeys: string[]) {
  for (const key of envKeys) {
    const value = clean(process.env[key]);
    if (value) return value;
  }
  return getSettingsValue(settingKeys);
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
const getParentBotToken = () => clean(process.env.TELEGRAM_PARENT_BOT_TOKEN);
const getPortalBaseUrl = () =>
  (clean(process.env.APP_URL) || clean(process.env.PUBLIC_SITE_URL) || clean(process.env.SITE_URL) || 'https://shin-karate.kyiv.ua').replace(/\/+$/, '');

const getTelegramWebhookUrl = () => `${getPortalBaseUrl()}/api/telegram/parent-webhook`;
const KYIV_TIME_ZONE = 'Europe/Kyiv';

function getKyivDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KYIV_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

async function ensureTelegramMessagingSchema() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,
      sender_id INTEGER,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type TEXT;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id TEXT;
    ALTER TABLE participants ADD COLUMN IF NOT EXISTS attendance_frozen BOOLEAN DEFAULT FALSE;
    ALTER TABLE participants ADD COLUMN IF NOT EXISTS attendance_frozen_until DATE;
    ALTER TABLE participants ADD COLUMN IF NOT EXISTS attendance_freeze_note TEXT;
    ALTER TABLE participant_accesses ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
    ALTER TABLE participant_accesses ADD COLUMN IF NOT EXISTS telegram_connected_at TIMESTAMP;
    ALTER TABLE participant_accesses ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE coaches ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE coaches ADD COLUMN IF NOT EXISTS telegram_username TEXT;
    ALTER TABLE coaches ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

    CREATE TABLE IF NOT EXISTS telegram_link_tokens (
      token_hash TEXT PRIMARY KEY,
      participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      access_id INTEGER REFERENCES participant_accesses(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS telegram_subscriptions (
      id SERIAL PRIMARY KEY,
      participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      access_id INTEGER REFERENCES participant_accesses(id) ON DELETE SET NULL,
      telegram_chat_id TEXT NOT NULL,
      telegram_user_id TEXT,
      telegram_username TEXT,
      telegram_first_name TEXT,
      telegram_last_name TEXT,
      role TEXT DEFAULT 'guardian',
      enabled BOOLEAN DEFAULT TRUE,
      connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      disabled_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS access_id INTEGER REFERENCES participant_accesses(id) ON DELETE SET NULL;
    ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS telegram_user_id TEXT;
    ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS telegram_username TEXT;
    ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS telegram_first_name TEXT;
    ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS telegram_last_name TEXT;
    ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'guardian';
    ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP;
    ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_subscriptions_participant_chat
      ON telegram_subscriptions(participant_id, telegram_chat_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_subscriptions_chat_id ON telegram_subscriptions(telegram_chat_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_subscriptions_access_id ON telegram_subscriptions(access_id);

    CREATE TABLE IF NOT EXISTS telegram_notification_deliveries (
      id SERIAL PRIMARY KEY,
      notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
      participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
      telegram_chat_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      error TEXT,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_notification_delivery_unique
      ON telegram_notification_deliveries(notification_id, telegram_chat_id);
  `);
}

async function getParentFamilyParticipantIds(participantId: number): Promise<number[]> {
  if (!pool) return [];
  const meRes = await pool.query('SELECT parent_login, parent_phone, phone FROM participants WHERE id = $1', [participantId]);
  if (meRes.rows.length === 0) return [];

  const { parent_login, parent_phone, phone } = meRes.rows[0];
  const accessRes = await pool.query(
    'SELECT login, phone FROM participant_accesses WHERE participant_id = $1 AND can_login = TRUE',
    [participantId]
  );

  const loginIdentifiers = new Set<string>();
  const phoneIdentifiers = new Set<string>();
  const addLogin = (value: unknown) => {
    const normalized = normalizeLogin(value).toLowerCase();
    if (normalized) loginIdentifiers.add(normalized);
  };
  const addPhone = (value: unknown) => {
    const normalized = normalizePhone(value).replace(/\D/g, '');
    if (normalized) phoneIdentifiers.add(normalized);
  };

  addLogin(parent_login);
  addPhone(parent_phone);
  addPhone(phone);
  accessRes.rows.forEach((access: any) => {
    addLogin(access.login);
    addPhone(access.phone);
    addPhone(access.login);
  });

  const params: any[] = [participantId];
  const clauses: string[] = [];
  const loginParams = Array.from(loginIdentifiers);
  const phoneParams = Array.from(phoneIdentifiers);

  if (loginParams.length > 0) {
    params.push(loginParams);
    clauses.push(`(
      LOWER(TRIM(COALESCE(p.parent_login, ''))) = ANY($${params.length}::text[])
      OR EXISTS (
        SELECT 1 FROM participant_accesses pa
        WHERE pa.participant_id = p.id
        AND LOWER(TRIM(COALESCE(pa.login, ''))) = ANY($${params.length}::text[])
      )
    )`);
  }

  if (phoneParams.length > 0) {
    params.push(phoneParams);
    clauses.push(`(
      REGEXP_REPLACE(COALESCE(p.parent_phone, ''), '[^0-9]', '', 'g') = ANY($${params.length}::text[])
      OR REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g') = ANY($${params.length}::text[])
      OR REGEXP_REPLACE(COALESCE(p.parent_login, ''), '[^0-9]', '', 'g') = ANY($${params.length}::text[])
      OR EXISTS (
        SELECT 1 FROM participant_accesses pa
        WHERE pa.participant_id = p.id
        AND (
          REGEXP_REPLACE(COALESCE(pa.phone, ''), '[^0-9]', '', 'g') = ANY($${params.length}::text[])
          OR REGEXP_REPLACE(COALESCE(pa.login, ''), '[^0-9]', '', 'g') = ANY($${params.length}::text[])
        )
      )
    )`);
  }

  const result = await pool.query(
    clauses.length > 0
      ? `SELECT DISTINCT p.id FROM participants p WHERE p.id = $1 OR (${clauses.join(' OR ')})`
      : 'SELECT DISTINCT p.id FROM participants p WHERE p.id = $1',
    params
  );
  return result.rows.map((row: any) => Number(row.id)).filter((id: number) => Number.isFinite(id));
}

async function canAccessParticipant(user: AuthenticatedUser | null, participantId: number): Promise<boolean> {
  if (!pool || !user || !Number.isInteger(participantId) || participantId <= 0) return false;
  if (user.role === 'admin') return true;

  if (user.role === 'coach') {
    if (!user.coach_id) return false;
    const result = await pool.query(`
      SELECT p.id
      FROM participants p
      LEFT JOIN groups g ON p.group_id = g.id
      WHERE p.id = $1 AND g.coach_id = $2
      LIMIT 1
    `, [participantId, user.coach_id]);
    return result.rows.length > 0;
  }

  const familyIds = await getParentFamilyParticipantIds(user.id);
  return familyIds.includes(participantId);
}

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

async function callTelegramToken(token: string | null, method: string, payload?: Record<string, any>) {
  if (!token) return { ok: false, skipped: 'missing_token' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(payload || {}),
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

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
  } finally {
    clearTimeout(timeout);
  }
}

async function callParentTelegram(method: string, payload?: Record<string, any>) {
  return callTelegramToken(getParentBotToken(), method, payload);
}

async function sendParentTelegram(chatId: string, text: string, replyMarkup?: any) {
  return callParentTelegram('sendMessage', {
    chat_id: chatId,
    text: text.length > 3900 ? `${text.slice(0, 3880)}...` : text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
}

async function sendCoachTelegram(chatId: string, text: string, replyMarkup?: any) {
  const payload = {
    chat_id: chatId,
    text: text.length > 3900 ? `${text.slice(0, 3880)}...` : text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  };

  const parentResult = await callParentTelegram('sendMessage', payload);
  if (parentResult.ok) return parentResult;

  const legacyToken = clean(process.env.TELEGRAM_BOT_TOKEN);
  if (legacyToken && legacyToken !== getParentBotToken()) {
    return callTelegramToken(legacyToken, 'sendMessage', payload);
  }

  return parentResult;
}

function inlineUrlKeyboard(label: string, url: string) {
  return { inline_keyboard: [[{ text: label, url }]] };
}

function inlineRowsKeyboard(rows: Array<Array<{ text: string; url?: string; callback_data?: string }>>) {
  return { inline_keyboard: rows };
}

async function answerParentTelegramCallback(callbackQueryId: string | null, text?: string) {
  if (!callbackQueryId) return { ok: false, skipped: 'missing_callback_query_id' };
  return callParentTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

async function sendPaymentAdminTelegram(text: string) {
  const token = await getConfiguredValue(
    ['TELEGRAM_BOT_TOKEN'],
    ['telegram_bot_token', 'TELEGRAM_BOT_TOKEN']
  );
  const chatId = await getConfiguredValue(
    ['TELEGRAM_PAYMENT_CHAT_ID', 'MONOBANK_PAYMENT_CHAT_ID', 'TELEGRAM_CHAT_ID'],
    ['telegram_payment_chat_id', 'monobank_payment_chat_id', 'telegram_chat_id', 'TELEGRAM_PAYMENT_CHAT_ID', 'MONOBANK_PAYMENT_CHAT_ID', 'TELEGRAM_CHAT_ID']
  );
  if (!token || !chatId) return { ok: false, skipped: 'missing_payment_chat' };

  return callTelegramToken(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

async function reserveTelegramDelivery(notificationId: number, participantId: number, chatId: string) {
  if (!pool) return null;
  const result = await pool.query(
    `INSERT INTO telegram_notification_deliveries
       (notification_id, participant_id, telegram_chat_id, status, updated_at)
     VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
      ON CONFLICT (notification_id, telegram_chat_id)
      DO UPDATE SET
        status = CASE WHEN telegram_notification_deliveries.status = 'sent' THEN telegram_notification_deliveries.status ELSE 'pending' END,
        error = CASE WHEN telegram_notification_deliveries.status = 'sent' THEN telegram_notification_deliveries.error ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
      WHERE telegram_notification_deliveries.status IS DISTINCT FROM 'sent'
        AND telegram_notification_deliveries.updated_at < CURRENT_TIMESTAMP - INTERVAL '3 days'
      RETURNING id`,
    [notificationId, participantId, chatId]
  );
  return result.rows[0]?.id || null;
}

async function markTelegramDelivery(id: number, status: string, error?: string) {
  if (!pool) return;
  await pool.query(
    `UPDATE telegram_notification_deliveries
     SET status = $2,
         error = $3,
         sent_at = CASE WHEN $2 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id, status, error || null]
  );
}

const matchesFamilyAccess = (target: any, subscription: any) => {
  if (Number(subscription.participant_id) === Number(target.id)) return true;
  if (subscription.access_type === 'child') return false;

  const targetLogins = new Set([lower(target.parent_login)].filter(Boolean));
  const targetPhones = new Set([
    normalizeDigits(target.parent_phone),
    normalizeDigits(target.phone),
    normalizeDigits(target.parent_login),
  ].filter(Boolean));

  const accessLogin = lower(subscription.login);
  const accessPhoneDigits = normalizeDigits(subscription.phone || subscription.login);
  return Boolean(
    (accessLogin && targetLogins.has(accessLogin)) ||
    (accessPhoneDigits && targetPhones.has(accessPhoneDigits))
  );
};

async function getTelegramRecipientsForParticipant(participantId: number) {
  if (!pool) return [];
  const targetRes = await pool.query(
    'SELECT id, parent_login, parent_phone, phone, telegram_chat_id FROM participants WHERE id = $1 LIMIT 1',
    [participantId]
  );
  const target = targetRes.rows[0];
  if (!target) return [];

  const recipients = new Map<string, { chatId: string; participantId: number; accessId?: number | null }>();
  if (target.telegram_chat_id) {
    recipients.set(String(target.telegram_chat_id), { chatId: String(target.telegram_chat_id), participantId: Number(target.id), accessId: null });
  }

  const subs = await pool.query(`
    SELECT ts.telegram_chat_id, ts.participant_id, ts.access_id, pa.access_type, pa.login, pa.phone
    FROM telegram_subscriptions ts
    LEFT JOIN participant_accesses pa ON pa.id = ts.access_id
    WHERE ts.enabled = TRUE
  `);

  for (const sub of subs.rows) {
    if (!sub.telegram_chat_id) continue;
    if (matchesFamilyAccess(target, sub)) {
      recipients.set(String(sub.telegram_chat_id), {
        chatId: String(sub.telegram_chat_id),
        participantId: Number(sub.participant_id),
        accessId: sub.access_id ? Number(sub.access_id) : null,
      });
    }
  }

  return Array.from(recipients.values());
}

async function deliverNotificationNow(params: {
  notificationId: number;
  participantId: number;
  participantName?: string | null;
  label: string;
  message: string;
  tab?: string;
}): Promise<TelegramDeliveryStats> {
  const recipients = await getTelegramRecipientsForParticipant(params.participantId);
  const stats = { sent: 0, skipped: 0, failed: 0, recipients: recipients.length };
  if (recipients.length === 0) return stats;

  for (const recipient of recipients) {
    const deliveryId = await reserveTelegramDelivery(params.notificationId, params.participantId, recipient.chatId);
    if (!deliveryId) {
      stats.skipped += 1;
      continue;
    }

    const result = await sendParentTelegram(
      recipient.chatId,
      `<b>${htmlEscape(params.label)}</b>\n${htmlEscape(params.participantName || '')}\n${htmlEscape(params.message)}`,
      inlineUrlKeyboard('Відкрити кабінет', `${getPortalBaseUrl()}/parent?tab=${encodeURIComponent(params.tab || 'notifications')}`)
    );

    if (result.ok) {
      stats.sent += 1;
      await markTelegramDelivery(Number(deliveryId), 'sent');
    } else {
      stats.failed += 1;
      await markTelegramDelivery(Number(deliveryId), 'failed', JSON.stringify(result).slice(0, 500));
    }
  }

  return stats;
}

async function createNotificationAndDeliver(params: {
  participantId: number;
  type: string;
  message: string;
  referenceType?: string | null;
  referenceId?: string | null;
  label?: string;
  tab?: string;
}) {
  if (!pool) return { sent: 0, skipped: 0, failed: 0, recipients: 0 };

  const participant = await pool.query('SELECT name FROM participants WHERE id = $1 LIMIT 1', [params.participantId]);
  const notification = await pool.query(
    `INSERT INTO notifications (participant_id, type, message, reference_type, reference_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [params.participantId, params.type, params.message, params.referenceType || null, params.referenceId || null]
  );

  return deliverNotificationNow({
    notificationId: Number(notification.rows[0].id),
    participantId: params.participantId,
    participantName: participant.rows[0]?.name,
    label: params.label || 'Важливе повідомлення',
    message: params.message,
    tab: params.tab || 'notifications',
  });
}

async function getParentSenderLabel(user: AuthenticatedUser, participantId: number) {
  if (!pool) return user.name || 'Батьки';
  if (user.accessId) {
    const access = await pool.query('SELECT access_type, name, phone, login FROM participant_accesses WHERE id = $1 AND participant_id = $2 LIMIT 1', [user.accessId, participantId]);
    const row = access.rows[0];
    if (row) {
      const role = row.access_type === 'father' ? 'тато' : row.access_type === 'mother' ? 'мама' : row.access_type === 'child' ? 'дитина' : 'контакт';
      return `${row.name || row.phone || row.login || 'Сімейний доступ'} (${role})`;
    }
  }

  const participant = await pool.query('SELECT parent_name, parent_phone, parent_login FROM participants WHERE id = $1 LIMIT 1', [participantId]);
  const row = participant.rows[0] || {};
  return row.parent_name || row.parent_phone || row.parent_login || user.name || 'Батьки';
}

async function notifyCoachAboutParentMessage(user: AuthenticatedUser, participantId: number, content: string) {
  if (!pool) return { sent: 0, skipped: 0, failed: 0, recipients: 0 };

  const info = await pool.query(`
    SELECT p.name AS participant_name,
           p.parent_name,
           g.name AS group_name,
           c.id AS coach_id,
           c.name AS coach_name,
           c.telegram_chat_id,
           c.telegram_username
    FROM participants p
    LEFT JOIN groups g ON g.id = p.group_id
    LEFT JOIN coaches c ON c.id = g.coach_id
    WHERE p.id = $1
    LIMIT 1
  `, [participantId]);

  const row = info.rows[0] || {};
  const senderLabel = await getParentSenderLabel(user, participantId);
  const coachName = row.coach_name || 'тренер';
  const text = [
    '<b>Нове повідомлення в кабінеті</b>',
    `<b>Від:</b> ${htmlEscape(senderLabel)}`,
    `<b>Кому:</b> ${htmlEscape(coachName)}`,
    `<b>Учасник:</b> ${htmlEscape(row.participant_name || participantId)}`,
    row.group_name ? `<b>Група:</b> ${htmlEscape(row.group_name)}` : '',
    '',
    htmlEscape(content),
  ].filter(Boolean).join('\n');

  const stats = { sent: 0, skipped: 0, failed: 0, recipients: 0 };
  const chatIds = new Set<string>();
  if (row.telegram_chat_id) chatIds.add(String(row.telegram_chat_id));

  const fallbackChat = await getConfiguredValue(
    ['TELEGRAM_COACH_ALERT_CHAT_ID', 'TELEGRAM_ADMIN_CHAT_ID', 'TELEGRAM_CHAT_ID'],
    ['telegram_coach_alert_chat_id', 'telegram_admin_chat_id', 'telegram_chat_id', 'TELEGRAM_COACH_ALERT_CHAT_ID', 'TELEGRAM_ADMIN_CHAT_ID', 'TELEGRAM_CHAT_ID']
  );
  if (fallbackChat) chatIds.add(fallbackChat);

  stats.recipients = chatIds.size;
  if (chatIds.size === 0) return stats;

  for (const chatId of chatIds) {
    const result = await sendCoachTelegram(chatId, text, inlineUrlKeyboard('Відкрити адмінку', `${getPortalBaseUrl()}/admin`));
    if (result.ok) stats.sent += 1;
    else stats.failed += 1;
  }

  return stats;
}

async function handleMessages(req: any, res: any) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!pool) return res.status(500).json({ error: 'Database not configured' });
  await ensureTelegramMessagingSchema();

  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const query = getQuery(req);

  if (req.method === 'GET') {
    const participantId = Number(query.participantId);
    if (!Number.isInteger(participantId) || participantId <= 0) return res.status(400).json({ error: 'Invalid participant id' });
    if (!(await canAccessParticipant(user, participantId))) return res.status(403).json({ error: 'Forbidden' });

    const result = await pool.query('SELECT * FROM messages WHERE participant_id = $1 ORDER BY created_at ASC', [participantId]);
    return res.status(200).json(result.rows);
  }

  if (req.method === 'DELETE') {
    if (user.role === 'parent') return res.status(403).json({ error: 'Forbidden' });
    let result;
    if (user.role === 'admin') {
      result = await pool.query('DELETE FROM messages');
    } else if (user.role === 'coach' && user.coach_id) {
      result = await pool.query(`
        DELETE FROM messages
        WHERE participant_id IN (
          SELECT p.id FROM participants p
          JOIN groups g ON p.group_id = g.id
          WHERE g.coach_id = $1
        )
      `, [user.coach_id]);
    }
    return res.status(200).json({ success: true, deleted: result?.rowCount || 0 });
  }

  const body = await readJsonBody(req);
  const participantId = Number(body.participant_id);
  const content = String(body.content || '').trim();
  if (!Number.isInteger(participantId) || participantId <= 0) return res.status(400).json({ error: 'Invalid participant id' });
  if (!content) return res.status(400).json({ error: 'Message is required' });
  if (content.length > 2000) return res.status(400).json({ error: 'Message is too long' });
  if (!(await canAccessParticipant(user, participantId))) return res.status(403).json({ error: 'Forbidden' });

  const actualSenderType = user.role === 'parent'
    ? 'parent'
    : user.role === 'admin'
      ? (body.sender_type === 'admin' ? 'admin' : 'coach')
      : 'coach';
  const senderId = actualSenderType === 'parent' ? null : (actualSenderType === 'coach' ? (user.coach_id || user.id) : user.id);

  const result = await pool.query(
    'INSERT INTO messages (participant_id, content, sender_type, sender_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [participantId, content, actualSenderType, senderId]
  );
  const messageRow = result.rows[0];

  let telegram: TelegramDeliveryStats;
  if (actualSenderType === 'parent') {
    telegram = await notifyCoachAboutParentMessage(user, participantId, content);
  } else {
    const senderName = user.name || (actualSenderType === 'admin' ? 'Адміністратор' : 'Тренер');
    telegram = await createNotificationAndDeliver({
      participantId,
      type: 'coach_message',
      message: `Нове повідомлення від ${senderName}: ${content}`,
      referenceType: 'message',
      referenceId: String(messageRow.id),
      label: 'Повідомлення від тренера',
      tab: 'messages',
    });
  }

  return res.status(200).json({ ...messageRow, telegram });
}

async function handleAdminNotify(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!pool) return res.status(500).json({ error: 'Database not configured' });
  await ensureTelegramMessagingSchema();

  const user = await getRequestUser(req);
  if (!user || user.role === 'parent') return res.status(401).json({ error: 'Unauthorized' });

  const body = await readJsonBody(req);
  const participantId = Number(body.participantId || body.participant_id);
  const message = String(body.message || '').trim();
  if (!Number.isInteger(participantId) || participantId <= 0) return res.status(400).json({ error: 'Invalid participant id' });
  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (!(await canAccessParticipant(user, participantId))) return res.status(403).json({ error: 'Forbidden' });

  const telegram = await createNotificationAndDeliver({
    participantId,
    type: 'coach_message',
    message,
    referenceType: 'manual_message',
    referenceId: null,
    label: 'Повідомлення від тренера',
    tab: 'messages',
  });

  return res.status(200).json({ success: true, telegram });
}

async function handleAdminNotifyMass(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!pool) return res.status(500).json({ error: 'Database not configured' });
  await ensureTelegramMessagingSchema();

  const user = await getRequestUser(req);
  if (!user || user.role === 'parent') return res.status(401).json({ error: 'Unauthorized' });

  const body = await readJsonBody(req);
  const message = String(body.message || '').trim();
  const groupId = clean(body.group_id);
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const params: any[] = [];
  let query = `
    SELECT p.id
    FROM participants p
    LEFT JOIN groups g ON p.group_id = g.id
    WHERE p.status = 'active'
  `;
  if (user.role === 'coach') {
    if (!user.coach_id) return res.status(403).json({ error: 'Forbidden' });
    params.push(user.coach_id);
    query += ` AND g.coach_id = $${params.length}`;
  }
  if (groupId && groupId !== 'all') {
    params.push(Number(groupId));
    query += ` AND p.group_id = $${params.length}`;
  }

  const participants = await pool.query(query, params);
  const totals = { created: 0, sent: 0, skipped: 0, failed: 0, recipients: 0 };

  for (const participant of participants.rows) {
    const stats = await createNotificationAndDeliver({
      participantId: Number(participant.id),
      type: 'announcement',
      message,
      referenceType: 'announcement',
      referenceId: null,
      label: 'Важливе оголошення',
      tab: 'notifications',
    });
    totals.created += 1;
    totals.sent += stats.sent;
    totals.skipped += stats.skipped;
    totals.failed += stats.failed;
    totals.recipients += stats.recipients;
  }

  return res.status(200).json({ success: true, count: participants.rows.length, telegram: totals });
}

const hashStartToken = (token: string) =>
  crypto.createHash('sha256').update(`${SESSION_SECRET}:telegram-start:${token}`).digest('hex');

async function consumeTelegramStartToken(token: string) {
  if (!pool || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const tokenHash = hashStartToken(token);
  const result = await pool.query(
    `UPDATE telegram_link_tokens
     SET used_at = CURRENT_TIMESTAMP
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > CURRENT_TIMESTAMP
     RETURNING participant_id, access_id`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function connectTelegramChat(params: { participantId: number; accessId: number | null; chatId: string; user?: any }) {
  if (!pool) return;
  const accessRes = params.accessId
    ? await pool.query('SELECT access_type FROM participant_accesses WHERE id = $1 LIMIT 1', [params.accessId])
    : { rows: [] };
  const role = accessRes.rows[0]?.access_type || 'guardian';

  await pool.query(
    `INSERT INTO telegram_subscriptions
       (participant_id, access_id, telegram_chat_id, telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, role, enabled, connected_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (participant_id, telegram_chat_id)
     DO UPDATE SET
       access_id = EXCLUDED.access_id,
       telegram_user_id = EXCLUDED.telegram_user_id,
       telegram_username = EXCLUDED.telegram_username,
       telegram_first_name = EXCLUDED.telegram_first_name,
       telegram_last_name = EXCLUDED.telegram_last_name,
       role = EXCLUDED.role,
       enabled = TRUE,
       disabled_at = NULL,
       connected_at = COALESCE(telegram_subscriptions.connected_at, CURRENT_TIMESTAMP),
       updated_at = CURRENT_TIMESTAMP`,
    [
      params.participantId,
      params.accessId,
      params.chatId,
      params.user?.id ? String(params.user.id) : null,
      params.user?.username || null,
      params.user?.first_name || null,
      params.user?.last_name || null,
      role,
    ]
  );

  if (params.accessId) {
    await pool.query(
      `UPDATE participant_accesses
       SET telegram_chat_id = $1,
           telegram_connected_at = CURRENT_TIMESTAMP,
           telegram_enabled = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [params.chatId, params.accessId]
    );
  }

  await pool.query('UPDATE participants SET telegram_chat_id = $1 WHERE id = $2', [params.chatId, params.participantId]);
}

async function disableTelegramChat(chatId: string) {
  if (!pool) return;
  await pool.query(
    `UPDATE telegram_subscriptions
     SET enabled = FALSE, disabled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE telegram_chat_id = $1`,
    [chatId]
  );
  await pool.query(
    `UPDATE participant_accesses
     SET telegram_enabled = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE telegram_chat_id = $1`,
    [chatId]
  );
  await pool.query(
    `UPDATE participants p
     SET telegram_chat_id = (
       SELECT ts.telegram_chat_id
       FROM telegram_subscriptions ts
       WHERE ts.participant_id = p.id
         AND ts.enabled = TRUE
       ORDER BY ts.connected_at DESC NULLS LAST, ts.updated_at DESC NULLS LAST
       LIMIT 1
     )
     WHERE p.telegram_chat_id = $1`,
    [chatId]
  );
}

async function getParticipantIdsForChat(chatId: string) {
  if (!pool) return [];
  const subRes = await pool.query(`
    SELECT ts.participant_id, ts.access_id, pa.access_type, pa.login, pa.phone, p.member_type
    FROM telegram_subscriptions ts
    JOIN participants p ON p.id = ts.participant_id
    LEFT JOIN participant_accesses pa ON pa.id = ts.access_id
    WHERE ts.telegram_chat_id = $1 AND ts.enabled = TRUE
    ORDER BY ts.connected_at DESC
    LIMIT 10
  `, [chatId]);

  const ids = new Set<number>();
  for (const sub of subRes.rows) {
    const participantId = Number(sub.participant_id);
    if (!Number.isInteger(participantId)) continue;

    if (sub.member_type === 'adult' || sub.access_type === 'child') {
      ids.add(participantId);
      continue;
    }

    const familyRes = await pool.query(`
      SELECT DISTINCT p.id
      FROM participants p
      WHERE p.id = $1
         OR LOWER(TRIM(COALESCE(p.parent_login, ''))) = LOWER(TRIM($2))
         OR REGEXP_REPLACE(COALESCE(p.parent_phone, ''), '[^0-9]', '', 'g') = $3
         OR REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g') = $3
         OR EXISTS (
           SELECT 1
           FROM participant_accesses pa
           WHERE pa.participant_id = p.id
             AND (
               LOWER(TRIM(COALESCE(pa.login, ''))) = LOWER(TRIM($2))
               OR REGEXP_REPLACE(COALESCE(pa.phone, ''), '[^0-9]', '', 'g') = $3
               OR REGEXP_REPLACE(COALESCE(pa.login, ''), '[^0-9]', '', 'g') = $3
             )
         )
      ORDER BY p.id ASC
      LIMIT 20
    `, [participantId, sub.login || '', normalizeDigits(sub.phone || sub.login)]);
    familyRes.rows.forEach((row: any) => ids.add(Number(row.id)));
  }

  return Array.from(ids).filter(id => Number.isInteger(id) && id > 0);
}

function mainReplyKeyboard() {
  return {
    keyboard: [
      [{ text: 'Мої діти / Мій профіль' }, { text: 'Домашні завдання' }],
      [{ text: 'Методичка' }, { text: 'Розклад' }],
      [{ text: 'Оплата' }, { text: 'Прогрес' }],
      [{ text: 'Рейтинг' }, { text: 'Зв’язок з тренером' }],
      [{ text: 'Сповіщення' }, { text: 'Відкрити кабінет' }],
      [{ text: 'Instagram' }, { text: 'Facebook' }],
      [{ text: 'Відключити Telegram' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

async function getClubSocialLinks() {
  const instagram = await getConfiguredValue(
    ['CLUB_INSTAGRAM_URL', 'VITE_CLUB_INSTAGRAM_URL', 'PUBLIC_CLUB_INSTAGRAM_URL'],
    ['CLUB_INSTAGRAM_URL', 'club_instagram_url', 'social_instagram', 'instagram_url']
  );
  const facebook = await getConfiguredValue(
    ['CLUB_FACEBOOK_URL', 'VITE_CLUB_FACEBOOK_URL', 'PUBLIC_CLUB_FACEBOOK_URL'],
    ['CLUB_FACEBOOK_URL', 'club_facebook_url', 'social_facebook', 'facebook_url']
  );
  return {
    instagram: instagram || 'https://instagram.com/karate_kyiv',
    facebook: facebook || 'https://www.facebook.com/karatee.kyiv/',
  };
}

function isHttpUrl(value: unknown) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function socialInlineKeyboard() {
  const { instagram, facebook } = await getClubSocialLinks();
  const row: Array<{ text: string; url: string }> = [];
  if (isHttpUrl(instagram)) row.push({ text: 'Instagram', url: String(instagram) });
  if (isHttpUrl(facebook)) row.push({ text: 'Facebook', url: String(facebook) });
  if (row.length === 0) return null;
  return inlineRowsKeyboard([row]);
}

async function inlineUrlWithSocialKeyboard(label: string, url: string) {
  const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [[{ text: label, url }]];
  const social = await socialInlineKeyboard();
  const socialRow = social?.inline_keyboard?.[0];
  if (Array.isArray(socialRow) && socialRow.length > 0) rows.push(socialRow);
  return inlineRowsKeyboard(rows);
}

async function sendTelegramSocialLinks(chatId: string) {
  const keyboard = await socialInlineKeyboard();
  const text = [
    '<b>Підпишіться на клуб BLACK BEAR DOJO</b>',
    'Там публікуємо фото, відео, новини клубу, змагання, атестації та важливі оголошення.',
  ].join('\n\n');

  if (!keyboard) {
    await sendParentTelegram(chatId, `${text}\n\nПосилання ще не додані в налаштування сайту.`);
    return;
  }

  await sendParentTelegram(chatId, text, keyboard);
}

async function requireTelegramConnection(chatId: string) {
  const ids = await getParticipantIdsForChat(chatId);
  if (ids.length > 0) return ids;
  await sendParentTelegram(chatId, 'Telegram ще не підключено до кабінету. Відкрийте кабінет учасника на сайті та натисніть “Підключити Telegram”.');
  return [];
}

async function fetchTelegramParticipants(ids: number[]) {
  if (!pool || ids.length === 0) return [];
  const result = await pool.query(
    `SELECT p.id, p.name, p.member_type, p.belt, p.rank_points, p.payment_status,
            p.attendance_frozen, p.attendance_frozen_until, p.attendance_freeze_note,
            p.group_id,
            g.name AS group_name,
            c.id AS coach_id,
            c.name AS coach_name,
            c.phone AS coach_phone,
            c.telegram_username AS coach_telegram_username,
            l.name AS location_name
     FROM participants p
     LEFT JOIN groups g ON g.id = p.group_id
     LEFT JOIN coaches c ON c.id = g.coach_id
     LEFT JOIN locations l ON l.id = g.location_id
     WHERE p.id = ANY($1::int[])
     ORDER BY CASE WHEN p.member_type = 'adult' THEN 0 ELSE 1 END, p.name ASC`,
    [ids]
  );
  return result.rows;
}

function formatDate(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function paymentLabel(status: unknown) {
  const value = String(status || '').toLowerCase();
  if (['paid', 'оплачено', 'ok', 'success'].includes(value)) return 'Оплачено';
  if (['partial', 'partially_paid'].includes(value)) return 'Частково оплачено';
  return 'Потрібно перевірити оплату';
}

function getKyivDateInputValue(now = new Date()) {
  const { year, month, day } = getKyivDateParts(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isAttendanceFreezeActive(participant: any) {
  if (!participant?.attendance_frozen) return false;
  const until = participant.attendance_frozen_until ? String(participant.attendance_frozen_until).slice(0, 10) : '';
  return !until || until >= getKyivDateInputValue();
}

function participantPaymentLabel(participant: any) {
  if (isAttendanceFreezeActive(participant)) {
    const until = participant.attendance_frozen_until ? ` до ${formatDate(participant.attendance_frozen_until)}` : '';
    return `Канікули${until}`;
  }
  return paymentLabel(participant?.payment_status);
}

function isPaidStatus(status: unknown) {
  return ['paid', 'оплачено', 'ok', 'success'].includes(String(status || '').toLowerCase());
}

function parsePaymentAmount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function getDefaultCashPaymentAmount(rawAmount?: unknown) {
  const directAmount = parsePaymentAmount(rawAmount);
  if (directAmount) return directAmount;

  const configuredAmount = parsePaymentAmount(await getSettingsValue([
    'parent_cash_payment_amount',
    'monthly_subscription_amount',
    'subscription_amount',
    'default_payment_amount',
    'club_monthly_fee'
  ]));
  return configuredAmount || 2500;
}

async function recordTelegramCashPayment(chatId: string, participantIdRaw: unknown) {
  if (!pool) throw new Error('Database not configured');

  const participantId = Number(participantIdRaw);
  if (!Number.isInteger(participantId) || participantId <= 0) {
    return { success: false, error: 'invalid_participant' };
  }

  const availableIds = await requireTelegramConnection(chatId);
  if (!availableIds.includes(participantId)) {
    return { success: false, error: 'forbidden' };
  }

  const { year, month, day } = getKyivDateParts();
  const paymentDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const amount = await getDefaultCashPaymentAmount();

  const participantResult = await pool.query(
    `SELECT p.id, p.name, p.payment_status, g.name AS group_name, c.name AS coach_name
     FROM participants p
     LEFT JOIN groups g ON g.id = p.group_id
     LEFT JOIN coaches c ON c.id = g.coach_id
     WHERE p.id = $1
     LIMIT 1`,
    [participantId]
  );
  const participant = participantResult.rows[0];
  if (!participant) return { success: false, error: 'not_found' };

  const existing = await pool.query(
    `SELECT id, amount
     FROM payments
     WHERE participant_id = $1
       AND month = $2
       AND year = $3
       AND COALESCE(type, 'subscription') = 'subscription'
     ORDER BY created_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [participantId, month, year]
  );

  if (existing.rows[0]) {
    await pool.query("UPDATE participants SET payment_status = 'paid' WHERE id = $1", [participantId]);
    return {
      success: true,
      alreadyPaid: true,
      participantName: participant.name,
      amount: Number(existing.rows[0].amount || amount),
      month,
      year
    };
  }

  const notes = [
    'Відмічено через батьківський Telegram-бот',
    participant.group_name ? `Група: ${participant.group_name}` : '',
    participant.coach_name ? `Тренер: ${participant.coach_name}` : ''
  ].filter(Boolean).join('. ');

  const payment = await pool.query(
    `INSERT INTO payments (participant_id, amount, date, month, year, type, method, notes)
     VALUES ($1, $2, $3, $4, $5, 'subscription', 'cash', $6)
     RETURNING id`,
    [participantId, amount, paymentDate, month, year, notes]
  );

  await pool.query("UPDATE participants SET payment_status = 'paid' WHERE id = $1", [participantId]);

  const message = `Оплата готівкою на тренуванні зарахована: ${formatAmount(amount)} грн.`;
  await pool.query(
    `INSERT INTO notifications (participant_id, type, message, reference_type, reference_id)
     VALUES ($1, 'payment', $2, 'cash_payment', $3)`,
    [participantId, message, String(payment.rows[0].id)]
  );

  const adminText = [
    '<b>Оплата готівкою зарахована</b>',
    `<b>Учасник:</b> ${htmlEscape(participant.name)}`,
    `<b>Сума:</b> ${htmlEscape(formatAmount(amount))} грн`,
    `<b>Період:</b> ${String(month).padStart(2, '0')}.${year}`,
    '<b>Джерело:</b> Telegram-бот батьків'
  ].join('\n');
  await sendPaymentAdminTelegram(adminText).catch((error) => {
    console.warn('Cash payment Telegram admin notification failed:', error);
  });

  return {
    success: true,
    alreadyPaid: false,
    participantName: participant.name,
    amount,
    month,
    year
  };
}

function homeworkStatusLabel(status: unknown) {
  const value = String(status || '').toLowerCase();
  if (value === 'approved') return 'зараховано';
  if (value === 'needs_work') return 'потрібно доробити';
  if (value === 'submitted') return 'на перевірці';
  return 'активне';
}

async function sendTelegramMenu(chatId: string, intro?: string) {
  await sendParentTelegram(
    chatId,
    `${intro ? `${intro}\n\n` : ''}Оберіть потрібний розділ нижче.\n\nПідписуйтесь на клуб в Instagram і Facebook - там фото, відео, новини, змагання та атестації.`,
    mainReplyKeyboard()
  );
}

async function sendTelegramProfile(chatId: string) {
  const ids = await requireTelegramConnection(chatId);
  if (ids.length === 0) return;
  const participants = await fetchTelegramParticipants(ids);
  const hasChildren = participants.some((p: any) => p.member_type !== 'adult');
  const title = hasChildren ? 'Ваші діти в BLACK BEAR DOJO' : 'Ваш профіль BLACK BEAR DOJO';
  const lines = participants.map((p: any) => [
    `<b>${htmlEscape(p.name)}</b>`,
    `Група: ${htmlEscape(p.group_name || 'ще не призначена')}`,
    `Тренер: ${htmlEscape(p.coach_name || 'уточнюється')}`,
    `Локація: ${htmlEscape(p.location_name || 'уточнюється')}`,
    `Пояс: ${htmlEscape(p.belt || 'Білий')}`,
    `Бали: ${Number(p.rank_points || 0)}`,
    `Оплата: ${participantPaymentLabel(p)}`,
  ].join('\n'));
  await sendParentTelegram(chatId, `${title}\n\n${lines.join('\n\n')}`, await inlineUrlWithSocialKeyboard('Відкрити кабінет', `${getPortalBaseUrl()}/parent`));
}

async function sendTelegramHomework(chatId: string) {
  const ids = await requireTelegramConnection(chatId);
  if (ids.length === 0 || !pool) return;
  const result = await pool.query(
    `SELECT p.name AS participant_name, ha.title, ha.due_date, ha.estimated_minutes, hap.status, hap.points_awarded
     FROM homework_assignment_participants hap
     JOIN homework_assignments ha ON ha.id = hap.assignment_id
     JOIN participants p ON p.id = hap.participant_id
     WHERE hap.participant_id = ANY($1::int[])
       AND COALESCE(ha.status, 'active') = 'active'
     ORDER BY COALESCE(ha.due_date, ha.created_at::date) ASC, ha.created_at DESC
     LIMIT 10`,
    [ids]
  );
  if (result.rows.length === 0) {
    await sendParentTelegram(chatId, 'Активних домашніх завдань зараз немає.', inlineUrlKeyboard('Кабінет ДЗ', `${getPortalBaseUrl()}/parent?tab=homework`));
    return;
  }
  const items = result.rows.map((row: any) => {
    const due = row.due_date ? `\nДо: ${formatDate(row.due_date)}` : '';
    const minutes = row.estimated_minutes ? `\nЧас: приблизно ${Number(row.estimated_minutes)} хв` : '';
    const points = Number(row.points_awarded || 0) > 0 ? `\nБали: +${Number(row.points_awarded)}` : '';
    return `<b>${htmlEscape(row.participant_name)}</b>\n${htmlEscape(row.title)}\nСтатус: ${homeworkStatusLabel(row.status)}${due}${minutes}${points}`;
  });
  await sendParentTelegram(chatId, `Домашні завдання\n\n${items.join('\n\n')}`, inlineUrlKeyboard('Відкрити ДЗ', `${getPortalBaseUrl()}/parent?tab=homework`));
}

async function sendTelegramManual(chatId: string) {
  const text = [
    '<b>Коротка методичка BLACK BEAR DOJO</b>',
    '<b>Пояси і кю</b>\nШлях починається з білого поясу. Кю показує рівень підготовки: техніка, дисципліна, витривалість і розуміння етикету.',
    '<b>Базові терміни</b>\nОсу - вітання і знак поваги. Додзьо - зал тренувань. Сенсей - тренер. Кіхон - базова техніка. Куміте - поєдинок. Ката - формальна послідовність технік.',
    '<b>Поведінка в залі</b>\nПриходити вчасно, слухати тренера, берегти партнерів, не бігати залом без дозволу, підтримувати чисту форму.',
    '<b>Змагання</b>\nГоловне - безпека, правила контакту, повага до суперника і суддів. Результат важливий, але досвід важливіший.',
    '<b>Коли починати змагання</b>\nКоли дитина стабільно тренується, готова слухати команди, не боїться контакту і тренер бачить психологічну готовність.',
    '<b>Що знати батькам</b>\nРегулярність, сон, вода, харчування і спокійна підтримка дають більше, ніж тиск на результат.',
    '<b>Атестація</b>\nПідготовка - це техніка, фізична форма, терміни, етикет і стабільність на тренуваннях.',
  ].join('\n\n');
  await sendParentTelegram(chatId, text, inlineUrlKeyboard('Повна методичка в кабінеті', `${getPortalBaseUrl()}/parent?tab=manual`));
}

async function sendTelegramSchedule(chatId: string) {
  const ids = await requireTelegramConnection(chatId);
  if (ids.length === 0 || !pool) return;
  const result = await pool.query(
    `SELECT DISTINCT p.name AS participant_name, s.day_of_week, s.start_time, s.end_time,
            s.group_name, l.name AS location_name, c.name AS coach_name
     FROM participants p
     JOIN groups g ON g.id = p.group_id
     JOIN schedule s ON (
       LOWER(TRIM(COALESCE(s.group_name, ''))) = LOWER(TRIM(COALESCE(g.name, '')))
       OR LOWER(COALESCE(s.group_name, '')) LIKE '%' || LOWER(COALESCE(g.name, '')) || '%'
       OR LOWER(COALESCE(g.name, '')) LIKE '%' || LOWER(COALESCE(s.group_name, '')) || '%'
     )
     LEFT JOIN locations l ON l.id = s.location_id
     LEFT JOIN coaches c ON c.id = COALESCE(s.coach_id, g.coach_id)
     WHERE p.id = ANY($1::int[])
     ORDER BY s.day_of_week, s.start_time
     LIMIT 12`,
    [ids]
  );
  if (result.rows.length === 0) {
    await sendParentTelegram(chatId, 'Розклад для вашої групи ще уточнюється. Повний розклад доступний у кабінеті.', inlineUrlKeyboard('Відкрити розклад', `${getPortalBaseUrl()}/parent?tab=schedule`));
    return;
  }
  const items = result.rows.map((row: any) => {
    const time = `${row.start_time || ''}${row.end_time ? `-${row.end_time}` : ''}`;
    return `<b>${htmlEscape(row.participant_name)}</b>\n${htmlEscape(row.day_of_week || '')} ${htmlEscape(time)}\n${htmlEscape(row.group_name || '')}\n${htmlEscape(row.location_name || 'Локація уточнюється')}\nТренер: ${htmlEscape(row.coach_name || 'уточнюється')}`;
  });
  await sendParentTelegram(chatId, `Розклад\n\n${items.join('\n\n')}`, inlineUrlKeyboard('Відкрити кабінет', `${getPortalBaseUrl()}/parent?tab=schedule`));
}

async function sendTelegramPayments(chatId: string) {
  const ids = await requireTelegramConnection(chatId);
  if (ids.length === 0 || !pool) return;
  const participants = await fetchTelegramParticipants(ids);
  const payments = await pool.query(
    `SELECT p.name AS participant_name, pay.amount, pay.date
     FROM payments pay
     JOIN participants p ON p.id = pay.participant_id
     WHERE pay.participant_id = ANY($1::int[])
     ORDER BY pay.date DESC, pay.created_at DESC
     LIMIT 5`,
    [ids]
  );
  const statusLines = participants.map((p: any) => `<b>${htmlEscape(p.name)}</b>: ${participantPaymentLabel(p)}`);
  const history = payments.rows.length
    ? payments.rows.map((row: any) => `${htmlEscape(row.participant_name)} - ${Number(row.amount || 0)} грн, ${formatDate(row.date)}`).join('\n')
    : 'Останніх оплат у базі не знайдено.';

  const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = participants
    .filter((participant: any) => !isPaidStatus(participant.payment_status) && !isAttendanceFreezeActive(participant))
    .map((participant: any) => [{
      text: `Оплатив(ла) готівкою: ${participant.name}`.slice(0, 64),
      callback_data: `p:cash:${participant.id}`
    }]);
  rows.push([{ text: 'Відкрити оплату', url: `${getPortalBaseUrl()}/parent?tab=payments` }]);

  await sendParentTelegram(chatId, `Оплата\n\n${statusLines.join('\n')}\n\nОстанні платежі:\n${history}`, inlineRowsKeyboard(rows));
}

async function sendTelegramProgress(chatId: string) {
  const ids = await requireTelegramConnection(chatId);
  if (ids.length === 0 || !pool) return;
  const result = await pool.query(
    `SELECT p.name, p.belt, p.rank_points,
            COUNT(hap.id)::int AS homework_total,
            COUNT(hap.id) FILTER (WHERE hap.status = 'approved')::int AS homework_approved
     FROM participants p
     LEFT JOIN homework_assignment_participants hap ON hap.participant_id = p.id
     WHERE p.id = ANY($1::int[])
     GROUP BY p.id, p.name, p.belt, p.rank_points
     ORDER BY p.name ASC`,
    [ids]
  );
  const lines = result.rows.map((row: any) => [
    `<b>${htmlEscape(row.name)}</b>`,
    `Пояс: ${htmlEscape(row.belt || 'Білий')}`,
    `Рейтинг/бали: ${Number(row.rank_points || 0)}`,
    `ДЗ зараховано: ${Number(row.homework_approved || 0)} з ${Number(row.homework_total || 0)}`,
  ].join('\n'));
  await sendParentTelegram(chatId, `Прогрес\n\n${lines.join('\n\n')}\n\nДля таблиці місць натисніть “Рейтинг”.`, inlineUrlKeyboard('Відкрити прогрес', `${getPortalBaseUrl()}/parent?tab=progress`));
}

const RATING_PERIODS = [
  { key: 'month', label: 'Місяць', startSql: "date_trunc('month', CURRENT_DATE)" },
  { key: 'quarter', label: 'Квартал', startSql: "date_trunc('quarter', CURRENT_DATE)" },
  { key: 'year', label: 'Рік', startSql: "date_trunc('year', CURRENT_DATE)" },
];

async function getRatingScopeRows(participant: any, scope: 'group' | 'club', startSql: string) {
  if (!pool) return [];
  const params: any[] = [];
  const where = ["COALESCE(p.status, 'active') = 'active'"];
  if (scope === 'group' && participant.group_id) {
    params.push(Number(participant.group_id));
    where.push(`p.group_id = $${params.length}`);
  }

  const targetParamIndex = params.length + 1;
  params.push(Number(participant.id));

  const result = await pool.query(`
    WITH scores AS (
      SELECT
        p.id,
        p.name,
        COALESCE(p.rank_points, 0)::int AS total_points,
        COALESCE(SUM(pl.points), 0)::int AS period_points,
        COALESCE(SUM(CASE WHEN pl.reason = 'homework' THEN pl.points ELSE 0 END), 0)::int AS homework_points,
        g.name AS group_name,
        c.name AS coach_name
      FROM participants p
      LEFT JOIN groups g ON g.id = p.group_id
      LEFT JOIN coaches c ON c.id = g.coach_id
      LEFT JOIN points_log pl ON pl.participant_id = p.id AND pl.date >= ${startSql}
      WHERE ${where.join(' AND ')}
      GROUP BY p.id, p.name, p.rank_points, g.name, c.name
    ), ranked AS (
      SELECT *, RANK() OVER (ORDER BY period_points DESC, total_points DESC, homework_points DESC, name ASC) AS rank_position
      FROM scores
    )
    SELECT * FROM ranked
    WHERE rank_position <= 5 OR id = $${targetParamIndex}
    ORDER BY rank_position ASC, name ASC
    LIMIT 8
  `, params);
  return result.rows;
}

function formatRatingRows(rows: any[], participantId: number) {
  if (rows.length === 0) return 'Поки немає даних.';
  const current = rows.find((row: any) => Number(row.id) === participantId);
  const top = rows.filter((row: any) => Number(row.rank_position) <= 5);
  const lines = top.map((row: any) => {
    const mark = Number(row.id) === participantId ? ' <- ви' : '';
    return `${row.rank_position}. ${htmlEscape(row.name)} — ${Number(row.period_points || 0)} балів${mark}`;
  });
  if (current && Number(current.rank_position) > 5) {
    lines.push(`Ваше місце: ${current.rank_position}. ${htmlEscape(current.name)} — ${Number(current.period_points || 0)} балів`);
  }
  return lines.join('\n');
}

async function sendTelegramRatings(chatId: string) {
  const ids = await requireTelegramConnection(chatId);
  if (ids.length === 0 || !pool) return;
  const participants = (await fetchTelegramParticipants(ids)).slice(0, 3);
  if (participants.length === 0) {
    await sendParentTelegram(chatId, 'Рейтинг поки недоступний.');
    return;
  }

  const blocks: string[] = ['<b>Рейтинг BLACK BEAR DOJO</b>'];
  for (const participant of participants) {
    blocks.push(`\n<b>${htmlEscape(participant.name)}</b>${participant.group_name ? `\nГрупа: ${htmlEscape(participant.group_name)}` : ''}${participant.coach_name ? `\nТренер: ${htmlEscape(participant.coach_name)}` : ''}`);
    for (const period of RATING_PERIODS) {
      const groupRows = participant.group_id ? await getRatingScopeRows(participant, 'group', period.startSql) : [];
      const clubRows = await getRatingScopeRows(participant, 'club', period.startSql);
      blocks.push(`\n<b>${period.label}: група</b>\n${formatRatingRows(groupRows, Number(participant.id))}`);
      blocks.push(`<b>${period.label}: клуб</b>\n${formatRatingRows(clubRows, Number(participant.id))}`);
    }
  }

  await sendParentTelegram(chatId, blocks.join('\n'), inlineUrlKeyboard('Відкрити прогрес', `${getPortalBaseUrl()}/parent?tab=progress`));
}

async function sendTelegramCoachContact(chatId: string) {
  const ids = await requireTelegramConnection(chatId);
  if (ids.length === 0 || !pool) return;
  const participants = await fetchTelegramParticipants(ids);
  const rows: Array<Array<{ text: string; url: string }>> = [];
  const lines = ['<b>Зв’язок з тренером</b>'];
  const seen = new Set<string>();

  for (const participant of participants) {
    const coachId = participant.coach_id ? String(participant.coach_id) : `none:${participant.id}`;
    if (seen.has(coachId)) continue;
    seen.add(coachId);

    const phone = clean(participant.coach_phone) || await getSettingsValue([
      `coach_${participant.coach_id}_phone`,
      'coach_phone',
      'contact_phone',
    ]);
    const telegramUsernameRaw = clean(participant.coach_telegram_username) || await getSettingsValue([
      `coach_${participant.coach_id}_telegram_username`,
      `coach_${participant.coach_id}_telegram`,
      'coach_telegram_username',
      'coach_telegram',
    ]);
    const telegramUsername = telegramUsernameRaw ? telegramUsernameRaw.replace(/^@/, '') : '';

    lines.push([
      '',
      `<b>${htmlEscape(participant.coach_name || 'Тренер уточнюється')}</b>`,
      participant.group_name ? `Група: ${htmlEscape(participant.group_name)}` : '',
      phone ? `Телефон: ${htmlEscape(phone)}` : 'Телефон ще не вказано в картці тренера.',
      telegramUsername ? `Telegram: @${htmlEscape(telegramUsername)}` : 'Telegram username ще не вказано в картці тренера.',
    ].filter(Boolean).join('\n'));

    if (telegramUsername) {
      rows.push([{ text: `Написати ${participant.coach_name || 'тренеру'}`.slice(0, 64), url: `https://t.me/${telegramUsername}` }]);
    }
  }

  rows.push([{ text: 'Відкрити повідомлення в кабінеті', url: `${getPortalBaseUrl()}/parent?tab=messages` }]);
  await sendParentTelegram(chatId, lines.join('\n'), inlineRowsKeyboard(rows));
}

async function sendTelegramNotifications(chatId: string) {
  const ids = await requireTelegramConnection(chatId);
  if (ids.length === 0 || !pool) return;
  const result = await pool.query(
    `SELECT p.name AS participant_name, n.message, n.created_at
     FROM notifications n
     JOIN participants p ON p.id = n.participant_id
     WHERE n.participant_id = ANY($1::int[])
       AND n.type = ANY($2::text[])
     ORDER BY n.created_at DESC
     LIMIT 8`,
    [ids, IMPORTANT_TELEGRAM_TYPES]
  );
  if (result.rows.length === 0) {
    await sendParentTelegram(chatId, 'Важливих сповіщень поки немає.');
    return;
  }
  const lines = result.rows.map((row: any) => `<b>${htmlEscape(row.participant_name)}</b> - ${formatDate(row.created_at)}\n${htmlEscape(row.message)}`);
  await sendParentTelegram(chatId, `Останні важливі сповіщення\n\n${lines.join('\n\n')}`, inlineUrlKeyboard('Відкрити кабінет', `${getPortalBaseUrl()}/parent?tab=notifications`));
}

async function handleTelegramCallback(chatId: string, data: string, callbackQueryId: string | null) {
  if (data.startsWith('p:cash:')) {
    const participantId = data.split(':')[2];
    const result = await recordTelegramCashPayment(chatId, participantId);
    if (!result.success) {
      await answerParentTelegramCallback(callbackQueryId, 'Не вдалося зарахувати оплату');
      await sendParentTelegram(chatId, 'Не вдалося зарахувати оплату. Перевірте, чи Telegram підключений саме до цього кабінету.');
      return;
    }

    const amountText = `${formatAmount(Number(result.amount || 0))} грн`;
    await answerParentTelegramCallback(callbackQueryId, result.alreadyPaid ? 'Вже було оплачено' : 'Оплату зараховано');
    await sendParentTelegram(
      chatId,
      result.alreadyPaid
        ? `Оплата за цей місяць для ${htmlEscape(result.participantName)} вже була зарахована.`
        : `Готово. Оплату готівкою для ${htmlEscape(result.participantName)} зараховано: ${htmlEscape(amountText)}.`
    );
    await sendTelegramPayments(chatId);
    return;
  }

  await answerParentTelegramCallback(callbackQueryId, 'Кнопка застаріла');
  await sendTelegramMenu(chatId, 'Оновив меню.');
}

async function handleTelegramMessage(chatId: string, text: string, from: any) {
  const normalized = String(text || '').trim();
  if (normalized.startsWith('/start')) {
    const [, rawToken] = normalized.split(/\s+/, 2);
    const token = String(rawToken || '').trim();
    if (!token) {
      await sendParentTelegram(chatId, 'Вітаю! Щоб підключити Telegram, відкрийте персональне посилання з кабінету учасника.');
      return;
    }
    const consumed = await consumeTelegramStartToken(token);
    if (!consumed) {
      await sendParentTelegram(chatId, 'Посилання вже використане або застаріло. Створіть нове посилання в кабінеті й натисніть Start ще раз.');
      return;
    }
    await connectTelegramChat({
      participantId: Number(consumed.participant_id),
      accessId: consumed.access_id ? Number(consumed.access_id) : null,
      chatId,
      user: from,
    });
    await sendTelegramMenu(chatId, 'Telegram підключено до кабінету BLACK BEAR DOJO. Тут будуть тільки важливі персональні повідомлення: ДЗ, оплата, повідомлення тренера та важливі оголошення.');
    return;
  }

  if (normalized === '/stop' || normalized === 'Відключити Telegram') {
    await disableTelegramChat(chatId);
    await sendParentTelegram(chatId, 'Telegram-сповіщення вимкнено для цього чату. Інші підключені батьки або учасники залишаються підключеними.');
    return;
  }

  if (normalized === '/menu' || normalized === 'Меню') return sendTelegramMenu(chatId);
  if (normalized === 'Мої діти / Мій профіль') return sendTelegramProfile(chatId);
  if (normalized === 'Домашні завдання') return sendTelegramHomework(chatId);
  if (normalized === 'Методичка') return sendTelegramManual(chatId);
  if (normalized === 'Розклад') return sendTelegramSchedule(chatId);
  if (normalized === 'Оплата' || normalized === '/cash' || normalized === 'Оплатив(ла) готівкою') return sendTelegramPayments(chatId);
  if (normalized === 'Прогрес') return sendTelegramProgress(chatId);
  if (normalized === 'Рейтинг' || normalized === '/rating') return sendTelegramRatings(chatId);
  if (normalized === 'Зв’язок з тренером' || normalized === "Зв'язок з тренером" || normalized === '/coach') return sendTelegramCoachContact(chatId);
  if (normalized === 'Instagram' || normalized === 'Facebook' || normalized === 'Соцмережі' || normalized === '/social') return sendTelegramSocialLinks(chatId);
  if (normalized === 'Сповіщення') return sendTelegramNotifications(chatId);
  if (normalized === 'Відкрити кабінет') {
    await sendParentTelegram(chatId, 'Кабінет BLACK BEAR DOJO:', await inlineUrlWithSocialKeyboard('Відкрити кабінет', `${getPortalBaseUrl()}/parent`));
    return;
  }
  await sendTelegramMenu(chatId, 'Не зовсім зрозумів команду.');
}

async function handleTelegramWebhook(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configuredSecret = clean(process.env.TELEGRAM_PARENT_WEBHOOK_SECRET);
  if (configuredSecret) {
    const header = req.headers?.['x-telegram-bot-api-secret-token'];
    const actual = Array.isArray(header) ? header[0] : header;
    if (actual !== configuredSecret) return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await ensureTelegramMessagingSchema();
    const update = await readJsonBody(req);
    const message = update?.message || update?.callback_query?.message;
    const chatIdRaw = message?.chat?.id;
    const chatId = chatIdRaw ? String(chatIdRaw) : '';
    if (!chatId) return res.status(200).json({ ok: true });
    const from = update?.message?.from || update?.callback_query?.from || null;
    const callbackData = clean(update?.callback_query?.data);
    if (callbackData) {
      await handleTelegramCallback(chatId, callbackData, clean(update?.callback_query?.id));
      return res.status(200).json({ ok: true });
    }
    await handleTelegramMessage(chatId, String(update?.message?.text || '').trim(), from);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Parent Telegram webhook failed:', error);
    return res.status(200).json({ ok: true });
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
  if (mode === 'telegram-webhook-status') return handleTelegramWebhookStatus(req, res);
  if (mode === 'telegram-bot-info') return handleTelegramBotInfo(req, res);
  if (mode === 'telegram-parent-webhook') return handleTelegramWebhook(req, res);
  if (mode === 'messages' || mode === 'message-list') return handleMessages(req, res);
  if (mode === 'admin-notify') return handleAdminNotify(req, res);
  if (mode === 'admin-notify-mass') return handleAdminNotifyMass(req, res);

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
