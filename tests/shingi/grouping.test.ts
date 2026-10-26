import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { beltCategory } from '../../api/_shingi/belts.js';
import {
  ageBucket,
  ageOnDate,
  assignGroups,
  buildGroups,
  groupKeyFor,
  resolveBlock,
  weightBand,
  type GroupableEntry,
} from '../../api/_shingi/grouping.js';

const entry = (over: Partial<GroupableEntry> & { id: number }): GroupableEntry => ({
  block: 'kids',
  sex: 'm',
  age: 10,
  weight_kg: 32,
  belt: 'k8',
  ...over,
});

describe('категорії поясів', () => {
  it('межі 9/8 і 5/4 кю', () => {
    assert.equal(beltCategory('white'), 'A');
    assert.equal(beltCategory('k10'), 'A');
    assert.equal(beltCategory('k9'), 'A');
    assert.equal(beltCategory('k8'), 'B');
    assert.equal(beltCategory('k5'), 'B');
    assert.equal(beltCategory('k4'), 'C');
    assert.equal(beltCategory('k1'), 'C');
    assert.equal(beltCategory('d3'), 'C');
  });
});

describe('вік і блок', () => {
  it('вік на дату події враховує день народження', () => {
    assert.equal(ageOnDate('2014-11-16', '2026-11-16'), 12);
    assert.equal(ageOnDate('2014-11-17', '2026-11-16'), 11);
  });

  it('блок: <14 kids, 14–17 kids або open за прапорцем, 18+ open', () => {
    assert.equal(resolveBlock(9), 'kids');
    assert.equal(resolveBlock(13, true), 'kids');
    assert.equal(resolveBlock(15), 'kids');
    assert.equal(resolveBlock(15, true), 'open');
    assert.equal(resolveBlock(18), 'open');
  });

  it('вікові відра: kids — цілий вік, open — 14-17 і 18+', () => {
    assert.equal(ageBucket('kids', 9), '9');
    assert.equal(ageBucket('kids', 9, { kidsAgeStep: 2, kidsWeightStep: 5, openWeightStep: 10 }), '8-9');
    assert.equal(ageBucket('open', 16), '14-17');
    assert.equal(ageBucket('open', 18), '18+');
  });
});

describe('вагові відра', () => {
  it('kids: межа 39.9 / 40.0 (крок 5 кг)', () => {
    assert.equal(weightBand('kids', 39.9), '35-40');
    assert.equal(weightBand('kids', 40), '40-45');
  });

  it('open: крок 10 кг', () => {
    assert.equal(weightBand('open', 69.9), '60-70');
    assert.equal(weightBand('open', 70), '70-80');
  });

  it('без ваги — окреме відро', () => {
    assert.equal(weightBand('kids', null), '?');
  });
});

describe('групи', () => {
  it('ключ групи', () => {
    assert.equal(groupKeyFor(entry({ id: 1 })), 'kids|m|10|30-35|B');
  });

  it('сортує за розміром, позначає одиночних', () => {
    const entries = [
      entry({ id: 1 }),
      entry({ id: 2, weight_kg: 33 }),
      entry({ id: 3, weight_kg: 34.9 }),
      entry({ id: 4, sex: 'f' }),
    ];
    const groups = buildGroups(entries, assignGroups(entries));
    assert.equal(groups.length, 2);
    assert.equal(groups[0].members.length, 3);
    assert.equal(groups[0].single, false);
    assert.equal(groups[1].single, true);
  });

  it('ручні призначення зберігаються, «скинути ручні» їх перетирає', () => {
    const entries = [entry({ id: 1, group_key: 'kids|m|10|35-40|B', group_manual: true }), entry({ id: 2 })];
    const kept = assignGroups(entries);
    assert.equal(kept[0].group_key, 'kids|m|10|35-40|B');
    assert.equal(kept[0].group_manual, true);
    assert.equal(kept[1].group_manual, false);

    const reset = assignGroups(entries, undefined, true);
    assert.equal(reset[0].group_key, 'kids|m|10|30-35|B');
    assert.equal(reset[0].group_manual, false);
  });
});
