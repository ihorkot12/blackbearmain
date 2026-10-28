export const BELT_CODES = [
  'white', 'k10', 'k9', 'k8', 'k7', 'k6', 'k5', 'k4', 'k3', 'k2', 'k1', 'd1', 'd2', 'd3', 'd4', 'd5',
] as const;

export type BeltCode = (typeof BELT_CODES)[number];
export type BeltCategory = 'A' | 'B' | 'C';

export const BELT_LABELS: Record<BeltCode, string> = {
  white: 'білий',
  k10: '10 кю помаранчевий',
  k9: '9 кю помаранчевий зі смужкою',
  k8: '8 кю синій',
  k7: '7 кю синій зі смужкою',
  k6: '6 кю жовтий',
  k5: '5 кю жовтий зі смужкою',
  k4: '4 кю зелений',
  k3: '3 кю зелений зі смужкою',
  k2: '2 кю коричневий',
  k1: '1 кю коричневий зі смужкою',
  d1: '1 дан чорний',
  d2: '2 дан чорний',
  d3: '3 дан чорний',
  d4: '4 дан чорний',
  d5: '5 дан чорний',
};

export const isBeltCode = (value: unknown): value is BeltCode =>
  typeof value === 'string' && (BELT_CODES as readonly string[]).includes(value);

/** A — білий, 10 і 9 кю; B — 8..5 кю; C — 4..1 кю і всі дани. */
export function beltCategory(belt: BeltCode): BeltCategory {
  if (belt === 'white' || belt === 'k10' || belt === 'k9') return 'A';
  if (belt === 'k8' || belt === 'k7' || belt === 'k6' || belt === 'k5') return 'B';
  return 'C';
}

export const kyuToBelt = (n: number): BeltCode | null => (n >= 1 && n <= 10 ? (`k${n}` as BeltCode) : null);
export const danToBelt = (n: number): BeltCode | null => (n >= 1 && n <= 5 ? (`d${n}` as BeltCode) : null);
