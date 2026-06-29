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

type TelegramRecipient = {
  chatId: string;
  participantId: number;
  accessId?: number | null;
};

const AUTH_TOKEN_PREFIX = 'bb1';
const START_TOKEN_TTL_MINUTES = 20;
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

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.DATABASE_URL
    ? crypto.createHash('sha256').update(`black-bear-session:${process.env.DATABASE_URL}`).digest('hex')
    : 'black-bear-local-dev-secret');

const clean = (value: unknown) => {
  if (Array.isArray(value)) return clean(value[0]);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

function htmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const normalizeDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const lower = (value: unknown) => String(value ?? '').trim().toLowerCase();

function formatAmount(amountUah: number) {
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: Number.isInteger(amountUah) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountUah);
}

const getPortalBaseUrl = () =>
  (clean(process.env.APP_URL) || 'https://shin-karate.kyiv.ua').replace(/\/$/, '');

const getParentBotUsername = () => clean(process.env.TELEGRAM_PARENT_BOT_USERNAME) || 'karate_kyiv_bot';
const getParentBotToken = () => clean(process.env.TELEGRAM_PARENT_BOT_TOKEN);

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
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!authValue?.startsWith('Bearer ')) return null;
  return verifyAuthToken(authValue.slice('Bearer '.length));
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
    // Optional fallback.
  }

  try {
    const result = await pool.query('SELECT key, value FROM site_content WHERE key = ANY($1)', [keys]);
    for (const key of keys) {
      const value = clean(result.rows.find((row: any) => row.key === key)?.value);
      if (value) return value;
    }
  } catch {
    // Optional fallback.
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

async function getMonobankToken() {
  return (
    clean(process.env.MONOBANK_TOKEN) ||
    clean(process.env.MONOBANK_ACQUIRING_TOKEN) ||
    (await getSettingsValue(['monobank_token', 'MONOBANK_TOKEN', 'monobank_acquiring_token', 'MONOBANK_ACQUIRING_TOKEN']))
  );
}

async function ensureSchema() {
  if (!pool) return;

  await pool.query(`
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference_id ON payments(reference_id) WHERE reference_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS monobank_payments (
      id SERIAL PRIMARY KEY,
      participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
      invoice_id TEXT UNIQUE NOT NULL,
      reference TEXT UNIQUE,
      amount INTEGER NOT NULL,
      amount_uah NUMERIC(10,2) NOT NULL,
      status TEXT DEFAULT 'created',
      page_url TEXT,
      purpose TEXT,
      raw_payload JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP
    );

    ALTER TABLE monobank_payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'debit';

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
    CREATE INDEX IF NOT EXISTS idx_notifications_reference
      ON notifications(participant_id, reference_type, reference_id);

    ALTER TABLE coaches ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE coaches ADD COLUMN IF NOT EXISTS telegram_username TEXT;

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

    CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_participant_id ON telegram_link_tokens(participant_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_expires_at ON telegram_link_tokens(expires_at);

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

async function getPortalParticipantId(req: any): Promise<number | null> {
  const tokenPayload = getBearerPayload(req);
  if (tokenPayload?.role !== 'parent') return null;
  return Number(tokenPayload.sub);
}

async function getParentPortalAuth(req: any) {
  if (!pool) return null;
  const payload = getBearerPayload(req);
  if (payload?.role !== 'parent') return null;

  const participantId = Number(payload.sub);
  if (!Number.isInteger(participantId) || participantId <= 0) return null;

  const participant = await pool.query(
    'SELECT id, name, member_type, parent_name, parent_phone, phone, parent_login FROM participants WHERE id = $1 LIMIT 1',
    [participantId]
  );
  if (participant.rows.length === 0) return null;

  let accessId = Number(payload.accessId || 0) || null;
  if (accessId) {
    const access = await pool.query(
      'SELECT id FROM participant_accesses WHERE id = $1 AND participant_id = $2 AND can_login = TRUE LIMIT 1',
      [accessId, participantId]
    );
    if (access.rows.length === 0) accessId = null;
  }

  return { participantId, accessId, participant: participant.rows[0] };
}

async function resolveTelegramAccess(participantId: number, accessId?: number | null) {
  if (!pool) return null;
  if (accessId) return accessId;

  const login = `telegram:self:${participantId}`;
  const existing = await pool.query(
    'SELECT id FROM participant_accesses WHERE participant_id = $1 AND login = $2 LIMIT 1',
    [participantId, login]
  );
  if (existing.rows[0]?.id) return Number(existing.rows[0].id);

  const participant = await pool.query(
    'SELECT name, member_type, parent_name, parent_phone, phone FROM participants WHERE id = $1 LIMIT 1',
    [participantId]
  );
  const row = participant.rows[0] || {};
  const accessType = row.member_type === 'adult' ? 'self' : 'guardian';
  const displayName = row.member_type === 'adult' ? row.name : (row.parent_name || row.name || 'Telegram');
  const phone = row.parent_phone || row.phone || null;

  const created = await pool.query(
    `INSERT INTO participant_accesses (participant_id, access_type, name, phone, login, password_hash, can_login)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE)
     RETURNING id`,
    [participantId, accessType, displayName, phone, login, 'telegram-link-only']
  );
  return Number(created.rows[0].id);
}

const hashStartToken = (token: string) =>
  crypto.createHash('sha256').update(`${SESSION_SECRET}:telegram-start:${token}`).digest('hex');

async function createTelegramStartToken(participantId: number, accessId: number) {
  if (!pool) return null;
  const token = crypto.randomBytes(24).toString('base64url');
  const tokenHash = hashStartToken(token);

  await pool.query(
    `DELETE FROM telegram_link_tokens
     WHERE expires_at < CURRENT_TIMESTAMP OR used_at IS NOT NULL OR (participant_id = $1 AND access_id = $2)`,
    [participantId, accessId]
  );

  await pool.query(
    `INSERT INTO telegram_link_tokens (token_hash, participant_id, access_id, expires_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + ($4::int * INTERVAL '1 minute'))`,
    [tokenHash, participantId, accessId, START_TOKEN_TTL_MINUTES]
  );

  return token;
}

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
      role
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

const matchesFamilyAccess = (target: any, subscription: any) => {
  if (Number(subscription.participant_id) === Number(target.id)) return true;
  if (subscription.access_type === 'child') return false;

  const targetLogins = new Set([lower(target.parent_login)].filter(Boolean));
  const targetPhones = new Set([
    normalizeDigits(target.parent_phone),
    normalizeDigits(target.phone),
    normalizeDigits(target.parent_login)
  ].filter(Boolean));

  const accessLogin = lower(subscription.login);
  const accessPhoneDigits = normalizeDigits(subscription.phone || subscription.login);
  return Boolean(
    (accessLogin && targetLogins.has(accessLogin)) ||
    (accessPhoneDigits && targetPhones.has(accessPhoneDigits))
  );
};

async function getTelegramRecipientsForParticipant(participantId: number): Promise<TelegramRecipient[]> {
  if (!pool) return [];
  const targetRes = await pool.query(
    'SELECT id, parent_login, parent_phone, phone FROM participants WHERE id = $1 LIMIT 1',
    [participantId]
  );
  const target = targetRes.rows[0];
  if (!target) return [];

  const subs = await pool.query(`
    SELECT ts.telegram_chat_id, ts.participant_id, ts.access_id, pa.access_type, pa.login, pa.phone
    FROM telegram_subscriptions ts
    LEFT JOIN participant_accesses pa ON pa.id = ts.access_id
    WHERE ts.enabled = TRUE
  `);

  const recipients = new Map<string, TelegramRecipient>();
  for (const sub of subs.rows) {
    if (!sub.telegram_chat_id) continue;
    if (matchesFamilyAccess(target, sub)) {
      recipients.set(String(sub.telegram_chat_id), {
        chatId: String(sub.telegram_chat_id),
        participantId: Number(sub.participant_id),
        accessId: sub.access_id ? Number(sub.access_id) : null
      });
    }
  }

  return Array.from(recipients.values());
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
      [{ text: 'Сповіщення' }, { text: 'Відкрити кабінет' }],
      [{ text: 'Відключити Telegram' }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

function inlineUrlKeyboard(label: string, url: string) {
  return { inline_keyboard: [[{ text: label, url }]] };
}

function inlineRowsKeyboard(rows: Array<Array<{ text: string; url?: string; callback_data?: string }>>) {
  return { inline_keyboard: rows };
}

async function sendParentTelegram(chatId: string, text: string, replyMarkup?: any) {
  const token = getParentBotToken();
  if (!token) return { ok: false, skipped: 'missing_parent_bot_token' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        chat_id: chatId,
        text: text.length > 3900 ? `${text.slice(0, 3880)}...` : text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: replyMarkup
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { ok: false, status: response.status, error: body.slice(0, 300) };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, description: clean(error?.message) || 'Telegram API request failed' };
  } finally {
    clearTimeout(timeout);
  }
}

async function answerParentTelegramCallback(callbackQueryId: string | null, text?: string) {
  const token = getParentBotToken();
  if (!token || !callbackQueryId) return { ok: false, skipped: 'missing_callback_query_id' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false
      })
    });
    return { ok: response.ok };
  } catch (error: any) {
    return { ok: false, description: clean(error?.message) || 'Telegram API request failed' };
  } finally {
    clearTimeout(timeout);
  }
}

const asNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

async function sendTelegramMessage(text: string) {
  const token = await getConfiguredValue(
    ['TELEGRAM_BOT_TOKEN'],
    ['telegram_bot_token', 'TELEGRAM_BOT_TOKEN']
  );
  const chatId = await getConfiguredValue(
    ['TELEGRAM_PAYMENT_CHAT_ID', 'MONOBANK_PAYMENT_CHAT_ID', 'TELEGRAM_CHAT_ID'],
    ['telegram_payment_chat_id', 'monobank_payment_chat_id', 'telegram_chat_id', 'TELEGRAM_PAYMENT_CHAT_ID', 'MONOBANK_PAYMENT_CHAT_ID', 'TELEGRAM_CHAT_ID']
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

  if (!response.ok) {
    console.warn('Telegram payment notification failed', { status: response.status });
  }

  return response.ok;
}

async function getPaymentParticipant(participantId: number) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT p.id,
            p.name,
            p.member_type,
            p.parent_name,
            p.parent_phone,
            p.phone,
            p.email,
            g.name AS group_name
     FROM participants p
     LEFT JOIN groups g ON g.id = p.group_id
     WHERE p.id = $1
     LIMIT 1`,
    [participantId]
  );
  return result.rows[0] || null;
}

