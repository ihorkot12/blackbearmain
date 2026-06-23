import pkg from 'pg';
import {
  clean,
  connectTelegramChat,
  consumeTelegramStartToken,
  disableTelegramChat,
  ensureParentTelegramSchema,
  escapeTelegramHtml,
  getParticipantIdsForChat,
  getPortalBaseUrl,
  inlineUrlKeyboard,
  mainReplyKeyboard,
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

const paymentLabel = (status: unknown) => {
  const value = String(status || '').toLowerCase();
  if (['paid', 'оплачено', 'ok', 'success'].includes(value)) return 'Оплачено';
  if (['partial', 'partially_paid'].includes(value)) return 'Частково оплачено';
  return 'Потрібно перевірити оплату';
};

const homeworkStatusLabel = (status: unknown) => {
  const value = String(status || '').toLowerCase();
  if (value === 'approved') return 'зараховано';
  if (value === 'needs_work') return 'потрібно доробити';
  if (value === 'submitted') return 'на перевірці';
  return 'активне';
};

const formatDate = (value: unknown) => {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const readUpdate = async (req: any) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const getChatId = (update: any) =>
  update?.message?.chat?.id || update?.callback_query?.message?.chat?.id || null;

const getText = (update: any) => String(update?.message?.text || '').trim();

const getFrom = (update: any) => update?.message?.from || update?.callback_query?.from || null;

const safeUrl = (path: string) => `${getPortalBaseUrl()}${path}`;

async function getLinkedParticipantIds(chatId: string) {
  if (!pool) return [];
  const ids = await getParticipantIdsForChat(pool, chatId);
  return ids.filter((id: number) => Number.isInteger(id) && id > 0);
}

async function fetchParticipants(ids: number[]) {
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

async function requireConnection(chatId: string) {
  const ids = await getLinkedParticipantIds(chatId);
  if (ids.length > 0) return ids;

  await sendTelegramApi(
    chatId,
    'Telegram ще не підключено до кабінету. Відкрийте кабінет учасника на сайті та натисніть “Підключити Telegram”.'
  );
  return [];
}

async function sendMainMenu(chatId: string, intro?: string) {
  await sendTelegramApi(
    chatId,
    `${intro ? `${intro}\n\n` : ''}Оберіть потрібний розділ нижче.`,
    mainReplyKeyboard()
  );
}

async function sendProfile(chatId: string) {
  const ids = await requireConnection(chatId);
  if (ids.length === 0) return;

  const participants = await fetchParticipants(ids);
  if (participants.length === 0) {
    await sendTelegramApi(chatId, 'Не знайшов активний профіль. Перевірте доступ у кабінеті.');
    return;
  }

  const hasChildren = participants.some((p: any) => p.member_type !== 'adult');
  const title = hasChildren ? 'Ваші діти в BLACK BEAR DOJO' : 'Ваш профіль BLACK BEAR DOJO';
  const lines = participants.map((p: any) => [
    `<b>${escapeTelegramHtml(p.name)}</b>`,
    `Група: ${escapeTelegramHtml(p.group_name || 'ще не призначена')}`,
    `Тренер: ${escapeTelegramHtml(p.coach_name || 'уточнюється')}`,
    `Локація: ${escapeTelegramHtml(p.location_name || 'уточнюється')}`,
    `Пояс: ${escapeTelegramHtml(p.belt || 'Білий')}`,
    `Бали: ${Number(p.rank_points || 0)}`,
    `Оплата: ${paymentLabel(p.payment_status)}`
  ].join('\n'));

  await sendTelegramApi(chatId, `${title}\n\n${lines.join('\n\n')}`, inlineUrlKeyboard('Відкрити кабінет', safeUrl('/parent')));
}

async function sendHomework(chatId: string) {
  const ids = await requireConnection(chatId);
  if (ids.length === 0 || !pool) return;

  const result = await pool.query(
    `SELECT p.name AS participant_name, ha.id, ha.title, ha.description, ha.due_date,
            ha.estimated_minutes, hap.status, hap.points_awarded, c.name AS coach_name
     FROM homework_assignment_participants hap
     JOIN homework_assignments ha ON ha.id = hap.assignment_id
     JOIN participants p ON p.id = hap.participant_id
     LEFT JOIN coaches c ON c.id = ha.coach_id
     WHERE hap.participant_id = ANY($1::int[])
       AND COALESCE(ha.status, 'active') = 'active'
     ORDER BY COALESCE(ha.due_date, ha.created_at::date) ASC, ha.created_at DESC
     LIMIT 10`,
    [ids]
  );

  if (result.rows.length === 0) {
    await sendTelegramApi(chatId, 'Активних домашніх завдань зараз немає.', inlineUrlKeyboard('Кабінет ДЗ', safeUrl('/parent?tab=homework')));
    return;
  }

  const items = result.rows.map((row: any) => {
    const due = row.due_date ? `\nДо: ${formatDate(row.due_date)}` : '';
    const minutes = row.estimated_minutes ? `\nЧас: приблизно ${Number(row.estimated_minutes)} хв` : '';
    const points = Number(row.points_awarded || 0) > 0 ? `\nБали: +${Number(row.points_awarded)}` : '';
    return `<b>${escapeTelegramHtml(row.participant_name)}</b>\n${escapeTelegramHtml(row.title)}\nСтатус: ${homeworkStatusLabel(row.status)}${due}${minutes}${points}`;
  });

  await sendTelegramApi(chatId, `Домашні завдання\n\n${items.join('\n\n')}`, inlineUrlKeyboard('Відкрити ДЗ', safeUrl('/parent?tab=homework')));
}

async function sendManual(chatId: string) {
  const text = [
    '<b>Коротка методичка BLACK BEAR DOJO</b>',
    '',
    '<b>Пояси і кю</b>\nШлях починається з білого поясу. Кю показує рівень підготовки: техніка, дисципліна, витривалість і розуміння етикету.',
    '<b>Базові терміни</b>\nОсу - вітання і знак поваги. Додзьо - зал тренувань. Сенсей - тренер. Кіхон - базова техніка. Куміте - поєдинок. Ката - формальна послідовність технік.',
    '<b>Поведінка в залі</b>\nПриходити вчасно, слухати тренера, берегти партнерів, не бігати залом без дозволу, підтримувати чисту форму.',
    '<b>Змагання</b>\nГоловне - безпека, правила контакту, повага до суперника і суддів. Результат важливий, але досвід важливіший.',
    '<b>Коли починати змагання</b>\nКоли дитина стабільно тренується, готова слухати команди, не боїться контакту і тренер бачить психологічну готовність.',
    '<b>Що знати батькам</b>\nРегулярність, сон, вода, харчування і спокійна підтримка дають більше, ніж тиск на результат.',
    '<b>Атестація</b>\nПідготовка - це техніка, фізична форма, терміни, етикет і стабільність на тренуваннях.'
  ].join('\n\n');

  await sendTelegramApi(chatId, text, inlineUrlKeyboard('Повна методичка в кабінеті', safeUrl('/parent?tab=manual')));
}

async function sendSchedule(chatId: string) {
  const ids = await requireConnection(chatId);
  if (ids.length === 0 || !pool) return;

  const result = await pool.query(
    `SELECT DISTINCT p.name AS participant_name, s.day_of_week, s.start_time, s.end_time,
            s.group_name, s.price, l.name AS location_name, c.name AS coach_name
     FROM participants p
     LEFT JOIN groups g ON g.id = p.group_id
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
    await sendTelegramApi(chatId, 'Розклад для вашої групи ще уточнюється. Повний розклад доступний у кабінеті.', inlineUrlKeyboard('Відкрити розклад', safeUrl('/parent?tab=schedule')));
    return;
  }

  const items = result.rows.map((row: any) => {
    const time = `${row.start_time || ''}${row.end_time ? `-${row.end_time}` : ''}`;
    return `<b>${escapeTelegramHtml(row.participant_name)}</b>\n${escapeTelegramHtml(row.day_of_week || '')} ${escapeTelegramHtml(time)}\n${escapeTelegramHtml(row.group_name || '')}\n${escapeTelegramHtml(row.location_name || 'Локація уточнюється')}\nТренер: ${escapeTelegramHtml(row.coach_name || 'уточнюється')}`;
  });

  await sendTelegramApi(chatId, `Розклад\n\n${items.join('\n\n')}`, inlineUrlKeyboard('Відкрити кабінет', safeUrl('/parent?tab=schedule')));
}

async function sendPayments(chatId: string) {
  const ids = await requireConnection(chatId);
  if (ids.length === 0 || !pool) return;

  const participants = await fetchParticipants(ids);
  const payments = await pool.query(
    `SELECT p.name AS participant_name, pay.amount, pay.date, pay.type, pay.method
     FROM payments pay
     JOIN participants p ON p.id = pay.participant_id
     WHERE pay.participant_id = ANY($1::int[])
     ORDER BY pay.date DESC, pay.created_at DESC
     LIMIT 5`,
    [ids]
  );

  const statusLines = participants.map((p: any) => `<b>${escapeTelegramHtml(p.name)}</b>: ${paymentLabel(p.payment_status)}`);
  const history = payments.rows.length
    ? payments.rows.map((row: any) => `${escapeTelegramHtml(row.participant_name)} - ${Number(row.amount || 0)} грн, ${formatDate(row.date)}`).join('\n')
    : 'Останніх оплат у базі не знайдено.';

  await sendTelegramApi(chatId, `Оплата\n\n${statusLines.join('\n')}\n\nОстанні платежі:\n${history}`, inlineUrlKeyboard('Відкрити оплату', safeUrl('/parent?tab=payments')));
}

async function sendProgress(chatId: string) {
  const ids = await requireConnection(chatId);
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

  const lines = result.rows.map((row: any) => [
    `<b>${escapeTelegramHtml(row.name)}</b>`,
    `Пояс: ${escapeTelegramHtml(row.belt || 'Білий')}`,
    `Рейтинг/бали: ${Number(row.rank_points || 0)}`,
    `ДЗ зараховано: ${Number(row.homework_approved || 0)} з ${Number(row.homework_total || 0)}`
  ].join('\n'));

  await sendTelegramApi(chatId, `Прогрес\n\n${lines.join('\n\n')}`, inlineUrlKeyboard('Відкрити прогрес', safeUrl('/parent?tab=progress')));
}

async function sendNotifications(chatId: string) {
  const ids = await requireConnection(chatId);
  if (ids.length === 0 || !pool) return;

  const result = await pool.query(
    `SELECT p.name AS participant_name, n.type, n.message, n.created_at
     FROM notifications n
     JOIN participants p ON p.id = n.participant_id
     WHERE n.participant_id = ANY($1::int[])
       AND n.type = ANY($2::text[])
     ORDER BY n.created_at DESC
     LIMIT 8`,
    [ids, IMPORTANT_TYPES]
  );

  if (result.rows.length === 0) {
    await sendTelegramApi(chatId, 'Важливих сповіщень поки немає.');
    return;
  }

  const lines = result.rows.map((row: any) => `<b>${escapeTelegramHtml(row.participant_name)}</b> - ${formatDate(row.created_at)}\n${escapeTelegramHtml(row.message)}`);
  await sendTelegramApi(chatId, `Останні важливі сповіщення\n\n${lines.join('\n\n')}`, inlineUrlKeyboard('Відкрити кабінет', safeUrl('/parent?tab=notifications')));
}

async function handleMessage(chatId: string, text: string, from: any) {
  if (text.startsWith('/start')) {
    const [, rawToken] = text.split(/\s+/, 2);
    const token = String(rawToken || '').trim();

    if (!token) {
      await sendTelegramApi(chatId, 'Вітаю! Щоб підключити Telegram, відкрийте персональне посилання з кабінету учасника.');
      return;
    }

    if (!pool) {
      await sendTelegramApi(chatId, 'База даних тимчасово недоступна. Спробуйте трохи пізніше.');
      return;
    }

    const consumed = await consumeTelegramStartToken(pool, token);
    if (!consumed) {
      await sendTelegramApi(chatId, 'Посилання вже використане або застаріло. Створіть нове посилання в кабінеті й натисніть Start ще раз.');
      return;
    }

    await connectTelegramChat(pool, {
      participantId: Number(consumed.participant_id),
      accessId: consumed.access_id ? Number(consumed.access_id) : null,
      chatId,
      user: from
    });

    await sendMainMenu(chatId, 'Telegram підключено до кабінету BLACK BEAR DOJO. Тут будуть тільки важливі персональні повідомлення: ДЗ, оплата, повідомлення тренера та важливі оголошення.');
    return;
  }

  if (text === '/stop' || text === 'Відключити Telegram') {
    if (pool) await disableTelegramChat(pool, chatId);
    await sendTelegramApi(chatId, 'Telegram-сповіщення вимкнено для цього чату. Інші підключені батьки або учасники залишаються підключеними.');
    return;
  }

  if (text === 'Мої діти / Мій профіль') return sendProfile(chatId);
  if (text === 'Домашні завдання') return sendHomework(chatId);
  if (text === 'Методичка') return sendManual(chatId);
  if (text === 'Розклад') return sendSchedule(chatId);
  if (text === 'Оплата') return sendPayments(chatId);
  if (text === 'Прогрес') return sendProgress(chatId);
  if (text === 'Сповіщення') return sendNotifications(chatId);
  if (text === 'Відкрити кабінет') {
    await sendTelegramApi(chatId, 'Кабінет BLACK BEAR DOJO:', inlineUrlKeyboard('Відкрити кабінет', safeUrl('/parent')));
    return;
  }

  await sendMainMenu(chatId, 'Не зовсім зрозумів команду.');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

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
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    await ensureParentTelegramSchema(pool);

    const update = await readUpdate(req);
    const chatIdRaw = getChatId(update);
    const chatId = chatIdRaw ? String(chatIdRaw) : '';
    if (!chatId) return res.status(200).json({ ok: true });

    await handleMessage(chatId, getText(update), getFrom(update));
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Parent Telegram webhook failed:', error);
    res.status(200).json({ ok: true });
  }
}
