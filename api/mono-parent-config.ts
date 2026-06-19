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

const isEnabledValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return true;
  return !FALSE_VALUES.has(String(value).trim().toLowerCase());
};

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

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

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