async function notifySuccessfulPayment(invoice: any, amountUah: number) {
  if (!pool) return;

  const participant = await getPaymentParticipant(Number(invoice.participant_id));
  const participantName = participant?.name || `ID ${invoice.participant_id}`;
  const memberType = participant?.member_type === 'adult' ? 'дорослий учасник' : 'учень / дитина';
  const phone = participant?.parent_phone || participant?.phone || 'не вказано';
  const amountText = `${formatAmount(amountUah)} грн`;
  const cabinetMessage = `Оплата через monobank зарахована: ${amountText}.`;

  await pool.query(
    `INSERT INTO notifications (participant_id, type, message, reference_type, reference_id)
     VALUES ($1, 'payment', $2, 'monobank_payment', $3)`,
    [invoice.participant_id, cabinetMessage, invoice.invoice_id]
  );

  const telegramText = `
<b>Оплата monobank зарахована</b>
<b>Учасник:</b> ${htmlEscape(participantName)}
<b>Тип:</b> ${htmlEscape(memberType)}
<b>Сума:</b> ${htmlEscape(amountText)}
<b>Група:</b> ${htmlEscape(participant?.group_name || 'не вказано')}
<b>Телефон:</b> ${htmlEscape(phone)}
<b>Рахунок:</b> ${htmlEscape(invoice.invoice_id)}
  `.trim();

  await sendTelegramMessage(telegramText).catch((error) => {
    console.warn('Telegram payment notification error', error);
  });
}

