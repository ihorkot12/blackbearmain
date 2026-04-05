import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Send } from 'lucide-react';

interface ContactFormProps {
  locations: any[];
  title?: string;
  subtitle?: string;
  ageGroups?: { value: string; label: string }[];
  source?: string;
}

export const ContactForm = ({ 
  locations, 
  title = "Запишіть дитину в секцію карате Київ", 
  subtitle = "Залиште заявку на дитяче карате Київ, і ми зателефонуємо вам для узгодження часу пробного заняття.",
  ageGroups = [
    { value: "4-7 років", label: "Молодша група (4–7 років)" },
    { value: "7-12 років", label: "Середня група (7–12 років)" },
    { value: "12+ років", label: "Старша група (12+ років)" },
    { value: "Дорослий", label: "Доросла група" }
  ],
  source = "main"
}: ContactFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.target as HTMLFormElement);
    const eventId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const data = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      age_group: formData.get('age'),
      location: formData.get('location'),
      event_id: eventId,
      source: source
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsSubmitted(true);
        // Track conversion if needed
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 p-12 rounded-[2.5rem] border border-red-600/30 text-center shadow-2xl"
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
    <section id="contact" className="py-16 md:py-24 bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-red-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-black uppercase tracking-tighter mb-8 leading-[1.1] md:leading-[0.9]">
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
                    <div className="text-white font-bold">Ігор Котляревський:<br/><a href="tel:+380954756500" className="text-red-500 hover:text-red-400 transition-colors">095 475 65 00</a></div>
                    <div className="text-white font-bold">Олег Крамаренко:<br/><a href="tel:+380955680604" className="text-red-500 hover:text-red-400 transition-colors">095 568 06 04</a></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 p-6 sm:p-8 md:p-12 rounded-3xl lg:rounded-[3rem] border border-white/10 shadow-2xl relative">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-red-600 rounded-full flex items-center justify-center text-white font-black text-xs uppercase tracking-tighter rotate-12 shadow-2xl z-20">
              Безкоштовно
            </div>
            <form className="space-y-6" onSubmit={handleFormSubmit}>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Ваше ім'я</label>
                <input 
                  required
                  name="name"
                  type="text" 
                  className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 focus:border-red-600 outline-none transition-all text-sm placeholder:text-zinc-700"
                  placeholder="Олександр"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Телефон</label>
                <input 
                  required
                  name="phone"
                  type="tel" 
                  className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 focus:border-red-600 outline-none transition-all text-sm placeholder:text-zinc-700"
                  placeholder="+38 (0__) ___ __ __"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Локація</label>
                <select name="location" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 focus:border-red-600 outline-none transition-all appearance-none text-sm text-white cursor-pointer">
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name} ({loc.address})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Вік / Група</label>
                <select name="age" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 focus:border-red-600 outline-none transition-all appearance-none text-sm text-white cursor-pointer">
                  {ageGroups.map(group => (
                    <option key={group.value} value={group.value}>{group.label}</option>
                  ))}
                </select>
              </div>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[72px] bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-[0_20px_40px_rgba(220,38,38,0.2)] flex items-center justify-center gap-3 active:scale-[0.98]"
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
              <p className="text-[10px] text-zinc-600 text-center uppercase tracking-widest font-medium">
                Натискаючи кнопку, ви погоджуєтесь на обробку персональних даних
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
