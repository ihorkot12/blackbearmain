import React, { useEffect, useState } from 'react';
import {
  ageMatches,
  dayBlocksFrom,
  fetchSchedule,
  formatSlotTime,
  matchesLocation,
  type ScheduleRow
} from '../lib/schedule';

interface ScheduleChoiceProps {
  /** Обрана вікова група — звужує заняття до підхожих за віком */
  ageValue?: string;
  /** Обрана локація — звужує заняття до одного залу */
  locationValue?: string;
  labelClass: string;
  fieldClass: string;
}

const OTHER_DAYS = 'Інші дні';

/**
 * Вибір «зручні дні → зручний час» у формі заявки.
 * Розклад тягнеться з /api/schedule — того самого, що на сайті і в тренерському
 * модулі, тож у формі ніколи не буде занять, яких вже немає.
 * Сенс: батьки бачать реальні дні й часи ще до дзвінка, а ті, кому вони не
 * підходять, лишають бажаний час — це готовий попит на нову групу замість
 * втраченого ліда. Поля необовʼязкові: порожній вибір не блокує відправку.
 */
export const ScheduleChoice = ({
  ageValue,
  locationValue,
  labelClass,
  fieldClass
}: ScheduleChoiceProps) => {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [days, setDays] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    fetchSchedule().then((loaded) => {
      if (alive) setRows(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!rows.length) return null;

  const available = rows.filter((row) => matchesLocation(row, locationValue));
  const dayBlocks = dayBlocksFrom(available);
  if (!dayBlocks.length) return null;

  const slots =
    days && days !== OTHER_DAYS
      ? available.filter((row) => row.day_of_week === days && ageMatches(row.group_name, ageValue))
      : [];

  const noGroupInDays = days !== '' && days !== OTHER_DAYS && slots.length === 0;
  const askNote = days === OTHER_DAYS || time === OTHER_DAYS || noGroupInDays;
  const timeValue = time && time !== OTHER_DAYS ? time : note;

  const chipClass = (active: boolean) =>
    `px-4 py-3 rounded-2xl border text-sm font-bold transition-colors min-h-[44px] ${
      active
        ? 'border-red-600 bg-red-600/15 text-white'
        : 'border-white/10 bg-black text-zinc-400 hover:border-white/30 hover:text-white'
    }`;

  const chooseDays = (value: string) => {
    setDays(value);
    setTime('');
    setNote('');
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Які дні зручні</label>
        <div className="flex flex-wrap gap-2">
          {[...dayBlocks, OTHER_DAYS].map((block) => (
            <button
              key={block}
              type="button"
              onClick={() => chooseDays(block)}
              className={chipClass(days === block)}
            >
              {block}
            </button>
          ))}
        </div>
      </div>

      {slots.length > 0 && (
        <div>
          <label className={labelClass}>Який час зручний</label>
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => {
              const value = formatSlotTime(slot);
              return (
                <button
                  key={slot.id ?? `${slot.day_of_week}-${value}`}
                  type="button"
                  onClick={() => {
                    setTime(value);
                    setNote('');
                  }}
                  className={chipClass(time === value)}
                >
                  {value}
                  {slot.group_name && (
                    <span className="ml-1.5 text-zinc-500 font-medium">· {slot.group_name}</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setTime(OTHER_DAYS)}
              className={chipClass(time === OTHER_DAYS)}
            >
              Інший час
            </button>
          </div>
        </div>
      )}

      {noGroupInDays && (
        <p className="text-[12px] text-zinc-400 leading-relaxed">
          У ці дні групи саме цього віку поки немає. Напишіть зручний час — нові групи відкриваємо
          саме за такими запитами.
        </p>
      )}

      {askNote && (
        <div>
          <label className={labelClass}>Коли вам зручно</label>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={120}
            className={fieldClass}
            placeholder="Напр.: після 19:00 або субота зранку"
          />
        </div>
      )}

      <input type="hidden" name="preferred_days" value={days === OTHER_DAYS ? OTHER_DAYS : days} />
      <input type="hidden" name="preferred_time" value={timeValue} />
    </div>
  );
};
