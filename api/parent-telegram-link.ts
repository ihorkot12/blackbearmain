import pkg from 'pg';
import {
  createTelegramStartToken,
  ensureParentTelegramSchema,
  getParentBotUsername,
  getParentPortalAuth,
  getPortalBaseUrl,
  resolveTelegramAccess
} from './telegram-parent-utils';

const { Pool } = pkg;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  try {
    await ensureParentTelegramSchema(pool);

    const auth = await getParentPortalAuth(req, pool);
    if (!auth) {
      return res.status(401).json({ error: 'Потрібно увійти в кабінет учасника' });
    }

    const accessId = await resolveTelegramAccess(pool, auth.participantId, auth.accessId);
    const startToken = await createTelegramStartToken(pool, auth.participantId, accessId);
    const botUsername = getParentBotUsername();
    const connectUrl = `https://t.me/${botUsername}?start=${encodeURIComponent(startToken)}`;

    const status = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE enabled = TRUE)::int AS connected_count,
         BOOL_OR(enabled = TRUE AND access_id = $1)::boolean AS current_access_connected
       FROM telegram_subscriptions
       WHERE participant_id = $2`,
      [accessId, auth.participantId]
    );

    res.json({
      botUsername,
      connectUrl,
      connected: Boolean(status.rows[0]?.current_access_connected),
      connectedCount: Number(status.rows[0]?.connected_count || 0),
      cabinetUrl: `${getPortalBaseUrl()}/parent`
    });
  } catch (error) {
    console.error('Failed to create parent Telegram link:', error);
    res.status(500).json({ error: 'Failed to create Telegram link' });
  }
}
