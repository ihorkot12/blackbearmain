import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Send, X, CheckCircle2, ChevronDown } from 'lucide-react';
import { submitLead } from '../lib/leadTracking';

interface QuickLeadModalProps {
  open: boolean;
  onClose: () => void;
  source: string;
  locations?: { id?: number | string; name: string; address?: string }[];
  ageGroups?: { value: string; label: string }[];
  title?: string;
  subtitle?: string;
  ageLabel?: string;
  namePlaceholder?: string;
}

const DEFAULT_AGE_GROUPS = [
  { value: '4-7 років', label: 'Молодша група (4–7 років)' },
  { value: '7-12 років', label: 'Середня група (7–12 років)' },
  { value: '12+ років', label: 'Старша група (12+ років)' },
  { value: 'Дорослий', label: 'Доросла група' }
];

/**
 * Коротка форма заявки прямо в місці кліку.
 * Раніше кожна кнопка «записатись» вела скролом на 12 700 px до єдиної форми
 * в кінці сторінки — перерваний скрол лишав людину посеред сторінки без форми.
 */
export const QuickLeadModal = ({
  open,
  onClose,
  source,
  locations = [],
  ageGroups = DEFAULT_AGE_GROUPS,
  title = 'Запис на пробне тренування',
  subtitle = 'Перше тренування безкоштовне. Залиште імʼя і номер — зателефонуємо та підберемо зручний час.',
  ageLabel = 'Вік / група',
  namePlaceholder = 'Олександр'
}: QuickLeadModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => nameRef.current?.focus(), 60);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setIsDone(false);
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');

    const formData = new FormData(e.target as HTMLFormElement);

    try {
      const ok = await submitLead({
        name: String(formData.get('name') || ''),
        phone: String(formData.get('phone') || ''),
        age_group: String(formData.get('age') || ''),
        location: String(formData.get('location') || ''),
        source
      });

      if (ok) {
        setIsDone(true);
      } else {
        setError('Не вдалося відправити заявку. Спробуйте ще раз або зателефонуйте: 095 475 65 00');
      }
    } catch (err) {
      console.error('Error submitting quick lead:', err);
      setError('Немає зв’язку з сервером. Спробуйте ще раз або зателефонуйте: 095 475 65 00');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    'w-full bg-black border border-white/10 rounded-2xl px-5 py-4 focus:border-red-600 outline-none transition-all text-sm text-white placeholder:text-zinc-600';
  const labelClass = 'block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-t-[28px] sm:rounded-[28px] p-6 sm:p-8 shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрити"
              className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <X size={20} />
            </button>

            {isDone ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="text-white" size={30} />
                </div>
                <h3 className="text-2xl font-black uppercase mb-3 text-white">Заявку прийнято</h3>
                <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                  Зателефонуємо найближчим часом, щоб підібрати групу і час.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-red-500 font-bold uppercase tracking-widest text-xs hover:text-red-400 transition-colors"
                >
                  Закрити
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white pr-10 leading-tight">
                  {title}
                </h3>
                <p className="text-zinc-400 text-sm mt-3 mb-7 leading-relaxed">{subtitle}</p>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className={labelClass} htmlFor="quick-lead-name">Ваше імʼя</label>
                    <input
                      id="quick-lead-name"
                      ref={nameRef}
                      required
                      name="name"
                      type="text"
                      autoComplete="name"
                      className={fieldClass}
                      placeholder={namePlaceholder}
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="quick-lead-phone">Телефон</label>
                    <input
                      id="quick-lead-phone"
                      required
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className={fieldClass}
                      placeholder="+38 (0__) ___ __ __"
                    />
                  </div>

                  <div className={`grid gap-4 ${locations.length === 1 || ageGroups.length === 1 ? '' : 'sm:grid-cols-2'}`}>
                    {ageGroups.length === 1 ? (
                      <input type="hidden" name="age" value={ageGroups[0].value} />
                    ) : (
                      <div>
                        <label className={labelClass} htmlFor="quick-lead-age">{ageLabel}</label>
                        <div className="relative">
                          <select id="quick-lead-age" name="age" defaultValue="" className={`${fieldClass} appearance-none cursor-pointer pr-12`}>
                            <option value="">{/ціль/i.test(ageLabel) ? 'Оберіть ціль' : 'Оберіть групу'}</option>
                            {ageGroups.map(group => (
                              <option key={group.value} value={group.value}>{group.label}</option>
                            ))}
                          </select>
                          <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-red-600" aria-hidden />
                        </div>
                      </div>
                    )}

                    {locations.length === 1 ? (
                      <input type="hidden" name="location" value={locations[0].name} />
                    ) : (
                      <div>
                        <label className={labelClass} htmlFor="quick-lead-location">Локація</label>
                        <div className="relative">
                          <select id="quick-lead-location" name="location" defaultValue="" className={`${fieldClass} appearance-none cursor-pointer pr-12`}>
                            <option value="">Оберіть локацію</option>
                            {locations.map(loc => (
                              <option key={loc.id ?? loc.name} value={loc.name}>{loc.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-red-600" aria-hidden />
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-sm text-red-400 leading-relaxed">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-16 bg-gradient-to-b from-[#D10000] to-[#A80000] disabled:from-zinc-800 disabled:to-zinc-800 text-white text-[13px] font-black uppercase tracking-[0.12em] rounded-2xl transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                  >
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={20} />
                        Записатись на пробне
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest font-medium">
                    Натискаючи кнопку, ви погоджуєтесь на обробку персональних даних
                  </p>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
