import { logAction, query, withTx } from './db.js';
import { mapMonoStatus, monoCall, toKopecks } from './payments.js';

type PaymentRow = {
  id: number;
  reference: string;
  amount_uah: number;
  entries_ids: number[];
  invoice_id: string | null;
  provider: string;
  status: string;
};

/** Застосовує новий статус платежу. Оплачений платіж не знижується до failure/expired — лише до reversed. */
async function applyStatus(paymentId: number, next: string, raw: unknown): Promise<string> {
  const final = await withTx(async (run) => {
    const [pay] = await run('SELECT id, status, entries_ids FROM shingi_payments WHERE id = $1 FOR UPDATE', [paymentId]);
    if (!pay) return 'unknown';
    if (pay.status === next) return next;

    if (next === 'success' && pay.status !== 'success') {
      await run(`UPDATE shingi_payments SET status = 'success', paid_at = COALESCE(paid_at, now()), raw_webhook = $2 WHERE id = $1`, [
        paymentId,
        JSON.stringify(raw ?? null),
      ]);
      await run(`UPDATE shingi_entries SET status = 'paid', updated_at = now() WHERE id = ANY($1::int[]) AND status = 'submitted'`, [pay.entries_ids]);
      return 'success';
    }
    if (next === 'reversed' && pay.status === 'success') {
      await run(`UPDATE shingi_payments SET status = 'reversed', raw_webhook = $2 WHERE id = $1`, [paymentId, JSON.stringify(raw ?? null)]);
      await run(`UPDATE shingi_entries SET status = 'submitted', updated_at = now() WHERE id = ANY($1::int[]) AND status = 'paid'`, [pay.entries_ids]);
      return 'reversed';
    }
    if (pay.status === 'success') return 'success';
    await run(`UPDATE shingi_payments SET status = $2, raw_webhook = $3 WHERE id = $1`, [paymentId, next, JSON.stringify(raw ?? null)]);
    return next;
  });
  if (final === 'success' || final === 'reversed') await logAction('monobank', `payment.${final}`, 'payment', paymentId);
  return final;
}

/**
 * Питає банк про рахунок і застосовує його статус. Вебхук лише привід спитати: тіло запиту ніколи не вважаємо правдою,
 * тому підробити «оплачено» запитом на /pay/webhook не можна.
 */
export async function refreshFromMono(paymentId: number): Promise<string> {
  const [pay] = await query<PaymentRow>('SELECT id, reference, amount_uah, entries_ids, invoice_id, provider, status FROM shingi_payments WHERE id = $1', [paymentId]);
  if (!pay) return 'unknown';
  if (pay.provider !== 'monobank' || !pay.invoice_id) return pay.status;
  if (['failure', 'expired', 'reversed'].includes(pay.status)) return pay.status;

  const info = await monoCall<{ status?: string; reference?: string; amount?: number; finalAmount?: number }>(
    `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(pay.invoice_id)}`,
  );
  if (info.reference && info.reference !== pay.reference) {
    console.error('shingi pay: reference mismatch', pay.id);
    return pay.status;
  }
  const next = mapMonoStatus(info.status);
  if (next === 'success') {
    const charged = Number(info.finalAmount ?? info.amount);
    if (charged !== toKopecks(pay.amount_uah)) {
      console.error('shingi pay: amount mismatch', pay.id, charged, toKopecks(pay.amount_uah));
      return pay.status;
    }
  }
  return applyStatus(pay.id, next, info);
}
