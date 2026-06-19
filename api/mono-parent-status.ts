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

const AUTH_TOKEN_PREFIX = 'bb1';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.DATABASE_URL
    ? crypto.createHash('sha256').update(`black-bear-session:${process.env.DATABASE_URL}`).digest('hex')
    : 'black-bear-local-dev-secret');

const clean = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function htmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatAmount(amountUah: number) {
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: Number.isInteger(amountUah) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountUah);
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
  `);
}

async function getPortalParticipantId(req: any): Promise<number | null> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!authValue?.startsWith('Bearer ')) return null;

  const tokenPayload = verifyAuthToken(authValue.slice('Bearer '.length));
  if (tokenPayload?.role !== 'parent') return null;
  return Number(tokenPayload.sub);
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
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!pool) return res.status(500).json({ error: 'База даних не налаштована' });
  await ensureSchema();

  const participantId = await getPortalParticipantId(req);
  if (!participantId) return res.status(401).json({ error: 'Потрібно увійти в кабінет учасника' });

  const { invoiceId, reference } = getQuery(req);
  if (!invoiceId && !reference) return res.status(400).json({ error: 'invoiceId або reference обовʼязковий' });

  const invoiceResult = await pool.query(
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
        await pool.query(
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