async function markSuccessfulPayment(invoice: any, amountUah: number) {
  if (!pool) return false;
  const referenceId = `monobank:${invoice.invoice_id}`;
  const now = new Date();

  const insertResult = await pool.query(
    `INSERT INTO payments (participant_id, amount, date, month, year, type, method, notes, reference_id)
     SELECT $1, $2, CURRENT_DATE, $3, $4, 'subscription', 'monobank', $5, $6
     WHERE NOT EXISTS (SELECT 1 FROM payments WHERE reference_id = $6)
     RETURNING id`,
    [
      invoice.participant_id,
      amountUah,
      now.getMonth() + 1,
      now.getFullYear(),
      `Оплата monobank, рахунок ${invoice.invoice_id}`,
      referenceId,
    ]
  );

  await pool.query("UPDATE participants SET payment_status = 'paid' WHERE id = $1", [invoice.participant_id]);

  const inserted = (insertResult.rowCount || 0) > 0;
  if (inserted) {
    await notifySuccessfulPayment(invoice, amountUah);
  }

  return inserted;
}

function getQuery(req: any) {
  const url = new URL(req.url || '', 'https://shin-karate.kyiv.ua');
  return {
    invoiceId: clean(req.query?.invoiceId) || clean(url.searchParams.get('invoiceId')),
    reference: clean(req.query?.reference) || clean(url.searchParams.get('reference')),
    mode: clean(req.query?.mode) || clean(url.searchParams.get('mode')),
  };
}

