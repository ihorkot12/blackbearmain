/**
 * Розклад для вибору «зручні дні → зручний час» у формі заявки.
 * Джерело — той самий /api/schedule, що показує розклад на сайті і який
 * тренер редагує у своєму модулі. Нічого не дублюємо в коді: змінив розклад
 * в адмінці — форма одразу пропонує нові дні й часи.
 */

export interface ScheduleRow {
  id?: number;
  day_of_week: string;
  start_time: string;
  end_time?: string | null;
  group_name?: string | null;
  location_name?: string | null;
  order_index?: number;
}

/** Порядок днів тижня для сортування блоків на кшталт «Пн, Ср, Пт». */
const DAY_ORDER = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export const dayBlockWeight = (dayOfWeek: string) => {
  const index = DAY_ORDER.findIndex((day) => dayOfWeek.includes(day));
  return index === -1 ? 99 : index;
};

/**
 * Витягує віковий діапазон із довільного підпису: «(4-7 років)», «(12+ років)»,
 * «Середня група (7–12 років)». Повертає null, якщо чисел немає.
 */
export const parseAgeRange = (text?: string | null): [number, number] | null => {
  if (!text) return null;
  const range = text.match(/(\d{1,2})\s*[–—-]\s*(\d{1,2})/);
  if (range) return [Number(range[1]), Number(range[2])];
  const openEnded = text.match(/(\d{1,2})\s*\+/);
  if (openEnded) return [Number(openEnded[1]), 99];
  return null;
};

/** Чи підходить заняття обраній віковій групі — діапазони мають перетинатись. */
export const ageMatches = (groupName?: string | null, ageValue?: string) => {
  const wanted = parseAgeRange(ageValue);
  if (!wanted) return true;
  const actual = parseAgeRange(groupName);
  if (!actual) return false;
  return wanted[0] <= actual[1] && actual[0] <= wanted[1];
};

/** Вантажить розклад із сайту. Порожній масив — форма просто не покаже блок. */
export const fetchSchedule = async (): Promise<ScheduleRow[]> => {
  try {
    const response = await fetch('/api/schedule');
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

export const matchesLocation = (row: ScheduleRow, locationValue?: string) =>
  !locationValue || !row.location_name || row.location_name === locationValue;

/** Унікальні набори днів («Пн, Ср, Пт», «Вт, Чт») серед занять, що підходять. */
export const dayBlocksFrom = (rows: ScheduleRow[]) => {
  const unique = Array.from(new Set(rows.map((row) => row.day_of_week).filter(Boolean)));
  return unique.sort((a, b) => dayBlockWeight(a) - dayBlockWeight(b));
};

export const formatSlotTime = (row: ScheduleRow) =>
  row.end_time ? `${row.start_time}–${row.end_time}` : row.start_time;
