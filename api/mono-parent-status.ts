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
    ALTER TABLE monobank_payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'debit';
  `);
}

async function getParentParticipantId(req: any): Promise<number | null> {
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

async function markSuccessfulPayment(invoice: any, amountUah: number) {
  if (!pool) return;
  const referenceId = `monobank:${invoice.invoice_id}`;
  const now = new Date();

  await pool.query(
    `INSERT INTO payments (participant_id, amount, date, month, year, type, method, notes, reference_id)
     SELECT $1, $2, CURRENT_DATE, $3, $4, 'subscription', 'monobank', $5, $6
     WHERE NOT EXISTS (SELECT 1 FROM payments WHERE reference_id = $6)`,
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

  const participantId = await getParentParticipantId(req);
  if (!participantId) return res.status(401).json({ error: 'Потрібно увійти в батьківський кабінет' });

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