function getAuthHeader(req: any) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  return Array.isArray(header) ? header[0] : header;
}

const KYIV_TIME_ZONE = 'Europe/Kyiv';

const scheduledPaymentReminderMessages: Record<number, { stage: string; message: (monthLabel: string, coachHelp: string) => string }> = {
  1: {
    stage: 'due_by_5',
    message: (monthLabel, coachHelp) =>
      `Нагадуємо: оплату тренувань за ${monthLabel} потрібно внести до 5 числа поточного місяця.\n\n${coachHelp}`
  },
  10: {
    stage: 'overdue_10',
    message: (monthLabel, coachHelp) =>
      `Оплата тренувань за ${monthLabel} ще не відмічена. Будь ласка, перевірте оплату.\n\n${coachHelp}`
  },
  20: {
    stage: 'overdue_20',
    message: (monthLabel, coachHelp) =>
      `Кінець місяця вже близько, а оплата тренувань за ${monthLabel} ще не відмічена. Будь ласка, перевірте оплату в кабінеті.\n\n${coachHelp}`
  }
};

function normalizeTelegramUsername(value: unknown) {
  return String(clean(value) || '').replace(/^@+/, '').trim();
}

async function getPaymentCoachHelp(participant: any) {
  const coachId = participant?.coach_id ? String(participant.coach_id) : '';
  const phone =
    clean(participant?.coach_phone) ||
    await getSettingsValue([
      coachId ? `coach_${coachId}_phone` : '',
      'coach_phone',
      'contact_phone'
    ].filter(Boolean));
  const telegramUsername = normalizeTelegramUsername(
    clean(participant?.coach_telegram_username) ||
    await getSettingsValue([
      coachId ? `coach_${coachId}_telegram_username` : '',
      coachId ? `coach_${coachId}_telegram` : '',
      'coach_telegram_username',
      'coach_telegram'
    ].filter(Boolean))
  );
  const coachName = clean(participant?.coach_name);
  const lines = [
    `Якщо оплату вже зробили, але статус не оновився або бачите помилку, зверніться до тренера${coachName ? `: ${coachName}` : '.'}`,
    phone ? `Телефон: ${phone}` : '',
    telegramUsername ? `Telegram: @${telegramUsername}` : ''
  ].filter(Boolean);
  return lines.join('\n');
}

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

function getKyivMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: KYIV_TIME_ZONE,
    month: 'long',
    year: 'numeric'
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

async function createScheduledPaymentReminders(now = new Date()) {
  if (!pool) return { created: 0, eligible: 0, skipped: 'Database not configured' };

  const { year, month, day } = getKyivDateParts(now);
  const reminder = scheduledPaymentReminderMessages[day];
  if (!reminder) return { created: 0, eligible: 0, skipped: 'not_a_payment_reminder_day', day, month, year };

  const monthLabel = getKyivMonthLabel(year, month);
  const monthKey = String(month).padStart(2, '0');
  const referenceId = `payment-reminder:${year}-${monthKey}:${reminder.stage}`;

  const debtors = await pool.query(
    `SELECT p.id, p.name,
            g.coach_id,
            c.name AS coach_name,
            c.phone AS coach_phone,
            c.telegram_username AS coach_telegram_username
     FROM participants p
     LEFT JOIN groups g ON g.id = p.group_id
     LEFT JOIN coaches c ON c.id = g.coach_id
     WHERE COALESCE(p.status, 'active') = 'active'
       AND LOWER(TRIM(COALESCE(p.payment_status, 'unpaid'))) NOT IN ('paid', 'оплачено', 'ok', 'success')
       AND NOT EXISTS (
         SELECT 1
         FROM payments pay
         WHERE pay.participant_id = p.id
           AND pay.month = $1
           AND pay.year = $2
           AND COALESCE(pay.type, 'subscription') = 'subscription'
       )
     ORDER BY p.name ASC
     LIMIT 500`,
    [month, year]
  );

  let created = 0;
  for (const debtor of debtors.rows) {
    const coachHelp = await getPaymentCoachHelp(debtor);
    const insertRes = await pool.query(
      `INSERT INTO notifications (participant_id, type, message, reference_type, reference_id)
       SELECT $1, 'payment', $2, 'payment_reminder', $3
       WHERE NOT EXISTS (
         SELECT 1
         FROM notifications
         WHERE participant_id = $1
           AND reference_type = 'payment_reminder'
           AND reference_id = $3
       )
       RETURNING id`,
      [debtor.id, reminder.message(monthLabel, coachHelp), referenceId]
    );
    if ((insertRes.rowCount || 0) > 0) created += 1;
  }

  return {
    created,
    eligible: debtors.rows.length,
    skipped: debtors.rows.length - created,
    stage: reminder.stage,
    day,
    month,
    year
  };
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
  await sendTelegramMessage(adminText).catch((error) => {
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

async function handleParentTelegramLink(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  await ensureSchema();
  const auth = await getParentPortalAuth(req);
  if (!auth) return res.status(401).json({ error: 'Потрібно увійти в кабінет учасника' });

  const accessId = await resolveTelegramAccess(auth.participantId, auth.accessId);
  if (!accessId) return res.status(500).json({ error: 'Failed to prepare Telegram access' });

  const startToken = await createTelegramStartToken(auth.participantId, accessId);
  const botUsername = getParentBotUsername();
  const status = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE enabled = TRUE)::int AS connected_count,
            BOOL_OR(enabled = TRUE AND access_id = $1)::boolean AS current_access_connected
     FROM telegram_subscriptions
     WHERE participant_id = $2`,
    [accessId, auth.participantId]
  );

  return res.status(200).json({
    botUsername,
    connectUrl: `https://t.me/${botUsername}?start=${encodeURIComponent(startToken || '')}`,
    connected: Boolean(status.rows[0]?.current_access_connected),
    connectedCount: Number(status.rows[0]?.connected_count || 0),
    cabinetUrl: `${getPortalBaseUrl()}/parent`
  });
}

