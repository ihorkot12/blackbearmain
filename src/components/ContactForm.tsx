import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Send } from 'lucide-react';
import { submitLead } from '../lib/leadTracking';

interface ContactFormProps {
  locations: any[];
  title?: string;
  subtitle?: string;
  ageGroups?: { value: string; label: string }[];
  source?: string;
  onSuccess?: () => void;
  submitLabel?: string;
  offerNote?: React.ReactNode;
  /** Підпис поля вибору групи — на дорослих лендінгах це «Ціль», а не «Вік» */
  ageLabel?: string;
  /** Контакти в лівій колонці; за замовчуванням — обидва тренери */
  contacts?: { name: string; phone: string }[];
  /** Плейсхолдер імені — на дорослих лендінгах без чоловічого імені за замовчуванням */
  namePlaceholder?: string;
}

export const ContactForm = ({
  locations,
  title = "Записатися на тренування",
  subtitle = "Залиште заявку, і ми зателефонуємо вам для узгодження групи, локації та зручного часу.",
  ageGroups = [
    { value: "4-7 років", label: "Молодша група (4–7 років)" },
    { value: "7-12 років", label: "Середня група (7–12 років)" },
    { value: "12+ років", label: "Старша група (12+ років)" },
    { value: "Дорослий", label: "Доросла група" }
  ],
  source = "main",
  onSuccess,
  submitLabel = "Записатись на пробне",
  offerNote,
  ageLabel = "Вік / Група",
  contacts = [
    { name: "Ігор Котляревський", phone: "+380954756500" },
    { name: "Олег Крамаренко", phone: "+380955680604" }
  ],
  namePlaceholder = "Олександр"
}: ContactFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        if (onSuccess) {
          onSuccess();
        } else {
          setIsSubmitted(true);
        }
      } else {
        setError('Не вдалося відправити заявку. Спробуйте ще раз або зателефонуйте: 095 475 65 00');
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      setError('Немає зв’язку з сервером. Спробуйте ще раз або зателефонуйте: 095 475 65 00');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 p-12 rounded-[32px] border border-red-600/30 text-center shadow-2xl"
      >
        <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(220,38,38,0.4)]">
          <Send className="text-white" size={32} />
        </div>
        <h3 className="text-3xl font-black uppercase mb-4">Дякуємо!</h3>
        <p className="text-zinc-400 text-lg mb-8">Ваша заявка прийнята. Ми зателефонуємо вам найближчим часом для узгодження деталей.</p>
        <button 
          onClick={() => setIsSubmitted(false)}
          className="text-red-500 font-bold uppercase tracking-widest text-xs hover:text-red-400 transition-colors"
        >
          Відправити ще одну заявку
        </button>
      </motion.div>
    );
  }

  return (
    <section id="contact" className="py-20 md:py-28 lg:py-32 bg-zinc-950 relative overflow-hidden border-t border-white/10">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-red-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />

      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <h2 className="max-w-2xl text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-black uppercase tracking-tight mb-8 leading-[1.08] md:leading-[1.02] break-words">
              {title}
            </h2>
            <p className="text-zinc-400 text-lg mb-12 leading-relaxed max-w-md">
              {subtitle}
            </p>
            
            <div className="space-y-8">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-red-600 border border-white/5 shrink-0 shadow-xl">
                  <MapPin size={24} />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-3">Наші Локації</div>
                  <div className="space-y-4">
                    {locations.map(loc => (
                      <div key={loc.id} className="text-white font-bold">
                        {loc.name}<br/>
                        <span className="text-zinc-500 text-sm font-medium">{loc.address}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-red-600 border border-white/5 shrink-0 shadow-xl">
                  <Send size={24} />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-3">Контакти</div>
                  <div className="space-y-4">
                    {contacts.map(c => (
                      <div key={c.phone} className="text-white font-bold">{c.name}:<br/><a href={`tel:${c.phone}`} className="inline-flex min-h-[44px] items-center text-red-500 hover:text-red-400 transition-colors">{c.phone.replace(/^\+38(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4')}</a></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 p-6 sm:p-8 md:p-10 rounded-[28px] md:rounded-[32px] border border-white/10 shadow-2xl relative">
            {offerNote && (
              <div className="mb-8 p-5 rounded-2xl bg-red-600/10 border border-red-600/30">
                {offerNote}
              </div>
            )}
            <form className="space-y-6" onSubmit={handleFormSubmit}>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Ваше ім'я</label>
                <input 
                  required
                  name="name"
                  type="text" 
                  className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 focus:border-red-600 outline-none transition-all text-sm placeholder:text-zinc-600"
                  placeholder={namePlaceholder}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Телефон</label>
                <input 
                  required
                  name="phone"
                  type="tel" 
                  className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 focus:border-red-600 outline-none transition-all text-sm placeholder:text-zinc-600"
                  placeholder="+38 (0__) ___ __ __"
                />
              </div>
              {locations.length === 1 ? (
                <input type="hidden" name="location" value={locations[0].name} />
              ) : (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Локація</label>
                  <select name="location" defaultValue="" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 focus:border-red-600 outline-none transition-all appearance-none text-sm text-white cursor-pointer">
                    <option value="">Оберіть локацію</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.name}>{loc.name} ({loc.address})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">{ageLabel}</label>
                <select name="age" defaultValue="" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 focus:border-red-600 outline-none transition-all appearance-none text-sm text-white cursor-pointer">
                  <option value="">{/ціль/i.test(ageLabel) ? 'Оберіть ціль' : 'Оберіть групу'}</option>
                  {ageGroups.map(group => (
                    <option key={group.value} value={group.value}>{group.label}</option>
                  ))}
                </select>
              </div>
              {error && (
                <p className="text-sm text-red-400 leading-relaxed">{error}</p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-16 bg-gradient-to-b from-[#D10000] to-[#A80000] hover:-translate-y-0.5 disabled:from-zinc-800 disabled:to-zinc-800 disabled:hover:translate-y-0 text-white text-[13px] font-black uppercase tracking-[0.12em] rounded-2xl transition-all duration-300 shadow-[0_16px_40px_-10px_rgba(209,0,0,0.6)] flex items-center justify-center gap-2.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                {isSubmitting ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={20} />
                    {submitLabel}
                  </>
                )}
              </button>
              <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest font-medium">
                Натискаючи кнопку, ви погоджуєтесь на обробку персональних даних
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
