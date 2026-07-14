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
  const [coaches, setCoaches] = useState<any[]>([]);

  useEffect(() => {
    // Check session storage for cached data
    const cachedData = sessionStorage.getItem('site_init_data');
    if (cachedData) {
      try {
        const data = JSON.parse(cachedData);
        if (Array.isArray(data.locations)) setLocations(data.locations);
        if (Array.isArray(data.coaches)) setCoaches(data.coaches);
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
          if (Array.isArray(data.coaches)) setCoaches(data.coaches);
          if (data.content) setContent(data.content);
          // Save to session storage
          sessionStorage.setItem('site_init_data', JSON.stringify(data));
        }
      })
      .catch(err => console.error('Error fetching init data:', err));
  }, []);

  const priceSingle = content?.personal_price_single || '900';
  const priceFirst = content?.personal_price_first || '450';

  const faq = [
    {
      q: 'Скільки коштує персональне тренування?',
      a: `Разове персональне тренування — ${priceSingle} грн. Перше заняття — ${priceFirst} грн, тобто вдвічі дешевше: це знайомство з тренером, розбір рівня підготовки та постановка цілі.`
    },
    {
      q: 'Чи потрібна попередня підготовка?',
      a: 'Ні. Персональний формат і створений для того, щоб починати з будь-якого рівня: тренер підбирає навантаження під ваш вік, стан і ціль. Більшість приходить без досвіду в карате.'
    },
    {
      q: 'Хто проводить персональні тренування?',
      a: 'Ігор Котляревський — 3 дан кіокушинкай, майстер спорту України, абсолютний чемпіон України, призер чемпіонату Європи. Олег Крамаренко — тренер клубу, працює з дитячими та підлітковими групами, готує спортсменів до змагань.'
    },
    {
      q: 'Для кого підходить персональний формат?',
      a: 'Для дітей, підлітків і дорослих. Найчастіше його беруть, коли треба підтягнути техніку перед іспитом на пояс, наздогнати групу, розібратися з базою з нуля або займатися в спокійному темпі без групи.'
    },
    {
      q: 'Де проходять заняття?',
      a: 'У наших залах: Шулявка (вул. Сім\'ї Бродських, 31/33) та Відрадний / Сирець (вул. Віктора Некрасова, 1-3). Локацію і час узгоджуємо після заявки.'
    }
  ];

  const advantages = [
    {
      title: "Увага до техніки",
      desc: "Тренер бачить помилки одразу, пояснює простіше і допомагає відпрацювати рух у вашому темпі.",
      icon: <Target size={24} />
    },
    {
      title: "Зручний темп",
      desc: "Навантаження підбирається під вік, рівень підготовки та ціль: форма, самооборона, пояс або впевненість.",
      icon: <Clock size={24} />
    },
    {
      title: "Чітка ціль",
      desc: "Перед стартом визначаємо, над чим працюємо: база карате, координація, удари руками й ногами, витривалість або іспит.",
      icon: <Brain size={24} />
    },
    {
      title: "Зрозумілий прогрес",
      desc: "Після занять зрозуміло, що вже виходить, що потрібно підтягнути і який наступний крок у тренуваннях.",
      icon: <TrendingUp size={24} />
    }
  ];

  const privileges = [
    { title: "Старт з розбору цілі", desc: "Узгоджуємо вік, досвід, стан підготовки та бажаний результат без зайвих обіцянок." },
    { title: "Робота над помилками", desc: "Більше повторень, детальніші пояснення і корекція техніки під час заняття." },
    { title: "Підготовка до іспитів", desc: "Відпрацювання ката, кіхону та базових вимог для складання на пояс." },
    { title: "Практична самооборона", desc: "Дистанція, реакція, стійка, прості зв'язки руками й ногами для впевненішої поведінки." }
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-600 selection:text-white">
      <SEO 
        title={content?.personal_seo_title || "Персональні тренування з карате Київ | Індивідуальні заняття"}
        description={content?.personal_seo_description || `Персональні тренування з карате у Києві для дітей, підлітків і дорослих. Перше заняття — ${priceFirst} грн замість ${priceSingle}. Індивідуальний темп, розбір техніки, підготовка до іспитів. Локації: Шулявка та Сирець.`}
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
              Персональний формат • Шулявка / Сирець
            </div>
            <h1 
              className="text-4xl sm:text-6xl md:text-[110px] font-black uppercase leading-[0.95] md:leading-[0.85] tracking-tight sm:tracking-tighter mb-10"
              dangerouslySetInnerHTML={{ __html: content?.personal_hero_title || 'Персональні <br /> <span className="text-red-600 text-glow">тренування</span> <br /> з карате' }}
            />
            <p 
              className="text-xl md:text-2xl text-zinc-400 mb-12 leading-relaxed max-w-2xl font-medium"
              dangerouslySetInnerHTML={{ __html: content?.personal_hero_subtitle || 'Один на один із тренером: точний розбір техніки, темп під вас і повна увага все заняття. Починаємо зі знайомства — визначаємо рівень, ціль і план роботи.' }}
            />
            <div className="inline-flex flex-wrap items-center gap-x-4 gap-y-2 mb-10 px-6 py-4 rounded-2xl bg-zinc-900/70 border border-red-600/30 backdrop-blur-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Перше заняття</span>
              <span className="text-3xl md:text-4xl font-black text-red-600 leading-none">{priceFirst} грн</span>
              <span className="text-xl text-zinc-600 line-through font-black leading-none">{priceSingle} грн</span>
              <span className="px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.15em]">−50%</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              <Button
                className="shadow-[0_20px_50px_rgba(209,0,0,0.3)]"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Записатись за {priceFirst} грн
              </Button>
              <Button variant="secondary" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                Вартість і формат
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-12">
              {['3 дан кіокушинкай', 'Майстер спорту України', '2 зали у Києві'].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-widest">
                  <CheckCircle2 size={14} className="text-red-600 shrink-0" />
                  {item}
                </div>
              ))}
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
              Менше хаосу. <br /> <span className="text-zinc-700">Більше техніки</span>
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
              <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Формат заняття</h2>
              <h3 className="text-4xl md:text-7xl font-black uppercase tracking-tighter mb-10 leading-[0.9]">
                Тренування <br /> під вашу <span className="text-red-600">ціль</span>
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

      {/* Pricing Section */}
      <section id="pricing" className="py-16 md:py-32 bg-zinc-950 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12 md:mb-20">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Вартість</h2>
            <h3 className="text-3xl sm:text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
              Чесна ціна. <span className="text-zinc-700">Без абонемента</span>
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* First session */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative p-8 sm:p-10 bg-zinc-900 rounded-3xl lg:rounded-[2.5rem] border-2 border-red-600 shadow-[0_20px_60px_rgba(209,0,0,0.15)]"
            >
              <div className="absolute -top-3 left-8 px-4 py-1.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                Знижка 50%
              </div>
              <h4 className="text-2xl font-black uppercase tracking-tighter mb-2">Перше заняття</h4>
              <p className="text-zinc-500 text-sm font-medium mb-8">Знайомство з тренером, розбір рівня, постановка цілі та плану.</p>
              <div className="flex items-end gap-4 mb-8">
                <span className="text-5xl md:text-6xl font-black text-red-600 leading-none">{priceFirst}</span>
                <span className="text-xl font-black text-zinc-500 leading-none mb-1">грн</span>
                <span className="text-2xl font-black text-zinc-700 line-through leading-none mb-1">{priceSingle}</span>
              </div>
              <Button
                className="w-full !px-6"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Записатись
              </Button>
            </motion.div>

            {/* Regular session */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-8 sm:p-10 bg-zinc-900/30 rounded-3xl lg:rounded-[2.5rem] border border-white/10"
            >
              <h4 className="text-2xl font-black uppercase tracking-tighter mb-2">Разове тренування</h4>
              <p className="text-zinc-500 text-sm font-medium mb-8">Далі — за фактом заняття. Без абонемента і без зобов'язань.</p>
              <div className="flex items-end gap-4 mb-8">
                <span className="text-5xl md:text-6xl font-black text-white leading-none">{priceSingle}</span>
                <span className="text-xl font-black text-zinc-500 leading-none mb-1">грн</span>
              </div>
              <Button
                variant="secondary"
                className="w-full !px-6"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Підібрати час
              </Button>
            </motion.div>
          </div>

          <p className="text-center text-zinc-600 text-xs font-bold uppercase tracking-widest mt-10 max-w-2xl mx-auto leading-relaxed">
            Персональні тренування — обмежений ресурс: у кожного тренера лише кілька вільних слотів на тиждень.
          </p>
        </div>
      </section>

      {/* Coaches Section */}
      {coaches.length > 0 && (
        <section className="py-16 md:py-32 bg-black">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12 md:mb-20">
              <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Хто тренує</h2>
              <h3 className="text-3xl sm:text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
                Ваш <span className="text-red-600">тренер</span>
              </h3>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {coaches.map((coach: any, i: number) => {
                const achievements = typeof coach.achievements === 'string'
                  ? (() => { try { return JSON.parse(coach.achievements); } catch { return []; } })()
                  : (coach.achievements || []);
                return (
                  <motion.div
                    key={coach.id ?? i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="p-6 sm:p-8 bg-zinc-900/40 rounded-3xl lg:rounded-[2.5rem] border border-white/5 hover:border-red-600/40 transition-all duration-500"
                  >
                    <div className="flex items-center gap-5 mb-6">
                      {coach.photo && (
                        <img
                          src={coach.photo}
                          alt={coach.name}
                          className="w-20 h-20 rounded-2xl object-cover grayscale shrink-0 border border-white/10"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      )}
                      <div>
                        <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter">{coach.name}</h4>
                        <p className="text-red-600 font-bold uppercase tracking-widest text-[10px]">{coach.role}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {achievements.map((item: string, k: number) => (
                        <div key={k} className="flex items-start gap-3 text-zinc-400 text-sm font-medium">
                          <Medal size={16} className="text-red-600 shrink-0 mt-0.5" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="py-16 md:py-32 bg-zinc-950 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Часті запитання</h2>
            <h3 className="text-3xl sm:text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
              Коротко про <span className="text-zinc-700">головне</span>
            </h3>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faq.map((item, i) => (
              <details
                key={i}
                className="group bg-zinc-900/50 rounded-2xl border border-white/5 hover:border-red-600/30 transition-colors overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer p-6 list-none">
                  <span className="font-black uppercase tracking-tight text-sm md:text-base">{item.q}</span>
                  <ChevronRight size={20} className="text-red-600 shrink-0 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="px-6 pb-6 text-zinc-400 text-sm leading-relaxed font-medium">{item.a}</p>
              </details>
            ))}
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
        title="Запис на персональне тренування"
        subtitle="Залиште номер — уточнимо ціль, рівень підготовки, локацію та вільні часові слоти."
        ageGroups={[
          { value: "Дорослий", label: "Дорослий" },
          { value: "Підліток", label: "Підліток" },
          { value: "Дитина", label: "Дитина" }
        ]}
        source="personal_landing"
        submitLabel={`Записатись за ${priceFirst} грн`}
        offerNote={
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
              <Flame className="text-white" size={22} />
            </div>
            <div>
              <div className="text-white font-black uppercase tracking-tight text-sm mb-1">
                Перше заняття — {priceFirst} грн замість {priceSingle}
              </div>
              <div className="text-zinc-400 text-xs font-medium leading-relaxed">
                Знайомство з тренером, розбір рівня та плану. Далі — {priceSingle} грн за заняття, без абонемента.
              </div>
            </div>
          </div>
        }
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
      <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
        <motion.button
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full h-[58px] bg-red-600 text-white font-black uppercase tracking-[0.12em] text-xs rounded-2xl shadow-[0_20px_40px_rgba(220,38,38,0.4)] flex items-center justify-center gap-3"
        >
          <Send size={18} />
          Перше заняття — {priceFirst} грн
        </motion.button>
      </div>
    </div>
  );
};
