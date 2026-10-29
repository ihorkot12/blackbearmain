/**
 * Автонагадування тренерам: хто, коли й що отримує. Чиста логіка без БД і Telegram — її легко перевіряти тестами.
 * Нагадуємо за 3 дні, за 1 день і в останній день: про подання заявок і про внесок.
 */
export const REMINDER_DAYS = [3, 1, 0] as const;

export type ReminderKind = 'apps' | 'pay';
export type DueReminder = { key: string; kind: ReminderKind; days: number; deadline: string };

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Які нагадування сьогодні «настали». Лише поки реєстрація відкрита; про внесок — лише для платних подій. */
export function dueReminders(
  event: { status: string; deadline_apps: string | null; deadline_pay: string | null; fee_uah: number },
  today: string,
): DueReminder[] {
  if (event.status !== 'registration') return [];
  const out: DueReminder[] = [];
  const consider = (kind: ReminderKind, deadline: string | null) => {
    if (!deadline) return;
    const days = dayDiff(today, deadline.slice(0, 10));
    if ((REMINDER_DAYS as readonly number[]).includes(days)) out.push({ key: `${kind}:d${days}`, kind, days, deadline: deadline.slice(0, 10) });
  };
  consider('apps', event.deadline_apps);
  if (event.fee_uah > 0) consider('pay', event.deadline_pay);
  return out;
}

const dayWord = (days: number) => (days === 0 ? 'сьогодні останній день' : days === 1 ? 'залишився 1 день' : `залишилось ${days} дні`);

const formatDeadline = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

/** Текст нагадування. Для внеску — персонально: скільки бійців чекає оплати й на яку суму. */
export function reminderText(
  reminder: Pick<DueReminder, 'kind' | 'days' | 'deadline'>,
  context: { unpaid: number; feeUah: number; noun?: string },
): string {
  const until = formatDeadline(reminder.deadline);
  if (reminder.kind === 'apps') {
    return `Нагадування SHIN GI: заявки приймаються до ${until} (${dayWord(reminder.days)}). Подайте бійців у кабінеті.`;
  }
  const noun = context.noun || 'внесок';
  const sum = context.unpaid * context.feeUah;
  const who = context.unpaid > 0 ? ` Чекає оплати: ${context.unpaid} бійц., ${sum} грн.` : '';
  return `Нагадування SHIN GI: ${noun} потрібно сплатити до ${until} (${dayWord(reminder.days)}).${who} Оплата в кабінеті.`;
}

/** Мітка питання в повідомленні для штабу: за нею бот знаходить питання, коли організатор відповідає реплаєм. */
export const questionTag = (id: number) => `#Q${id}`;

export function parseQuestionTag(text: unknown): number | null {
  const match = /#Q(\d{1,9})\b/.exec(String(text ?? ''));
  return match ? Number(match[1]) : null;
}
