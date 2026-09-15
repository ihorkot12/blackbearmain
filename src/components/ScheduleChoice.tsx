import React, { useState } from 'react';
import { DAY_BLOCKS, hasSchedule, slotsFor, type DayBlockValue } from '../lib/schedule';

interface ScheduleChoiceProps {
  /** Обрана вікова група — визначає, які слоти показувати */
  ageValue?: string;
  labelClass: string;
  fieldClass: string;
}

/**
 * Вибір «зручні дні → зручний час» у формі заявки.
 * Сенс: батьки бачать реальний розклад ще до дзвінка, а ті, кому він не підходить,
 * лишають бажаний час — це готовий попит на нову групу замість втраченого ліда.
 * Поля необовʼязкові: порожній вибір не блокує відправку.
 */
export const ScheduleChoice = ({ ageValue, labelClass, fieldClass }: ScheduleChoiceProps) => {
  const [days, setDays] = useState<DayBlockValue | ''>('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');

  if (!hasSchedule(ageValue)) return null;

  const slots = slotsFor(days, ageValue);
  const daysLabel = DAY_BLOCKS.find((block) => block.value === days)?.label || '';
  const noGroupInDays = days !== '' && days !== 'other' && slots.length === 0;
  const askNote = days === 'other' || time === 'other' || noGroupInDays;
  const timeValue = time && time !== 'other' ? time : note;

  const chipClass = (active: boolean) =>
    `px-4 py-3 rounded-2xl border text-sm font-bold transition-colors min-h-[44px] ${
      active
        ? 'border-red-600 bg-red-600/15 text-white'
        : 'border-white/10 bg-black text-zinc-400 hover:border-white/30 hover:text-white'
    }`;

  const chooseDays = (value: DayBlockValue) => {
    setDays(value);
    setTime('');
    setNote('');
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Які дні зручні</label>
        <div className="flex flex-wrap gap-2">
          {DAY_BLOCKS.map((block) => (
            <button
              key={block.value}
              type="button"
              onClick={() => chooseDays(block.value)}
              className={chipClass(days === block.value)}
            >
              {block.label}
            </button>
          ))}
        </div>
      </div>

      {slots.length > 0 && (
        <div>
          <label className={labelClass}>Який час зручний</label>
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <button
                key={`${slot.days}-${slot.time}`}
                type="button"
                onClick={() => {
                  setTime(slot.time);
                  setNote('');
                }}
                className={chipClass(time === slot.time)}
              >
                {slot.time}
                <span className="ml-1.5 text-zinc-500 font-medium">· {slot.label}</span>
              </button>
            ))}
            <button type="button" onClick={() => setTime('other')} className={chipClass(time === 'other')}>
              Інший час
            </button>
          </div>
        </div>
      )}

      {noGroupInDays && (
        <p className="text-[12px] text-zinc-400 leading-relaxed">
          У ці дні групи саме цього віку поки немає. Напишіть зручний час — відкриваємо нові групи саме за такими запитами.
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

      <input type="hidden" name="preferred_days" value={daysLabel} />
      <input type="hidden" name="preferred_time" value={timeValue} />
    </div>
  );
};
