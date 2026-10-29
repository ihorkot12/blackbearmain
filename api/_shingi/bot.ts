import crypto from 'crypto';
import type { FeeInfo } from './fee.js';

/** Секрет вебхука виводимо з токена бота — нову змінну середовища заводити не потрібно. */
export const webhookSecret = (botToken: string) =>
  crypto.createHash('sha256').update(`${botToken}:shingi-webhook`).digest('hex');

export const secretMatches = (given: unknown, botToken: string) => {
  if (typeof given !== 'string' || !botToken) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(webhookSecret(botToken));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** Вітання бота. Умови внеску беруться з події (`fee`), тому змінюються разом із налаштуваннями в адмінці. */
export const welcomeText = (fee?: FeeInfo) =>
  'SHIN GI · Kyokushin Open — спаринг-день у залі-сховищі на Шулявці. Два блоки: діти до 18 і дорослі 14+/18+. ' +
  `Групи за статтю, віком, вагою і поясом (A · B · C). ${fee ? `${fee.sentence}, ` : ''}медаль і грамота кожному. Відкрито для всіх клубів.\n\n` +
  'Натисніть кнопку нижче — кабінет відкриється просто в Telegram, без паролів.';

export type StartReply = { text: string; buttonText: string; url: string };

/** Відповідь на /start: deep-link `team` і `solo` ведуть на анкету з потрібною роллю, решта — у кабінет. */
export function startReply(messageText: string, baseUrl: string, fee?: FeeInfo): StartReply | null {
  const match = /^\/start(?:@\w+)?(?:\s+(\S+))?/.exec(messageText.trim());
  if (!match) return null;
  const base = baseUrl.replace(/\/+$/, '');
  const payload = match[1];
  const text = welcomeText(fee);
  if (payload === 'team') return { text, buttonText: 'Зареєструвати команду', url: `${base}/shin-gi/register?role=coach` };
  if (payload === 'solo') return { text, buttonText: 'Я боєць — реєстрація', url: `${base}/shin-gi/register?role=solo` };
  return { text, buttonText: 'Відкрити кабінет', url: `${base}/shin-gi/cabinet` };
}

export const publicBaseUrl = () =>
  (process.env.PUBLIC_BASE_URL || process.env.APP_URL || 'https://shin-karate.kyiv.ua').trim().replace(/\/+$/, '');
