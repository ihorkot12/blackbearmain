import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { feeInfo, isFeeKind } from '../../api/_shingi/fee.js';

describe('fee: внесок за захід', () => {
  it('звичайний внесок', () => {
    const f = feeInfo({ fee_uah: 400 });
    assert.equal(f.free, false);
    assert.equal(f.kind, 'fee');
    assert.equal(f.strong, '400 грн');
    assert.equal(f.sentence, 'Внесок 400 грн за бійця');
    assert.equal(f.per, 'внесок за бійця');
    assert.equal(f.price_main, '400');
    assert.equal(f.price_small, 'грн / боєць');
  });

  it('нуль — безкоштовно, вид не має значення', () => {
    for (const kind of ['fee', 'charity', 'custom']) {
      const f = feeInfo({ fee_uah: 0, fee_kind: kind, fee_label: 'щось' });
      assert.equal(f.free, true);
      assert.equal(f.strong, 'Безкоштовно');
      assert.equal(f.sentence, 'Участь безкоштовна');
      assert.equal(f.per, '');
      assert.equal(f.price_small, '');
    }
  });

  it('благодійний внесок', () => {
    const f = feeInfo({ fee_uah: 500, fee_kind: 'charity' });
    assert.equal(f.sentence, 'Благодійний внесок 500 грн за бійця');
    assert.equal(f.noun, 'благодійний внесок');
    assert.equal(f.price_small, 'грн / боєць · благодійний внесок');
  });

  it('власний підпис', () => {
    const f = feeInfo({ fee_uah: 300, fee_kind: 'custom', fee_label: '  підтримка залу ' });
    assert.equal(f.noun, 'підтримка залу');
    assert.equal(f.sentence, 'Підтримка залу 300 грн за бійця');
  });

  it('власний вид без підпису повертається до «внесок»', () => {
    assert.equal(feeInfo({ fee_uah: 300, fee_kind: 'custom', fee_label: '   ' }).noun, 'внесок');
  });

  it('сміття й від’ємні значення не ламають розрахунок', () => {
    assert.equal(feeInfo({ fee_uah: -50 }).free, true);
    assert.equal(feeInfo({ fee_uah: Number.NaN }).amount_uah, 0);
    assert.equal(feeInfo({ fee_uah: 250.4, fee_kind: 'nonsense' }).kind, 'fee');
    assert.equal(feeInfo({ fee_uah: 250.4 }).amount_uah, 250);
  });

  it('перевірка виду', () => {
    assert.ok(isFeeKind('charity') && isFeeKind('custom') && isFeeKind('fee'));
    assert.ok(!isFeeKind('free') && !isFeeKind(undefined));
  });
});
