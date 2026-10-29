import { grossUp, parseFeePercent, type Quote } from '../_shared/card-fee.js';
import type { PAYMENT_STATUSES } from './db.js';

export { grossUp, type Quote };

type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MONO_API = 'https://api.monobank.ua';

/** Комісія еквайрингу, яку закладаємо платнику. Фактичну ставку беремо з договору — змінна SHINGI_CARD_FEE_PERCENT. */
export const monoToken = () => (process.env.SHINGI_MONO_TOKEN || '').trim();

export const cardFeePercent = (raw: string | undefined = process.env.SHINGI_CARD_FEE_PERCENT): number => parseFeePercent(raw);

export const toKopecks = (uah: number) => Math.round(uah * 100);

/** Статус рахунку Monobank → статус платежу в нашій БД. `hold` — гроші заблоковано, але ще не списано. */
export function mapMonoStatus(status: unknown): PaymentStatus {
  switch (String(status)) {
    case 'success':
      return 'success';
    case 'failure':
      return 'failure';
    case 'expired':
      return 'expired';
    case 'reversed':
      return 'reversed';
    case 'processing':
    case 'hold':
      return 'processing';
    default:
      return 'created';
  }
}

export const isFinalStatus = (status: string) => ['success', 'failure', 'expired', 'reversed'].includes(status);

export function invoiceBody(opts: { reference: string; quote: Quote; fighters: number; eventTitle: string; baseUrl: string }) {
  const { reference, quote, fighters, eventTitle, baseUrl } = opts;
  let destination = `${eventTitle}: внесок за ${fighters} бійц. — ${quote.base_uah} грн`;
  if (quote.fee_uah > 0) destination += ` + комісія банку ${quote.fee_uah} грн`;
  return {
    amount: toKopecks(quote.total_uah),
    ccy: 980,
    merchantPaymInfo: { reference, destination: destination.slice(0, 280) },
    redirectUrl: `${baseUrl}/shin-gi/cabinet?pay=${encodeURIComponent(reference)}`,
    webHookUrl: `${baseUrl}/api/shingi/pay/webhook`,
    validity: 3600,
  };
}

/** Виклик API еквайрингу. Токен не потрапляє ні в логи, ні у відповіді. */
export async function monoCall<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = monoToken();
  if (!token) throw new Error('SHINGI_MONO_TOKEN is not set');
  const res = await fetch(`${MONO_API}${path}`, {
    method: init.method || 'GET',
    headers: { 'X-Token': token, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Monobank ${res.status}: ${String(data?.errText || data?.errCode || 'помилка').slice(0, 120)}`);
  return data as T;
}

/* ───────────── зведення виручки ───────────── */

export type Block = 'kids' | 'open';
export type Method = 'monobank' | 'cash';

/** Рядок з БД: оплачені бійці однієї події, блоку й способу (внесок і комісія вже розкладені по бійцях). */
export type PaidRow = { event_id: number; block: Block; method: string; fighters: number; base_uah: number; fee_uah: number };
export type PendingRow = { event_id: number; block: Block; fighters: number };

export type BlockTotals = {
  fighters_paid: number;
  paid_uah: number;
  fee_uah: number;
  fighters_pending: number;
  pending_uah: number;
  by_method: Record<Method, { fighters: number; paid_uah: number; fee_uah: number }>;
};

const emptyBlock = (): BlockTotals => ({
  fighters_paid: 0,
  paid_uah: 0,
  fee_uah: 0,
  fighters_pending: 0,
  pending_uah: 0,
  by_method: { monobank: { fighters: 0, paid_uah: 0, fee_uah: 0 }, cash: { fighters: 0, paid_uah: 0, fee_uah: 0 } },
});

export type EventRevenue = { event_id: number; kids: BlockTotals; open: BlockTotals; total: BlockTotals };

export const emptyRevenue = (eventId: number): EventRevenue => ({ event_id: eventId, kids: emptyBlock(), open: emptyBlock(), total: emptyBlock() });

const addInto = (target: BlockTotals, source: BlockTotals) => {
  target.fighters_paid += source.fighters_paid;
  target.paid_uah += source.paid_uah;
  target.fee_uah += source.fee_uah;
  target.fighters_pending += source.fighters_pending;
  target.pending_uah += source.pending_uah;
  for (const m of ['monobank', 'cash'] as const) {
    target.by_method[m].fighters += source.by_method[m].fighters;
    target.by_method[m].paid_uah += source.by_method[m].paid_uah;
    target.by_method[m].fee_uah += source.by_method[m].fee_uah;
  }
};

/**
 * Виручка по подіях і блоках. `paid_uah` — чистий внесок (без комісії банку), `fee_uah` — комісія, яку сплатили платники.
 * Очікування рахуємо за ставкою внеску події (`feeByEvent`).
 */
export function summarizeRevenue(paid: PaidRow[], pending: PendingRow[], feeByEvent: Record<number, number>): EventRevenue[] {
  const byEvent = new Map<number, EventRevenue>();
  const get = (eventId: number) => {
    let row = byEvent.get(eventId);
    if (!row) {
      row = emptyRevenue(eventId);
      byEvent.set(eventId, row);
    }
    return row;
  };
  for (const r of paid) {
    const method: Method = r.method === 'cash' ? 'cash' : 'monobank';
    const block = get(r.event_id)[r.block];
    block.fighters_paid += r.fighters;
    block.paid_uah += r.base_uah;
    block.fee_uah += r.fee_uah;
    block.by_method[method].fighters += r.fighters;
    block.by_method[method].paid_uah += r.base_uah;
    block.by_method[method].fee_uah += r.fee_uah;
  }
  for (const r of pending) {
    const block = get(r.event_id)[r.block];
    block.fighters_pending += r.fighters;
    block.pending_uah += r.fighters * (feeByEvent[r.event_id] ?? 0);
  }
  for (const row of byEvent.values()) {
    addInto(row.total, row.kids);
    addInto(row.total, row.open);
  }
  return [...byEvent.values()];
}
