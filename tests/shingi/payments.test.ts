import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cardFeePercent, grossUp, invoiceBody, isFinalStatus, mapMonoStatus, summarizeRevenue } from '../../api/_shingi/payments.js';

describe('payments: комісія для платника', () => {
  it('400 грн при 1,3% → 406, комісія 6', () => {
    const q = grossUp(400, 1.3);
    assert.deepEqual([q.base_uah, q.fee_uah, q.total_uah], [400, 6, 406]);
  });

  it('після комісії банку на рахунок приходить не менше за внесок', () => {
    for (const base of [400, 800, 1200, 2000, 5200]) {
      for (const percent of [0.5, 1.3, 2, 2.5]) {
        const q = grossUp(base, percent);
        const net = q.total_uah * (1 - percent / 100);
        assert.ok(net >= base - 1e-9, `${base} @ ${percent}%: на рахунок ${net}`);
        // комісія платника не більша за точну (base·p / (1−p)) більш ніж на округлення до гривні
        const exact = (base * (percent / 100)) / (1 - percent / 100);
        assert.ok(q.fee_uah >= exact - 1e-9 && q.fee_uah < exact + 1, `${base} @ ${percent}%: комісія ${q.fee_uah}, точно ${exact}`);
      }
    }
  });

  it('націло ділиться — без зайвої гривні', () => assert.equal(grossUp(987, 1.3).total_uah, 1000));
  it('нульова комісія і нульова сума', () => {
    assert.equal(grossUp(400, 0).total_uah, 400);
    assert.equal(grossUp(0, 1.3).total_uah, 0);
  });

  it('ставка зі змінної середовища', () => {
    assert.equal(cardFeePercent(undefined), 1.3);
    assert.equal(cardFeePercent(''), 1.3);
    assert.equal(cardFeePercent('2,5'), 2.5);
    assert.equal(cardFeePercent('abc'), 1.3);
    assert.equal(cardFeePercent('-1'), 1.3);
    assert.equal(cardFeePercent('50'), 10);
    assert.equal(cardFeePercent('0'), 0);
  });
});

describe('payments: рахунок Monobank', () => {
  const quote = grossUp(800, 1.3);
  const body = invoiceBody({ reference: 'sg-1-2-ab12', quote, fighters: 2, eventTitle: 'SHIN GI', baseUrl: 'https://shin-karate.kyiv.ua' });

  it('сума в копійках разом із комісією', () => {
    assert.equal(quote.total_uah, 811);
    assert.equal(body.amount, 81100);
    assert.equal(body.ccy, 980);
  });
  it('призначення показує внесок і комісію окремо', () => {
    assert.match(body.merchantPaymInfo.destination, /800 грн \+ комісія банку 11 грн/);
    assert.equal(body.merchantPaymInfo.reference, 'sg-1-2-ab12');
  });
  it('адреси повернення й вебхука на нашому домені', () => {
    assert.equal(body.webHookUrl, 'https://shin-karate.kyiv.ua/api/shingi/pay/webhook');
    assert.equal(body.redirectUrl, 'https://shin-karate.kyiv.ua/shin-gi/cabinet?pay=sg-1-2-ab12');
  });
  it('без комісії в призначенні її немає', () => {
    const free = invoiceBody({ reference: 'r', quote: grossUp(400, 0), fighters: 1, eventTitle: 'SHIN GI', baseUrl: 'https://x.ua' });
    assert.doesNotMatch(free.merchantPaymInfo.destination, /комісія/);
  });
});

describe('payments: статуси', () => {
  it('мапінг статусів Monobank', () => {
    assert.equal(mapMonoStatus('success'), 'success');
    assert.equal(mapMonoStatus('hold'), 'processing');
    assert.equal(mapMonoStatus('processing'), 'processing');
    assert.equal(mapMonoStatus('failure'), 'failure');
    assert.equal(mapMonoStatus('expired'), 'expired');
    assert.equal(mapMonoStatus('reversed'), 'reversed');
    assert.equal(mapMonoStatus('created'), 'created');
    assert.equal(mapMonoStatus(undefined), 'created');
  });
  it('кінцеві статуси', () => {
    assert.ok(isFinalStatus('success') && isFinalStatus('expired'));
    assert.ok(!isFinalStatus('created') && !isFinalStatus('processing'));
  });
});

describe('payments: виручка по подіях і блоках', () => {
  const rows = summarizeRevenue(
    [
      { event_id: 1, block: 'kids', method: 'monobank', fighters: 2, base_uah: 800, fee_uah: 11 },
      { event_id: 1, block: 'open', method: 'cash', fighters: 1, base_uah: 400, fee_uah: 0 },
      { event_id: 1, block: 'open', method: 'monobank', fighters: 1, base_uah: 400, fee_uah: 6 },
      { event_id: 2, block: 'kids', method: 'cash', fighters: 3, base_uah: 1200, fee_uah: 0 },
    ],
    [
      { event_id: 1, block: 'kids', fighters: 1 },
      { event_id: 2, block: 'open', fighters: 2 },
    ],
    { 1: 400, 2: 500 },
  );
  const e1 = rows.find((r) => r.event_id === 1)!;
  const e2 = rows.find((r) => r.event_id === 2)!;

  it('Kids і Open окремо в межах події', () => {
    assert.equal(e1.kids.paid_uah, 800);
    assert.equal(e1.kids.fee_uah, 11);
    assert.equal(e1.open.paid_uah, 800);
    assert.equal(e1.open.fee_uah, 6);
  });
  it('картка й готівка окремо', () => {
    assert.equal(e1.open.by_method.cash.paid_uah, 400);
    assert.equal(e1.open.by_method.monobank.paid_uah, 400);
    assert.equal(e1.kids.by_method.cash.fighters, 0);
  });
  it('очікування за ставкою своєї події', () => {
    assert.equal(e1.kids.pending_uah, 400);
    assert.equal(e2.open.pending_uah, 1000);
  });
  it('разом по події, події не змішуються', () => {
    assert.equal(e1.total.paid_uah, 1600);
    assert.equal(e1.total.fee_uah, 17);
    assert.equal(e1.total.fighters_paid, 4);
    assert.equal(e2.total.paid_uah, 1200);
    assert.equal(e2.kids.by_method.cash.paid_uah, 1200);
  });
});
