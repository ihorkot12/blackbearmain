import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { discountedMonthly, parentDiscount, parseDiscountPercent } from '../../api/_shared/parent-pricing.js';

describe('ціна місяця для батьків', () => {
  it('УБД — знижка 15 %', () => {
    const d = parentDiscount({ ubd: true, siblings: 1 });
    assert.deepEqual(d, { percent: 15, reason: 'ubd' });
    assert.equal(discountedMonthly(2500, d.percent), 2125);
  });

  it('2 і більше дітей у родині — знижка 15 %', () => {
    assert.deepEqual(parentDiscount({ ubd: false, siblings: 2 }), { percent: 15, reason: 'siblings' });
    assert.deepEqual(parentDiscount({ ubd: false, siblings: 3 }), { percent: 15, reason: 'siblings' });
  });

  it('одна дитина без УБД — без знижки', () => {
    assert.deepEqual(parentDiscount({ ubd: false, siblings: 1 }), { percent: 0, reason: null });
    assert.deepEqual(parentDiscount({ ubd: false, siblings: 0 }), { percent: 0, reason: null });
    assert.equal(discountedMonthly(2500, 0), 2500);
  });

  it('знижки не складаються: УБД і 2 дітей — усе одно 15 %', () => {
    const d = parentDiscount({ ubd: true, siblings: 3 });
    assert.equal(d.percent, 15);
    assert.equal(d.reason, 'ubd');
    assert.equal(discountedMonthly(2500, d.percent), 2125);
  });

  it('ставка зі свого налаштування, нуль вимикає знижки', () => {
    assert.equal(parentDiscount({ ubd: true, siblings: 1, percent: 20 }).percent, 20);
    assert.deepEqual(parentDiscount({ ubd: true, siblings: 5, percent: 0 }), { percent: 0, reason: null });
  });

  it('розбір налаштування', () => {
    assert.equal(parseDiscountPercent(undefined), 15);
    assert.equal(parseDiscountPercent(''), 15);
    assert.equal(parseDiscountPercent('10'), 10);
    assert.equal(parseDiscountPercent('12,5'), 12.5);
    assert.equal(parseDiscountPercent('0'), 0);
    assert.equal(parseDiscountPercent('abc'), 15);
    assert.equal(parseDiscountPercent('-5'), 15);
    assert.equal(parseDiscountPercent('99'), 50);
  });

  it('округлення до гривні', () => {
    assert.equal(discountedMonthly(2333, 15), 1983);
    assert.equal(discountedMonthly(0, 15), 0);
  });
});