function isHttpUrl(value: unknown) {
  const raw = clean(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

async function handleParentSocialLinks(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const instagramUrl =
    isHttpUrl(process.env.CLUB_INSTAGRAM_URL) ||
    isHttpUrl(await getSettingsValue(['CLUB_INSTAGRAM_URL', 'club_instagram_url', 'social_instagram', 'instagram_url'])) ||
    'https://instagram.com/karate_kyiv';
  const facebookUrl =
    isHttpUrl(process.env.CLUB_FACEBOOK_URL) ||
    isHttpUrl(await getSettingsValue(['CLUB_FACEBOOK_URL', 'club_facebook_url', 'social_facebook', 'facebook_url'])) ||
    'https://www.facebook.com/karatee.kyiv/';

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ instagramUrl, facebookUrl });
}

async function fetchChatParticipantIds(chatId: string) {
  const ids = await getParticipantIdsForChat(chatId);
  return ids.filter((id: number) => Number.isInteger(id) && id > 0);
}

async function requireTelegramConnection(chatId: string) {
  const ids = await fetchChatParticipantIds(chatId);
  if (ids.length > 0) return ids;
  await sendParentTelegram(chatId, 'Telegram ще не підключено до кабінету. Відкрийте кабінет учасника на сайті та натисніть “Підключити Telegram”.');
  return [];
}

