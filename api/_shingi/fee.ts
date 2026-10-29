/**
 * Внесок за участь у заході: сума, вид і готові тексти для сайту, бота й оферти.
 * Сума 0 — участь безкоштовна. Вид: звичайний внесок, благодійний або власний підпис («підтримка залу» тощо).
 * Чиста логіка без залежностей: її імпортують і сервер, і сторінки.
 */
export const FEE_KINDS = ['fee', 'charity', 'custom'] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

export const FEE_KIND_LABELS: Record<FeeKind, string> = {
  fee: 'Внесок',
  charity: 'Благодійний внесок',
  custom: 'Власна назва',
};

export type FeeSource = { fee_uah: number; fee_kind?: string | null; fee_label?: string | null };

export type FeeInfo = {
  amount_uah: number;
  free: boolean;
  kind: FeeKind;
  /** «внесок», «благодійний внесок» або власна назва — для підстановки в речення. */
  noun: string;
  /** «400 грн» або «Безкоштовно». */
  strong: string;
  /** «внесок за бійця» (порожньо для безкоштовного). */
  per: string;
  /** «Внесок 400 грн за бійця» або «Участь безкоштовна». */
  sentence: string;
  /** Для великого цінника: «400» або «Безкоштовно». */
  price_main: string;
  /** «грн / боєць» або порожньо. */
  price_small: string;
};

export const isFeeKind = (value: unknown): value is FeeKind => (FEE_KINDS as readonly string[]).includes(String(value));

const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

export function feeInfo(source: FeeSource): FeeInfo {
  const amount = Math.max(0, Math.round(Number(source.fee_uah) || 0));
  const kind: FeeKind = isFeeKind(source.fee_kind) ? source.fee_kind : 'fee';
  const label = String(source.fee_label || '').trim().slice(0, 80);
  const noun = kind === 'charity' ? 'благодійний внесок' : kind === 'custom' && label ? label : 'внесок';
  const free = amount === 0;
  return {
    amount_uah: amount,
    free,
    kind,
    noun,
    strong: free ? 'Безкоштовно' : `${amount} грн`,
    per: free ? '' : `${noun} за бійця`,
    sentence: free ? 'Участь безкоштовна' : `${capitalize(noun)} ${amount} грн за бійця`,
    price_main: free ? 'Безкоштовно' : String(amount),
    price_small: free ? '' : kind === 'fee' ? 'грн / боєць' : `грн / боєць · ${noun}`,
  };
}
