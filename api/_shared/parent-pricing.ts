/**
 * Ціна місяця в клубному кабінеті батьків: базова ціна і знижка.
 * Знижка 15 % (ставка в налаштуванні) надається або за статусом УБД, або якщо в родині займаються 2+ дітей.
 * Знижки не складаються: діє одна. Це не стосується SHIN GI.
 */
export const DEFAULT_MONTHLY_FEE_UAH = 2500;
export const DEFAULT_DISCOUNT_PERCENT = 15;
export const MAX_DISCOUNT_PERCENT = 50;

export type DiscountReason = 'ubd' | 'siblings';

export function parseDiscountPercent(raw: unknown): number {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (text === '') return DEFAULT_DISCOUNT_PERCENT;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_DISCOUNT_PERCENT;
  return Math.min(value, MAX_DISCOUNT_PERCENT);
}

/** Яка знижка належить учасникові. `siblings` — скільки дітей родини займається (разом із ним). */
export function parentDiscount(opts: { ubd: boolean; siblings: number; percent?: number }): { percent: number; reason: DiscountReason | null } {
  const percent = opts.percent ?? DEFAULT_DISCOUNT_PERCENT;
  if (percent <= 0) return { percent: 0, reason: null };
  if (opts.ubd) return { percent, reason: 'ubd' };
  if (opts.siblings >= 2) return { percent, reason: 'siblings' };
  return { percent: 0, reason: null };
}

/** Ціна місяця після знижки, у цілих гривнях. */
export const discountedMonthly = (baseUah: number, percent: number): number => Math.max(0, Math.round(baseUah * (1 - percent / 100)));

export const DISCOUNT_REASON_LABELS: Record<DiscountReason, string> = {
  ubd: 'знижка УБД',
  siblings: 'знижка для родин, де займаються 2+ дітей',
};
