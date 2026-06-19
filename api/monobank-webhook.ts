import pkg from 'pg';

const { Pool } = pkg;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

async function readBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
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
  `);
}

const asNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

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

  const payload = await readBody(req);
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
  const paidAt = status === 'success' ? new Date() : null;

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
    const referenceId = `monobank:${invoice.invoice_id}`;
    const paymentDate = paidAt || new Date();
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

  return res.status(200).json({ success: true });
}
