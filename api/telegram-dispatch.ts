import pkg from 'pg';
import {
  ensureParentTelegramSchema,
  escapeTelegramHtml,
  getParentBotToken,
  getPortalBaseUrl,
  getTelegramRecipientsForParticipant,
  inlineUrlKeyboard,
  sendTelegramApi
} from './telegram-parent-utils';

const { Pool } = pkg;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

const IMPORTANT_TYPES = [
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

const typeLabels: Record<string, string> = {
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

const tabByType: Record<string, string> = {
  homework: 'homework',
  homework_review: 'homework',
  payment: 'payments',
  message: 'messages',
  manual: 'notifications',
  announcement: 'notifications',
  absence: 'notifications',
  birthday: 'notifications',
  personal_event: 'notifications',
  coach_message: 'messages'
};

const getAuthHeader = (req: any) => {
  const header = req.headers?.authorization || req.headers?.Authorization;
  return Array.isArray(header) ? header[0] : header;
};

const getNotificationUrl = (type: string) => {
  const tab = tabByType[type] || 'notifications';
  return `${getPortalBaseUrl()}/parent?tab=${encodeURIComponent(tab)}`;
};

const makeNotificationText = (row: any) => {
  const label = typeLabels[row.type] || 'Важливе повідомлення';
  const name = row.participant_name ? `${escapeTelegramHtml(row.participant_name)}\n` : '';
  return `<b>${escapeTelegramHtml(label)}</b>\n${name}${escapeTelegramHtml(row.message)}`;
};

async function reserveDelivery(notificationId: number, participantId: number, chatId: string) {
  if (!pool) return null;
  const result = await pool.query(
    `INSERT INTO telegram_notification_deliveries
       (notification_id, participant_id, telegram_chat_id, status, updated_at)
     VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
     ON CONFLICT (notification_id, telegram_chat_id)
     DO UPDATE SET
       status = CASE
         WHEN telegram_notification_deliveries.status = 'sent' THEN telegram_notification_deliveries.status
         ELSE 'pending'
       END,
       error = CASE
         WHEN telegram_notification_deliveries.status = 'sent' THEN telegram_notification_deliveries.error
         ELSE NULL
       END,
       updated_at = CURRENT_TIMESTAMP
     WHERE telegram_notification_deliveries.status IS DISTINCT FROM 'sent'
     RETURNING id`,
    [notificationId, participantId, chatId]
  );
  return result.rows[0]?.id || null;
}

async function markDelivery(id: number, status: string, error?: string) {
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

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && getAuthHeader(req) !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  try {
    await ensureParentTelegramSchema(pool);

    if (!getParentBotToken()) {
      return res.status(200).json({ ok: true, sent: 0, skipped: 'TELEGRAM_PARENT_BOT_TOKEN is not configured' });
    }

    const notifications = await pool.query(
      `SELECT n.id, n.participant_id, n.type, n.message, n.created_at, p.name AS participant_name
       FROM notifications n
       JOIN participants p ON p.id = n.participant_id
       WHERE n.type = ANY($1::text[])
         AND n.created_at >= CURRENT_TIMESTAMP - INTERVAL '21 days'
       ORDER BY n.created_at ASC
       LIMIT 80`,
      [IMPORTANT_TYPES]
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const notification of notifications.rows) {
      const recipients = await getTelegramRecipientsForParticipant(pool, Number(notification.participant_id));
      if (recipients.length === 0) {
        skipped += 1;
        continue;
      }

      for (const recipient of recipients) {
        const deliveryId = await reserveDelivery(Number(notification.id), Number(notification.participant_id), recipient.chatId);
        if (!deliveryId) {
          skipped += 1;
          continue;
        }

        const result = await sendTelegramApi(
          recipient.chatId,
          makeNotificationText(notification),
          inlineUrlKeyboard('Відкрити кабінет', getNotificationUrl(notification.type))
        );

        if (result.ok) {
          sent += 1;
          await markDelivery(Number(deliveryId), 'sent');
        } else {
          failed += 1;
          await markDelivery(Number(deliveryId), 'failed', JSON.stringify(result).slice(0, 500));
        }
      }
    }

    res.status(200).json({ ok: true, sent, skipped, failed, checked: notifications.rows.length });
  } catch (error) {
    console.error('Telegram dispatch failed:', error);
    res.status(500).json({ error: 'Telegram dispatch failed' });
  }
}
