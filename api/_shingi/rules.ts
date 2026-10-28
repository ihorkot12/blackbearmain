/**
 * Правила SHIN GI в одному місці: блок, вікове й вагове «відро», категорія пояса, ключ групи, підписи.
 * Файл без імпортів — його однаково використовують сервер (api/) і кабінет (src/).
 */

export type Block = 'kids' | 'open';
export type Sex = 'm' | 'f';
export type BeltCat = 'A' | 'B' | 'C';

export type GroupingOptions = {
  kidsAgeStep: number;
  kidsWeightStep: number;
  openWeightStep: number;
};

export const DEFAULT_GROUPING: GroupingOptions = { kidsAgeStep: 1, kidsWeightStep: 5, openWeightStep: 10 };

/** Вік на дату події (повних років). Дати — рядки YYYY-MM-DD. */
export function ageOnDate(birthDate: string, eventDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ey, em, ed] = eventDate.split('-').map(Number);
  let age = ey - by;
  if (em < bm || (em === bm && ed < bd)) age -= 1;
  return age;
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

/** A — білий, 10 і 9 кю; B — 8..5 кю; C — 4..1 кю і всі дани. */
export function beltCat(code: string): BeltCat {
  if (code === 'white' || code === 'k10' || code === 'k9') return 'A';
  if (code === 'k8' || code === 'k7' || code === 'k6' || code === 'k5') return 'B';
  return 'C';
}

export type GroupSubject = { block: Block; sex: Sex; age: number; weight_kg: number | null; belt: string };

export const groupKeyOf = (p: GroupSubject, opts: GroupingOptions = DEFAULT_GROUPING): string =>
  [p.block, p.sex, ageBucket(p.block, p.age, opts), weightBand(p.block, p.weight_kg, opts), beltCat(p.belt)].join('|');

/** `kids|m|10|30-35|B` → `Kids · Ч · 10 р. · 30–35 кг · B`. */
export function groupLabel(key: string): string {
  const [block, sex, age, weight, cat] = key.split('|');
  const ageText = age === '18+' || age === '14-17' ? age : `${age} р.`;
  const weightText = weight === '?' ? 'вага ?' : `${weight.replace('-', '–')} кг`;
  return `${block === 'kids' ? 'Kids' : 'Open'} · ${sex === 'm' ? 'Ч' : 'Ж'} · ${ageText} · ${weightText} · ${cat}`;
}

/** Людське пояснення, чому боєць у цьому блоці. */
export function blockRule(age: number, override = false): string {
  if (age >= 18) return '18+ — блок Open';
  if (age >= 14) return override ? '14–17, заявлено в Open' : '14–17 — за замовчуванням Kids (можна заявити в Open)';
  return 'до 14 років — завжди Kids';
}

/** Типові межі ваги за віком. Це лише підказка: поза межами — попередження, не помилка. */
export function typicalWeight(age: number): [number, number] {
  if (age <= 6) return [13, 32];
  if (age <= 9) return [18, 50];
  if (age <= 13) return [24, 75];
  if (age <= 17) return [35, 110];
  return [40, 150];
}

/** Попередження про дані, схожі на помилку вводу. Порожній масив — усе правдоподібно. */
export function plausibilityWarnings(p: { age: number | null; weight_kg: number | null; belt: string }): string[] {
  const warnings: string[] = [];
  if (p.age !== null && p.weight_kg !== null) {
    const [min, max] = typicalWeight(p.age);
    if (p.weight_kg < min || p.weight_kg > max) {
      warnings.push(`вага ${p.weight_kg} кг незвична для ${p.age} р. (типово ${min}–${max} кг) — перевірте`);
    }
  }
  if (p.age !== null) {
    if (p.belt.startsWith('d') && p.age < 14) warnings.push(`чорний пояс (дан) у ${p.age} р. — перевірте`);
    else if ((p.belt === 'k1' || p.belt === 'k2') && p.age < 8) warnings.push(`коричневий пояс у ${p.age} р. — перевірте`);
  }
  return warnings;
}
