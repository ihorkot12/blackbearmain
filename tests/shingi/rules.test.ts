import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BELT_CODES, beltCategory } from '../../api/_shingi/belts.js';
import { groupKeyFor } from '../../api/_shingi/grouping.js';
import { parseFighterLine } from '../../api/_shingi/parser.js';
import { beltCat, blockRule, groupKeyOf, groupLabel, plausibilityWarnings, typicalWeight } from '../../api/_shingi/rules.js';

describe('rules: узгодженість із belts.ts і grouping.ts', () => {
  it('категорія пояса збігається для всіх 16 поясів', () => {
    for (const code of BELT_CODES) assert.equal(beltCat(code), beltCategory(code), code);
  });

  it('ключ групи однаковий у rules і grouping', () => {
    const entry = { id: 1, block: 'kids' as const, sex: 'f' as const, age: 11, weight_kg: 39.9, belt: 'k6' as const };
    assert.equal(groupKeyOf(entry), groupKeyFor(entry));
    assert.equal(groupKeyOf(entry), 'kids|f|11|35-40|B');
  });
});

describe('rules: підписи й пояснення', () => {
  it('підпис групи', () => {
    assert.equal(groupLabel('kids|m|10|30-35|B'), 'Kids · Ч · 10 р. · 30–35 кг · B');
    assert.equal(groupLabel('open|f|18+|60-70|C'), 'Open · Ж · 18+ · 60–70 кг · C');
    assert.equal(groupLabel('kids|m|9|?|A'), 'Kids · Ч · 9 р. · вага ? · A');
  });

  it('пояснення блоку', () => {
    assert.match(blockRule(10), /до 14/);
    assert.match(blockRule(15), /за замовчуванням Kids/);
    assert.match(blockRule(15, true), /заявлено в Open/);
    assert.match(blockRule(30), /Open/);
  });
});

describe('rules: правдоподібність', () => {
  it('нормальні дані — без попереджень', () => {
    assert.deepEqual(plausibilityWarnings({ age: 12, weight_kg: 38, belt: 'k8' }), []);
    assert.deepEqual(plausibilityWarnings({ age: 25, weight_kg: 84, belt: 'd1' }), []);
  });

  it('нетипова вага для віку', () => {
    assert.equal(plausibilityWarnings({ age: 6, weight_kg: 60, belt: 'white' }).length, 1);
    assert.equal(plausibilityWarnings({ age: 30, weight_kg: 25, belt: 'k5' }).length, 1);
    const [min, max] = typicalWeight(12);
    assert.deepEqual(plausibilityWarnings({ age: 12, weight_kg: min, belt: 'k8' }), []);
    assert.deepEqual(plausibilityWarnings({ age: 12, weight_kg: max, belt: 'k8' }), []);
  });

  it('дан у дитини і коричневий у малюка', () => {
    assert.match(plausibilityWarnings({ age: 10, weight_kg: 35, belt: 'd1' })[0], /дан/);
    assert.match(plausibilityWarnings({ age: 7, weight_kg: 25, belt: 'k2' })[0], /коричневий/);
  });

  it('парсер передає попередження у відповідь', () => {
    const r = parseFighterLine('Іваненко Максим ч 6 70 8кю', 1, '2026-12-26');
    assert.ok(!('reason' in r));
    if (!('reason' in r)) assert.ok(r.warnings.some((w) => w.includes('незвична')));
  });
});
