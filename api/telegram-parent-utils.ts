import crypto from 'crypto';
import fetch from 'node-fetch';

export type AuthTokenRole = 'admin' | 'coach' | 'parent';
export type AuthTokenPayload = {
  sub: string;
  role: AuthTokenRole;
  accessId?: number | null;
  iat: number;
  exp: number;
};

export type TelegramRecipient = {
  chatId: string;
  participantId: number;
  accessId?: number | null;
};

const AUTH_TOKEN_PREFIX = 'bb1';
const START_TOKEN_TTL_MINUTES = 20;

export const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.DATABASE_URL
    ? crypto.createHash('sha256').update(`black-bear-session:${process.env.DATABASE_URL}`).digest('hex')
    : 'black-bear-local-dev-secret');

export const clean = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

export const escapeTelegramHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const normalizeDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

export const getPortalBaseUrl = () =>
  (clean(process.env.APP_URL) || 'https://shin-karate.kyiv.ua').replace(/\/$/, '');

export const getParentBotUsername = () =>
  clean(process.env.TELEGRAM_PARENT_BOT_USERNAME) || 'karate_kyiv_bot';

export const getParentBotToken = () => clean(process.env.TELEGRAM_PARENT_BOT_TOKEN);

const signAuthTokenPayload = (encodedPayload: string) =>
  crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url');

export const verifyAuthToken = (token: string): AuthTokenPayload | null => {
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

export const getBearerPayload = (req: any): AuthTokenPayload | null => {
  const header = req.headers?.authorization || req.headers?.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;
  return verifyAuthToken(value.slice('Bearer '.length));
};

export async function ensureParentTelegramSchema(pool: any) {
  await pool.query(`
    ALTER TABLE participant_accesses ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
    ALTER TABLE participant_accesses ADD COLUMN IF NOT EXISTS telegram_connected_at TIMESTAMP;
    ALTER TABLE participant_accesses ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT TRUE;

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

export async function getParentPortalAuth(req: any, pool: any) {
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

export async function resolveTelegramAccess(pool: any, participantId: number, accessId?: number | null) {
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

export async function createTelegramStartToken(pool: any, participantId: number, accessId: number) {
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

export async function consumeTelegramStartToken(pool: any, token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
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

export async function connectTelegramChat(pool: any, params: {
  participantId: number;
  accessId: number | null;
  chatId: string;
  user?: any;
}) {
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

  await pool.query(
    `UPDATE participants
     SET telegram_chat_id = $1
     WHERE id = $2`,
    [params.chatId, params.participantId]
  );
}

export async function disableTelegramChat(pool: any, chatId: string) {
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
}

const lower = (value: unknown) => String(value ?? '').trim().toLowerCase();

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

export async function getTelegramRecipientsForParticipant(pool: any, participantId: number): Promise<TelegramRecipient[]> {
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

export async function getParticipantIdsForChat(pool: any, chatId: string) {
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

export function mainReplyKeyboard() {
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

export function inlineUrlKeyboard(label: string, url: string) {
  return { inline_keyboard: [[{ text: label, url }]] };
}

export async function sendTelegramApi(chatId: string, text: string, replyMarkup?: any) {
  const token = getParentBotToken();
  if (!token) return { ok: false, skipped: 'missing_parent_bot_token' };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
}

export async function sendImportantTelegramToParticipant(pool: any, participantId: number, text: string, url?: string) {
  await ensureParentTelegramSchema(pool);
  const recipients = await getTelegramRecipientsForParticipant(pool, participantId);
  const replyMarkup = url ? inlineUrlKeyboard('Відкрити кабінет', url) : undefined;
  const results = [];
  for (const recipient of recipients) {
    results.push(await sendTelegramApi(recipient.chatId, text, replyMarkup));
  }
  return results;
}
