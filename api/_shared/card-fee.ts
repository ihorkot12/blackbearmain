/** Комісія еквайрингу, яку сплачує платник. Спільна для кабінету батьків і модуля SHIN GI. */
export const DEFAULT_CARD_FEE_PERCENT = 1.3;
export const MAX_CARD_FEE_PERCENT = 10;

/** Ставка зі змінної середовища: порожньо або сміття — 1,3 %, стеля — 10 %. */
export function parseFeePercent(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_CARD_FEE_PERCENT;
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) return DEFAULT_CARD_FEE_PERCENT;
  return Math.min(value, MAX_CARD_FEE_PERCENT);
}

export type Quote = { base_uah: number; fee_uah: number; total_uah: number; percent: number };

/**
 * Сума до оплати карткою так, щоб після комісії банку на рахунок прийшло не менше за `baseUah`.
 * total = base / (1 − p), угору до цілої гривні.
 */
export function grossUp(baseUah: number, percent: number): Quote {
  const base = Math.max(0, Math.round(baseUah));
  if (base === 0 || percent <= 0) return { base_uah: base, fee_uah: 0, total_uah: base, percent: Math.max(0, percent) };
  // 1e-9 гасить похибку float: результат, що ділиться націло, не має давати зайву гривню
  const total = Math.ceil(base / (1 - percent / 100) - 1e-9);
  return { base_uah: base, fee_uah: total - base, total_uah: total, percent };
}
