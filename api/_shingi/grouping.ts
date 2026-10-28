import { beltCategory, type BeltCategory, type BeltCode } from './belts.js';

export type Block = 'kids' | 'open';
export type Sex = 'm' | 'f';

export type GroupingOptions = {
  kidsAgeStep: number;
  kidsWeightStep: number;
  openWeightStep: number;
};

export const DEFAULT_GROUPING: GroupingOptions = { kidsAgeStep: 1, kidsWeightStep: 5, openWeightStep: 10 };

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

/** Вік на дату події (повних років). Дати — рядки YYYY-MM-DD. */
export function ageOnDate(birthDate: string, eventDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ey, em, ed] = eventDate.split('-').map(Number);
  let age = ey - by;
  if (em < bm || (em === bm && ed < bd)) age -= 1;
  return age;
}

export function resolveAge(fighter: { birth_date?: string | null; age_years?: number | null }, eventDate: string): number | null {
  if (fighter.birth_date) return ageOnDate(fighter.birth_date, eventDate);
  return typeof fighter.age_years === 'number' ? fighter.age_years : null;
}

/** До 14 — завжди kids; 14–17 — kids, якщо тренер явно не заявив в open; 18+ — open. */
export function resolveBlock(age: number, blockOverride = false): Block {
  if (age >= 18) return 'open';
  if (age >= 14 && blockOverride) return 'open';
  return 'kids';
}

export function ageBucket(block: Block, age: number, opts: GroupingOptions = DEFAULT_GROUPING): string {
  if (block === 'open') return age >= 18 ? '18+' : '14-17';
  const step = Math.max(1, Math.floor(opts.kidsAgeStep));
  if (step === 1) return String(age);
  const lo = Math.floor(age / step) * step;
  return `${lo}-${lo + step - 1}`;
}

export function weightBand(block: Block, weight: number | null, opts: GroupingOptions = DEFAULT_GROUPING): string {
  if (weight === null || !Number.isFinite(weight)) return '?';
  const step = block === 'kids' ? opts.kidsWeightStep : opts.openWeightStep;
  const w = Math.round(weight * 10) / 10;
  const lo = Math.floor(w / step) * step;
  return `${lo}-${lo + step}`;
}

export function groupKeyFor(entry: GroupableEntry, opts: GroupingOptions = DEFAULT_GROUPING): string {
  return [
    entry.block,
    entry.sex,
    ageBucket(entry.block, entry.age, opts),
    weightBand(entry.block, entry.weight_kg, opts),
    beltCategory(entry.belt),
  ].join('|');
}

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
