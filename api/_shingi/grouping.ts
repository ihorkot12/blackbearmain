import type { BeltCategory, BeltCode } from './belts.js';
import { groupKeyOf, DEFAULT_GROUPING, type Block, type GroupingOptions, type Sex } from './rules.js';

// Правила (блок, відра, категорія) живуть у rules.ts — їх використовує й кабінет.
export { ageOnDate, resolveBlock, ageBucket, weightBand, DEFAULT_GROUPING } from './rules.js';
export type { Block, Sex, GroupingOptions } from './rules.js';

export type GroupableEntry = {
  id: number;
  block: Block;
  sex: Sex;
  age: number;
  weight_kg: number | null;
  belt: BeltCode;
  group_key?: string | null;
  group_manual?: boolean | null;
};

export type GroupAssignment = { entryId: number; group_key: string; group_manual: boolean };

export type Group = {
  key: string;
  block: Block;
  sex: Sex;
  ageBucket: string;
  weightBand: string;
  beltCat: BeltCategory;
  members: GroupableEntry[];
  /** У групі лише один боєць — потрібне ручне об'єднання. */
  single: boolean;
};

export function resolveAge(fighter: { birth_date?: string | null; age_years?: number | null }, eventDate: string): number | null {
  if (fighter.birth_date) {
    const [by, bm, bd] = fighter.birth_date.split('-').map(Number);
    const [ey, em, ed] = eventDate.split('-').map(Number);
    return ey - by - (em < bm || (em === bm && ed < bd) ? 1 : 0);
  }
  return typeof fighter.age_years === 'number' ? fighter.age_years : null;
}

export const groupKeyFor = (entry: GroupableEntry, opts: GroupingOptions = DEFAULT_GROUPING): string => groupKeyOf(entry, opts);

export function parseGroupKey(key: string) {
  const [block, sex, ageB, weightB, beltCat] = key.split('|');
  return { block: block as Block, sex: sex as Sex, ageBucket: ageB, weightBand: weightB, beltCat: beltCat as BeltCategory };
}

/**
 * Автосортування: ручні призначення (group_manual) зберігаються, якщо не скинуто.
 * Повертає призначення для всіх записів.
 */
export function assignGroups(
  entries: GroupableEntry[],
  opts: GroupingOptions = DEFAULT_GROUPING,
  resetManual = false,
): GroupAssignment[] {
  return entries.map((entry) => {
    if (entry.group_manual && entry.group_key && !resetManual) {
      return { entryId: entry.id, group_key: entry.group_key, group_manual: true };
    }
    return { entryId: entry.id, group_key: groupKeyFor(entry, opts), group_manual: false };
  });
}

/** Групи, відсортовані за розміром (найбільші спочатку), далі за ключем. */
export function buildGroups(entries: GroupableEntry[], assignments: GroupAssignment[]): Group[] {
  const keyById = new Map(assignments.map((a) => [a.entryId, a.group_key]));
  const buckets = new Map<string, GroupableEntry[]>();
  for (const entry of entries) {
    const key = keyById.get(entry.id);
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(entry);
    else buckets.set(key, [entry]);
  }
  const groups: Group[] = [];
  for (const [key, members] of buckets) {
    groups.push({ key, ...parseGroupKey(key), members, single: members.length === 1 });
  }
  return groups.sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key));
}
