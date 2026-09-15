/**
 * Розклад груп для вибору «зручні дні → зручний час» у формі заявки.
 * Джерело — чинний розклад локації Сім'ї Бродських з вересня 2026.
 * Тримається окремо від форм, щоб правка розкладу була в одному місці.
 */

export type DayBlockValue = 'mwf' | 'tt' | 'other';

export interface DayBlock {
  value: DayBlockValue;
  label: string;
}

export const DAY_BLOCKS: DayBlock[] = [
  { value: 'mwf', label: 'Пн / Ср / Пт' },
  { value: 'tt', label: 'Вт / Чт' },
  { value: 'other', label: 'Інші дні' }
];

export interface Slot {
  days: Exclude<DayBlockValue, 'other'>;
  /** Час у вигляді, який бачить людина */
  time: string;
  /** Значення age_group, яким підходить слот */
  ageValues: string[];
  /** Коротка назва групи поруч із часом */
  label: string;
}

export const SLOTS: Slot[] = [
  { days: 'mwf', time: '17:00–17:40', ageValues: ['4-7 років'], label: 'нова група 4–7' },
  { days: 'mwf', time: '17:40–18:20', ageValues: ['4-7 років'], label: 'молодша 4–7' },
  { days: 'mwf', time: '18:30–19:30', ageValues: ['7-12 років'], label: 'середня 7–12' },
  { days: 'mwf', time: '19:40–21:00', ageValues: ['12+ років'], label: 'старша 12+' },
  { days: 'tt', time: '17:20–18:00', ageValues: ['4-7 років'], label: 'нова група 4–7' },
  { days: 'tt', time: '18:10–18:50', ageValues: ['4-7 років'], label: 'молодша 4–7' },
  { days: 'tt', time: '19:00–20:00', ageValues: ['Дорослий'], label: 'дорослі новачки' }
];

/** Групи, для яких розклад визначений. Для решти (цілі персоналок) вибір не показуємо. */
export const KNOWN_AGE_VALUES = ['4-7 років', '7-12 років', '12+ років', 'Дорослий'];

export const hasSchedule = (ageValue?: string) =>
  !ageValue || KNOWN_AGE_VALUES.includes(ageValue);

/** Слоти для обраних днів; за заданої групи — лише її слоти (порожньо = групи в ці дні немає). */
export const slotsFor = (days: DayBlockValue | '', ageValue?: string): Slot[] => {
  if (!days || days === 'other') return [];
  const byDay = SLOTS.filter((slot) => slot.days === days);
  if (!ageValue) return byDay;
  return byDay.filter((slot) => slot.ageValues.includes(ageValue));
};
