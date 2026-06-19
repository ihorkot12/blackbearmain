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

let cachedPubKeyBase64: string | null = null;

const clean = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

async function readRawBody(req: any) {
  if (typeof req.body === 'string') {
    const rawBody = req.body;
    return { rawBody, payload: parseJson(rawBody) };
  }

  if (req.body && typeof req.body === 'object') {
    const rawBody = JSON.stringify(req.body);
    return { rawBody, payload: req.body };
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return { rawBody, payload: parseJson(rawBody) };
}

function parseJson(rawBody: string) {
  if (!rawBody.trim()) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
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
    // Older deployments may not have settings table yet.
  }

  try {
    const result = await pool.query('SELECT key, value FROM site_content WHERE key = ANY($1)', [keys]);
    for (const key of keys) {
      const value = clean(result.rows.find((row: any) => row.key === key)?.value);
      if (value) return value;
    }
  } catch {
    // Emergency fallback only.
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

async function getMonobankPubKey(forceRefresh = false) {
  if (cachedPubKeyBase64 && !forceRefresh) return cachedPubKeyBase64;

  const monoToken = await getMonobankToken();
  if (!monoToken) throw new Error('Monobank token is not configured');

  const response = await fetch('https://api.monobank.ua/api/merchant/pubkey', {
    method: 'GET',
    headers: { 'X-Token': monoToken },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Monobank pubkey request failed: ${response.status}`);
  }

  let pubKeyBase64 = text.trim();
  try {
    const parsed = JSON.parse(text);
    pubKeyBase64 = clean(parsed.key) || clean(parsed.publicKey) || clean(parsed.pubkey) || pubKeyBase64;
  } catch {
    // The API can return a plain base64 string.
  }

  if (!pubKeyBase64) throw new Error('Monobank pubkey is empty');
  cachedPubKeyBase64 = pubKeyBase64;
  return pubKeyBase64;
}

async function verifyMonobankSignature(rawBody: string, xSign: string | null) {
  if (!xSign || !rawBody) return false;

  const verifyWithKey = async (forceRefresh = false) => {
    const pubKeyBase64 = await getMonobankPubKey(forceRefresh);
    const verifier = crypto.createVerify('SHA256');
    verifier.write(rawBody);
    verifier.end();
    return verifier.verify(Buffer.from(pubKeyBase64, 'base64'), Buffer.from(xSign, 'base64'));
  };

  try {
    if (await verifyWithKey(false)) return true;
    cachedPubKeyBase64 = null;
    return await verifyWithKey(true);
  } catch (error) {
    console.error('Monobank webhook signature verification failed:', error);
    return false;
  }
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

    CREATE TABLE IF NOT EXISTS monobank_webhook_logs (
      id SERIAL PRIMARY KEY,
      invoice_id TEXT,
      reference TEXT,
      status TEXT,
      amount INTEGER,
      signature_valid BOOLEAN DEFAULT FALSE,
      headers JSONB,
      payload JSONB,
      raw_body TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

const asNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

async function logWebhook(params: {
  payload: any;
  rawBody: string;
  signatureValid: boolean;
  headers: Record<string, any>;
}) {
  if (!pool) return;
  const payload = params.payload || {};
  await pool.query(
    `INSERT INTO monobank_webhook_logs (invoice_id, reference, status, amount, signature_valid, headers, payload, raw_body)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
    [
      typeof payload.invoiceId === 'string' ? payload.invoiceId : null,
      typeof payload.reference === 'string' ? payload.reference : null,
      typeof payload.status === 'string' ? payload.status : null,
      asNumber(payload.finalAmount) ?? asNumber(payload.amount),
      params.signatureValid,
      JSON.stringify(params.headers),
      JSON.stringify(payload),
      params.rawBody.slice(0, 20000),
    ]
  );
}

async function markSuccessfulPayment(invoice: any, finalAmountUah: number) {
  if (!pool) return;
  const referenceId = `monobank:${invoice.invoice_id}`;
  const paymentDate = new Date();
  const month = paymentDate.getMonth() + 1;
  const year = paymentDate.getFullYear();

  await pool.query(
    `INSERT INTO payments (participant_id, amount, date, month, year, type, method, notes, reference_id)
     SELECT $1, $2, CURRENT_DATE, $3, $4, 'subscription', 'monobank', $5, $6
     WHERE NOT EXISTS (SELECT 1 FROM payments WHERE reference_id = $6)`,
    [
      invoice.participant_id,
      finalAmountUah,
      month,
      year,
      `Оплата monobank, рахунок ${invoice.invoice_id}`,
      referenceId,
    ]
  );

  await pool.query(
    "UPDATE participants SET payment_status = 'paid' WHERE id = $1",
    [invoice.participant_id]
  );
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!pool) {
    return res.status(200).json({ success: true, skipped: 'database_not_configured' });
  }

  await ensureSchema();

  const { rawBody, payload } = await readRawBody(req);
  const xSignHeader = req.headers?.['x-sign'] || req.headers?.['X-Sign'];
  const xSign = Array.isArray(xSignHeader) ? xSignHeader[0] : clean(xSignHeader);
  const headersForLog = {
    'content-type': req.headers?.['content-type'] || null,
    'user-agent': req.headers?.['user-agent'] || null,
    'x-sign-present': Boolean(xSign),
  };
  const signatureValid = await verifyMonobankSignature(rawBody, xSign);

  await logWebhook({ payload, rawBody, signatureValid, headers: headersForLog });

  if (!signatureValid) {
    return res.status(401).json({ error: 'Invalid monobank webhook signature' });
  }

  const invoiceId = typeof payload.invoiceId === 'string' ? payload.invoiceId : null;
  const reference = typeof payload.reference === 'string' ? payload.reference : null;
  const status = typeof payload.status === 'string' ? payload.status : 'unknown';

  if (!invoiceId && !reference) {
    return res.status(200).json({ success: true, skipped: 'missing_invoice' });
  }

  const invoiceResult = await pool.query(
    `SELECT * FROM monobank_payments
     WHERE ($1::text IS NOT NULL AND invoice_id = $1) OR ($2::text IS NOT NULL AND reference = $2)
     LIMIT 1`,
    [invoiceId, reference]
  );
  const invoice = invoiceResult.rows[0];

  if (!invoice) {
    console.warn('Monobank webhook for unknown invoice', { invoiceId, reference, status });
    return res.status(200).json({ success: true, skipped: 'unknown_invoice' });
  }

  const finalAmountKop = asNumber(payload.finalAmount) ?? asNumber(payload.amount) ?? Number(invoice.amount);
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
    [status, finalAmountKop, finalAmountUah, JSON.stringify(payload), invoice.id]
  );

  if (status === 'success') {
    await markSuccessfulPayment(invoice, finalAmountUah);
  }

  return res.status(200).json({ success: true });
}
