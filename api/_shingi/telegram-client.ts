/** Мінімальний клієнт Bot API для @shingii_bot. Токен — лише з SHINGI_BOT_TOKEN, ніколи не логуємо. */

export const getBotToken = () => (process.env.SHINGI_BOT_TOKEN || '').trim();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function tgCall(method: string, payload: Record<string, unknown> = {}, attempt = 0): Promise<any> {
  const token = getBotToken();
  if (!token) throw new Error('SHINGI_BOT_TOKEN is not set');

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data: any = await response.json().catch(() => ({}));

  // ліміти Telegram: повторюємо за retry_after, не більше двох разів
  if (response.status === 429 && attempt < 2) {
    await sleep(Math.min(Number(data?.parameters?.retry_after) || 1, 10) * 1000);
    return tgCall(method, payload, attempt + 1);
  }
  if (!data?.ok) throw new Error(`Telegram ${method}: ${data?.description || response.status}`);
  return data.result;
}

export const sendMessage = (chatId: number | string, text: string, extra: Record<string, unknown> = {}) =>
  tgCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
