export const BELT_OPTIONS = [
  'Білий',
  'Оранжевий',
  'Оранжевий зі сріблястою смужкою',
  'Синій',
  'Синій зі сріблястою смужкою',
  'Жовтий',
  'Жовтий зі сріблястою смужкою',
  'Зелений',
  'Зелений зі сріблястою смужкою',
  'Коричневий',
  'Коричневий зі сріблястою смужкою',
  'Чорний'
];

export const normalizeBeltName = (belt?: string | null) => {
  const value = String(belt || '').trim();
  if (!value) return 'Білий';

  return value
    .replace(/\s+з[і]?\s+(синьою|жовтою|зеленою|коричневою|золотою|чорною)\s+смужкою/gi, ' зі сріблястою смужкою')
    .replace(/\s+зі\s+смужкою/gi, ' зі сріблястою смужкою');
};

export const hasSilverStripe = (belt?: string | null) =>
  normalizeBeltName(belt).toLowerCase().includes('сріблястою смужкою');

export const getBeltColorClass = (belt?: string | null) => {
  const normalized = normalizeBeltName(belt);
  if (normalized.includes('Білий')) return 'bg-white';
  if (normalized.includes('Оранжевий')) return 'bg-orange-500';
  if (normalized.includes('Синій')) return 'bg-blue-600';
  if (normalized.includes('Жовтий')) return 'bg-yellow-400';
  if (normalized.includes('Зелений')) return 'bg-green-600';
  if (normalized.includes('Коричневий')) return 'bg-amber-800';
  if (normalized.includes('Чорний')) return 'bg-zinc-950 border border-white/20';
  return 'bg-zinc-700';
};