async function fetchTelegramParticipants(ids: number[]) {
  if (!pool || ids.length === 0) return [];
  const result = await pool.query(
    `SELECT p.id, p.name, p.member_type, p.belt, p.rank_points, p.payment_status,
            g.name AS group_name, c.name AS coach_name, l.name AS location_name
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

async function sendTelegramMenu(chatId: string, intro?: string) {
  await sendParentTelegram(chatId, `${intro ? `${intro}\n\n` : ''}Оберіть потрібний розділ нижче.`, mainReplyKeyboard());
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
    `Оплата: ${paymentLabel(p.payment_status)}`
  ].join('\n'));
  await sendParentTelegram(chatId, `${title}\n\n${lines.join('\n\n')}`, inlineUrlKeyboard('Відкрити кабінет', `${getPortalBaseUrl()}/parent`));
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
    '<b>Атестація</b>\nПідготовка - це техніка, фізична форма, терміни, етикет і стабільність на тренуваннях.'
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
  const statusLines = participants.map((p: any) => `<b>${htmlEscape(p.name)}</b>: ${paymentLabel(p.payment_status)}`);
  const history = payments.rows.length
    ? payments.rows.map((row: any) => `${htmlEscape(row.participant_name)} - ${Number(row.amount || 0)} грн, ${formatDate(row.date)}`).join('\n')
    : 'Останніх оплат у базі не знайдено.';

  const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = participants
    .filter((participant: any) => !isPaidStatus(participant.payment_status))
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
  const lines = result.rows.map((row: any) => [`<b>${htmlEscape(row.name)}</b>`, `Пояс: ${htmlEscape(row.belt || 'Білий')}`, `Рейтинг/бали: ${Number(row.rank_points || 0)}`, `ДЗ зараховано: ${Number(row.homework_approved || 0)} з ${Number(row.homework_total || 0)}`].join('\n'));
  await sendParentTelegram(chatId, `Прогрес\n\n${lines.join('\n\n')}`, inlineUrlKeyboard('Відкрити прогрес', `${getPortalBaseUrl()}/parent?tab=progress`));
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
  if (text.startsWith('/start')) {
    const [, rawToken] = text.split(/\s+/, 2);
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
      user: from
    });
    await sendTelegramMenu(chatId, 'Telegram підключено до кабінету BLACK BEAR DOJO. Тут будуть тільки важливі персональні повідомлення: ДЗ, оплата, повідомлення тренера та важливі оголошення.');
    return;
  }

  if (text === '/stop' || text === 'Відключити Telegram') {
    await disableTelegramChat(chatId);
    await sendParentTelegram(chatId, 'Telegram-сповіщення вимкнено для цього чату. Інші підключені батьки або учасники залишаються підключеними.');
    return;
  }

  if (text === 'Мої діти / Мій профіль') return sendTelegramProfile(chatId);
  if (text === 'Домашні завдання') return sendTelegramHomework(chatId);
  if (text === 'Методичка') return sendTelegramManual(chatId);
  if (text === 'Розклад') return sendTelegramSchedule(chatId);
  if (text === 'Оплата' || text === '/cash' || text === 'Оплатив(ла) готівкою') return sendTelegramPayments(chatId);
  if (text === 'Прогрес') return sendTelegramProgress(chatId);
  if (text === 'Сповіщення') return sendTelegramNotifications(chatId);
  if (text === 'Відкрити кабінет') {
    await sendParentTelegram(chatId, 'Кабінет BLACK BEAR DOJO:', inlineUrlKeyboard('Відкрити кабінет', `${getPortalBaseUrl()}/parent`));
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
    await ensureSchema();
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

const notificationLabels: Record<string, string> = {
  homework: 'Нове домашнє завдання',
  homework_review: 'Перевірка домашнього завдання',
  payment: 'Оплата',
  message: 'Повідомлення від тренера',
  manual: 'Повідомлення від клубу',
  announcement: 'Важливе оголошення',
  absence: 'Багато пропусків',
  birthday: 'День народження',
  personal_event: 'Персональна подія',
  coach_message: 'Повідомлення від тренера'
};

const tabByNotificationType: Record<string, string> = {
  homework: 'homework',
  homework_review: 'homework',
  payment: 'payments',
  message: 'messages',
  coach_message: 'messages'
};

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

async function handleTelegramDispatch(req: any, res: any) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  const cronHeader = String(req.headers?.['x-vercel-cron'] || '');
  const hasSecretAccess = Boolean(cronSecret && getAuthHeader(req) === `Bearer ${cronSecret}`);
  const hasVercelCronAccess = cronHeader === '1';
  if (!hasSecretAccess && !hasVercelCronAccess) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await ensureSchema();
  if (!getParentBotToken()) {
    return res.status(200).json({ ok: true, sent: 0, skipped: 'TELEGRAM_PARENT_BOT_TOKEN is not configured' });
  }

  const paymentReminders = await createScheduledPaymentReminders();

  const notifications = await pool!.query(
    `SELECT n.id, n.participant_id, n.type, n.message, n.created_at, p.name AS participant_name
     FROM notifications n
     JOIN participants p ON p.id = n.participant_id
     WHERE n.type = ANY($1::text[])
       AND n.created_at >= CURRENT_TIMESTAMP - INTERVAL '21 days'
     ORDER BY n.created_at ASC
     LIMIT 80`,
    [IMPORTANT_TELEGRAM_TYPES]
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const notification of notifications.rows) {
    const recipients = await getTelegramRecipientsForParticipant(Number(notification.participant_id));
    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    for (const recipient of recipients) {
      const deliveryId = await reserveTelegramDelivery(Number(notification.id), Number(notification.participant_id), recipient.chatId);
      if (!deliveryId) {
        skipped += 1;
        continue;
      }

      const label = notificationLabels[notification.type] || 'Важливе повідомлення';
      const tab = tabByNotificationType[notification.type] || 'notifications';
      const result = await sendParentTelegram(
        recipient.chatId,
        `<b>${htmlEscape(label)}</b>\n${htmlEscape(notification.participant_name)}\n${htmlEscape(notification.message)}`,
        inlineUrlKeyboard('Відкрити кабінет', `${getPortalBaseUrl()}/parent?tab=${encodeURIComponent(tab)}`)
      );

      if (result.ok) {
        sent += 1;
        await markTelegramDelivery(Number(deliveryId), 'sent');
      } else {
        failed += 1;
        await markTelegramDelivery(Number(deliveryId), 'failed', JSON.stringify(result).slice(0, 500));
      }
    }
  }

  return res.status(200).json({ ok: true, sent, skipped, failed, checked: notifications.rows.length, paymentReminders });
}

async function handleMonobankStatus(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await ensureSchema();

  const participantId = await getPortalParticipantId(req);
  if (!participantId) return res.status(401).json({ error: 'Потрібно увійти в кабінет учасника' });

  const { invoiceId, reference } = getQuery(req);
  if (!invoiceId && !reference) return res.status(400).json({ error: 'invoiceId або reference обовʼязковий' });

  const invoiceResult = await pool!.query(
    `SELECT * FROM monobank_payments
     WHERE participant_id = $1
       AND (($2::text IS NOT NULL AND invoice_id = $2) OR ($3::text IS NOT NULL AND reference = $3))
     LIMIT 1`,
    [participantId, invoiceId, reference]
  );
  const invoice = invoiceResult.rows[0];
  if (!invoice) return res.status(404).json({ error: 'Рахунок не знайдено' });

  let statusPayload: any = null;
  const monoToken = await getMonobankToken();
  if (monoToken) {
    try {
      const response = await fetch(`https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoice.invoice_id)}`, {
        headers: { 'X-Token': monoToken },
      });
      const text = await response.text();
      try {
        statusPayload = text ? JSON.parse(text) : null;
      } catch {
        statusPayload = null;
      }

      if (response.ok && statusPayload?.status) {
        const finalAmountKop = asNumber(statusPayload.finalAmount) ?? asNumber(statusPayload.amount) ?? Number(invoice.amount);
        const finalAmountUah = Math.round(finalAmountKop) / 100;
        await pool!.query(
          `UPDATE monobank_payments
           SET status = $1,
               amount = COALESCE($2, amount),
               amount_uah = COALESCE($3, amount_uah),
               raw_payload = $4::jsonb,
               updated_at = CURRENT_TIMESTAMP,
               paid_at = CASE WHEN $1 = 'success' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END
           WHERE id = $5`,
          [statusPayload.status, finalAmountKop, finalAmountUah, JSON.stringify(statusPayload), invoice.id]
        );

        if (statusPayload.status === 'success') {
          await markSuccessfulPayment(invoice, finalAmountUah);
        }

        invoice.status = statusPayload.status;
        invoice.amount_uah = finalAmountUah;
      } else if (!response.ok) {
        console.warn('Monobank status check failed', { status: response.status, invoiceId: invoice.invoice_id, body: statusPayload || text });
      }
    } catch (error) {
      console.warn('Monobank status check error', { invoiceId: invoice.invoice_id, error });
    }
  }

  return res.status(200).json({
    success: true,
    invoiceId: invoice.invoice_id,
    reference: invoice.reference,
    status: statusPayload?.status || invoice.status,
    amountUah: Number(invoice.amount_uah),
    paymentType: invoice.payment_type || 'debit',
    updatedAt: new Date().toISOString(),
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (!pool) return res.status(500).json({ error: 'База даних не налаштована' });

  const mode = getQuery(req).mode;
  if (mode === 'telegram-link') return handleParentTelegramLink(req, res);
  if (mode === 'parent-social-links') return handleParentSocialLinks(req, res);
  if (mode === 'telegram-webhook') return handleTelegramWebhook(req, res);
  if (mode === 'telegram-dispatch') return handleTelegramDispatch(req, res);

  return handleMonobankStatus(req, res);
}
