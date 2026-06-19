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

function getBaseUrl(req: any) {
  const configured = clean(process.env.PUBLIC_SITE_URL) || clean(process.env.SITE_URL) || clean(process.env.APP_URL);
  if (configured) return configured.replace(/\/+$/, '');

  const hostHeader = req.headers?.['x-forwarded-host'] || req.headers?.host || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : String(hostHeader || 'shin-karate.kyiv.ua');
  const protocolHeader = req.headers?.['x-forwarded-proto'];
  const protocol = Array.isArray(protocolHeader) ? protocolHeader[0] : String(protocolHeader || 'https');
  return host.startsWith('http') ? host.replace(/\/+$/, '') : `${protocol}://${host}`.replace(/\/+$/, '');
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
    // Older deployments may not have a settings table yet.
  }

  try {
    const result = await pool.query('SELECT key, value FROM site_content WHERE key = ANY($1)', [keys]);
    for (const key of keys) {
      const value = clean(result.rows.find((row: any) => row.key === key)?.value);
      if (value) return value;
    }
  } catch {
    // site_content is only a fallback for emergency setup.
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

function normalizeAmount(value: unknown) {
  const raw = typeof value === 'string' ? value.replace(',', '.') : value;
  const amountUah = Number(raw);
  if (!Number.isFinite(amountUah)) return null;
  if (amountUah < 1 || amountUah > 100000) return null;
  return Math.round(amountUah * 100) / 100;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!pool) {
    return res.status(500).json({ error: 'База даних не налаштована' });
  }

  const participantId = await getPortalParticipantId(req);
  if (!participantId) {
    return res.status(401).json({ error: 'Потрібно увійти в кабінет учасника' });
  }

  await ensureSchema();

  const monoToken = await getMonobankToken();
  if (!monoToken) {
    return res.status(500).json({ error: 'MONOBANK_TOKEN не налаштований у Vercel або налаштуваннях сайту' });
  }

  const body = await readBody(req);
  const amountUah = normalizeAmount(body.amount ?? body.amountUah);
  if (!amountUah) {
    return res.status(400).json({ error: 'Вкажіть коректну суму від 1 до 100000 грн' });
  }

  const participantResult = await pool.query(
    'SELECT id, name, email, parent_name, parent_phone, phone, member_type FROM participants WHERE id = $1',
    [participantId]
  );
  const participant = participantResult.rows[0];
  if (!participant) {
    return res.status(404).json({ error: 'Учасника не знайдено' });
  }

  const amountKop = Math.round(amountUah * 100);
  const reference = `bbd_${participantId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const baseUrl = getBaseUrl(req);
  const purpose = clean(body.purpose) || `Оплата тренувань BLACK BEAR DOJO: ${participant.name}`;
  const email = clean(participant.email);
  const paymentType = body.paymentType === 'hold' ? 'hold' : 'debit';

  const monoPayload: Record<string, any> = {
    amount: amountKop,
    ccy: 980,
    merchantPaymInfo: {
      reference,
      destination: purpose,
      comment: purpose,
      ...(email ? { customerEmails: [email] } : {}),
    },
    redirectUrl: `${baseUrl}/parent?payment=monobank&invoice=${encodeURIComponent(reference)}`,
    webHookUrl: `${baseUrl}/api/monobank/webhook`,
    validity: 3600,
    paymentType,
  };

  const monoResponse = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Token': monoToken,
      'X-Cms': 'Black Bear Dojo',
      'X-Cms-Version': '1.0.0',
    },
    body: JSON.stringify(monoPayload),
  });

  const monoText = await monoResponse.text();
  let monoData: any = {};
  try {
    monoData = monoText ? JSON.parse(monoText) : {};
  } catch {
    monoData = { error: monoText };
  }

  if (!monoResponse.ok || !monoData?.invoiceId || !monoData?.pageUrl) {
    console.error('Monobank invoice create failed', {
      status: monoResponse.status,
      body: monoData,
      participantId,
    });
    return res.status(502).json({ error: monoData?.errorDescription || monoData?.error || 'Monobank не створив рахунок' });
  }

  await pool.query(
    `INSERT INTO monobank_payments (participant_id, invoice_id, reference, amount, amount_uah, status, page_url, purpose, payment_type, raw_payload)
     VALUES ($1, $2, $3, $4, $5, 'created', $6, $7, $8, $9::jsonb)
     ON CONFLICT (invoice_id) DO UPDATE SET
       page_url = EXCLUDED.page_url,
       updated_at = CURRENT_TIMESTAMP`,
    [
      participantId,
      monoData.invoiceId,
      reference,
      amountKop,
      amountUah,
      monoData.pageUrl,
      purpose,
      paymentType,
      JSON.stringify({ request: { amount: amountKop, ccy: 980, reference, paymentType }, response: monoData }),
    ]
  );

  return res.status(200).json({
    success: true,
    invoiceId: monoData.invoiceId,
    pageUrl: monoData.pageUrl,
  });
}
