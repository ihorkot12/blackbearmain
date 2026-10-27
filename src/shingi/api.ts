export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Запит до /api/shingi/*. Сесія — httpOnly cookie, тож тут ніяких токенів. */
export async function sg<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/shingi/${path}`, {
    method: init.method || 'GET',
    credentials: 'same-origin',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error || `Помилка ${res.status}`, data?.code);
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Щось пішло не так');

/** Поточна дата в Києві, РРРР-ММ-ДД. */
export const kyivToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });

export const ageOnDate = (birth: string, on: string) => {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ey, em, ed] = on.split('-').map(Number);
  return ey - by - (em < bm || (em === bm && ed < bd) ? 1 : 0);
};

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' }) : '—';

export const fmtMoney = (n?: number | null) => `${(n ?? 0).toLocaleString('uk-UA')} грн`;
