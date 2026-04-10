import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Navbar } from './components/Navbar';
import { 
  Shield, 
  Trophy, 
  Users, 
  Award,
  MapPin,
  ChevronRight, 
  Star, 
  Instagram, 
  Facebook, 
  Quote,
  Zap,
  Target,
  Sword,
  Medal,
  Dumbbell,
  Brain,
  Flame,
  Clock,
  CheckCircle2,
  TrendingUp,
  Send
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from './components/SEO';
import { ContactForm } from './components/ContactForm';

const Button = ({ children, variant = 'primary', className = '', showIcon = true, ...props }: any) => {
  const variants = {
    primary: 'bg-gradient-to-b from-[#D10000] to-[#A80000] text-white shadow-[0_8px_24px_rgba(209,0,0,0.35)] hover:shadow-[0_12px_28px_rgba(209,0,0,0.45)] active:shadow-[0_4px_12px_rgba(209,0,0,0.4)]',
    secondary: 'bg-transparent border-2 border-white/20 text-white hover:bg-white/10 hover:border-white',
  };
  
  const baseStyles = "h-[58px] px-10 rounded-[18px] font-bold uppercase tracking-[0.05em] transition-all duration-300 flex items-center justify-center gap-3";
  const hoverStyles = variant === 'primary' ? "hover:translate-y-[-2px]" : "hover:translate-y-[-1px]";

  return (
    <button 
      className={`${baseStyles} ${hoverStyles} ${variants[variant as keyof typeof variants]} ${className}`}
      {...props}
    >
      <span>{children}</span>
      {variant === 'primary' && showIcon && <ChevronRight size={18} className="shrink-0" />}
    </button>
  );
};

export const PersonalLanding = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    // Check session storage for cached data
    const cachedData = sessionStorage.getItem('site_init_data');
    if (cachedData) {
      try {
        const data = JSON.parse(cachedData);
        if (Array.isArray(data.locations)) setLocations(data.locations);
        if (data.content) setContent(data.content);
      } catch (e) {
        console.error('Error parsing cached data', e);
      }
    }

    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          if (Array.isArray(data.locations)) setLocations(data.locations);
          if (data.content) setContent(data.content);
          // Save to session storage
          sessionStorage.setItem('site_init_data', JSON.stringify(data));
        }
      })
      .catch(err => console.error('Error fetching init data:', err));
  }, []);

  const advantages = [
    {
      title: "100% уваги тренера",
      desc: "Кожна секунда тренування присвячена тільки вам. Корекція техніки в реальному часі для максимального результату.",
      icon: <Target size={24} />
    },
    {
      title: "Гнучкий графік",
      desc: "Тренуйтеся тоді, коли зручно вам. Ми підлаштовуємося під ваш ритм життя, а не навпаки.",
      icon: <Clock size={24} />
    },
    {
      title: "Індивідуальна програма",
      desc: "План занять розробляється під ваші цілі: від самооборони до підготовки до чорного поясу або змагань.",
      icon: <Brain size={24} />
    },
    {
      title: "Швидкий прогрес",
      desc: "Персональні заняття дозволяють засвоїти матеріал у 3-4 рази швидше, ніж у групі.",
      icon: <TrendingUp size={24} />
    }
  ];

  const privileges = [
    { title: "VIP-сервіс", desc: "Окремий розклад та пріоритет у виборі часу тренувань." },
    { title: "Аналіз харчування", desc: "Рекомендації щодо дієти для підтримки спортивної форми." },
    { title: "Підготовка до іспитів", desc: "Поглиблене вивчення ката та техніки для успішної здачі на пояси." },
    { title: "Спецкурс самооборони", desc: "Прикладні навички для реальних життєвих ситуацій." }
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-600 selection:text-white">
      <SEO 
        title={content?.personal_seo_title || "Персональні тренування з карате Київ | Індивідуальні заняття"}
        description={content?.personal_seo_description || "Індивідуальні тренування з карате Кіокушинкай у Києві. Гнучкий графік, персональна програма та 100% уваги тренера. Найкращий тренер з карате Київ (Шулявка, Сирець). Швидкий результат!"}
        keywords={content?.personal_seo_keywords || "персональні тренування карате київ, індивідуальні заняття карате київ, тренер з карате київ, приватні уроки карате київ, карате шулявка індивідуально"}
      />
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={content?.personal_hero_bg || "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=2000&auto=format&fit=crop"} 
            alt="Personal Training" 
            className="w-full h-full object-cover opacity-40 grayscale scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-black to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
              <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
              Персональний наставник: Залишилось 1 вільне місце на вечір
            </div>
            <h1 
              className="text-5xl sm:text-6xl md:text-[110px] font-black uppercase leading-[0.9] md:leading-[0.85] tracking-tighter mb-10"
              dangerouslySetInnerHTML={{ __html: content?.personal_hero_title || 'Індивідуальне <br /> <span className="text-red-600 text-glow">карате</span> <br /> у Києві' }}
            />
            <p 
              className="text-xl md:text-2xl text-zinc-400 mb-12 leading-relaxed max-w-2xl font-medium"
              dangerouslySetInnerHTML={{ __html: content?.personal_hero_subtitle || 'Персональні тренування з карате Кіокушинкай на Шулявці та Сирці — це найшвидший спосіб опанувати бойове мистецтво під наглядом майстра. <span className="text-white">Перша консультація — БЕЗКОШТОВНО.</span>' }}
            />
            <div className="flex flex-col sm:flex-row gap-6">
              <Button 
                className="shadow-[0_20px_50px_rgba(209,0,0,0.3)]"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Забронювати час
              </Button>
              <Button variant="secondary" onClick={() => document.getElementById('advantages')?.scrollIntoView({ behavior: 'smooth' })}>
                Переваги
              </Button>
            </div>
          </motion.div>
        </div>

      </section>

      {/* Advantages Section */}
      <section id="advantages" className="py-16 md:py-32 bg-zinc-950 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-12 md:mb-20">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Чому персонально?</h2>
            <h3 className="text-3xl sm:text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none">
              Твій прогрес — <br /> <span className="text-zinc-700">наш пріоритет</span>
            </h3>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {advantages.map((adv, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 sm:p-10 bg-zinc-900/30 rounded-3xl lg:rounded-[2.5rem] border border-white/5 hover:border-red-600/40 transition-all duration-500 group"
              >
                <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center mb-8 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <div className="text-red-600">{adv.icon}</div>
                </div>
                <h3 className="text-2xl font-black mb-4 uppercase tracking-tighter">{adv.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">{adv.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Privileges Section */}
      <section className="py-16 md:py-32 bg-black relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            <div className="relative">
              <div className="absolute -inset-6 border border-red-600/20 rounded-3xl lg:rounded-[4rem] -rotate-2" />
              <img 
                src={content?.personal_advantages_image || "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1000&auto=format&fit=crop"} 
                alt="Personal Training Session" 
                className="relative rounded-3xl lg:rounded-[3.5rem] grayscale hover:grayscale-0 transition-all duration-1000 shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>

            <div>
              <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Ексклюзивність</h2>
              <h3 className="text-4xl md:text-7xl font-black uppercase tracking-tighter mb-10 leading-[0.9]">
                Більше ніж <br /> просто <span className="text-red-600">урок</span>
              </h3>
              
              <div className="space-y-8">
                {privileges.map((priv, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-6 group"
                  >
                    <div className="shrink-0 w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-red-600 border border-white/5 group-hover:border-red-600/50 transition-colors">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h4 className="text-xl font-black uppercase tracking-tight mb-1">{priv.title}</h4>
                      <p className="text-zinc-500 text-sm leading-relaxed max-w-md font-medium">{priv.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Locations Section */}
      <section className="py-16 md:py-24 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-4">Де ми тренуємо</h2>
            <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">Наші зали у <span className="text-zinc-600 text-glow">Києві</span></h3>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 bg-zinc-900 rounded-[2.5rem] border border-white/5 hover:border-red-600/20 transition-all group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all">
                  <MapPin size={24} />
                </div>
                <h4 className="text-2xl font-black uppercase tracking-tight">Шулявка</h4>
              </div>
              <p className="text-zinc-400 mb-6 font-medium">вул. Сім'ї Бродських, 31/33 (м. Шулявська). Зручна локація для мешканців КПІ, Шулявки та Лук'янівки.</p>
              <div className="flex items-center gap-2 text-red-600 font-bold uppercase tracking-widest text-[10px]">
                <Clock size={14} />
                Пн, Ср, Пт: 17:00 - 20:30
              </div>
            </div>
            <div className="p-8 bg-zinc-900 rounded-[2.5rem] border border-white/5 hover:border-red-600/20 transition-all group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all">
                  <MapPin size={24} />
                </div>
                <h4 className="text-2xl font-black uppercase tracking-tight">Відрадний / Сирець</h4>
              </div>
              <p className="text-zinc-400 mb-6 font-medium">вул. Віктора Некрасова, 1-3. Секція карате для мешканців Відрадного, Сирця та Нивок.</p>
              <div className="flex items-center gap-2 text-red-600 font-bold uppercase tracking-widest text-[10px]">
                <Clock size={14} />
                Пн, Ср, Пт: 17:00 - 19:00
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <ContactForm 
        locations={locations}
        title="Забронюй час"
        subtitle="Ми зв'яжемося з вами для узгодження графіка та вибору персонального тренера."
        ageGroups={[
          { value: "Дорослий", label: "Дорослий" },
          { value: "Підліток", label: "Підліток" },
          { value: "Дитина", label: "Дитина" }
        ]}
        source="personal_landing"
      />

      {/* Footer */}
      <footer className="py-12 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 flex items-center justify-center rotate-3">
              <span className="text-white font-black italic text-xs">B</span>
            </div>
            <span className="font-black tracking-tighter text-sm">BLACK BEAR DOJO</span>
          </Link>
          <div className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold">
            © 2026 Black Bear Dojo. Всі права захищені.
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Instagram size={20} /></a>
            <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Facebook size={20} /></a>
          </div>
        </div>
      </footer>
      {/* Floating CTA for Mobile */}
      <div className="fixed bottom-6 left-6 right-6 z-50 md:hidden">
        <motion.button
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full h-[64px] bg-red-600 text-white font-black uppercase tracking-[0.2em] text-sm rounded-2xl shadow-[0_20px_40px_rgba(220,38,38,0.4)] flex items-center justify-center gap-3"
        >
          <Send size={18} />
          Забронювати час
        </motion.button>
      </div>
    </div>
  );
};
