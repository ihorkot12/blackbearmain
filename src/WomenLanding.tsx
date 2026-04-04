import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Navbar } from './components/Navbar';
import { 
  Shield, 
  Trophy, 
  Users, 
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
  Send,
  Heart,
  Sparkles,
  Info
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

export const WomenLanding = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    
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

  const benefits = [
    {
      title: "Естетика та Гнучкість",
      desc: "На відміну від боксу, карате розвиває не тільки силу, а й неймовірну гнучкість, грацію та правильну поставу.",
      icon: <Sparkles className="text-red-500" size={24} />
    },
    {
      title: "Розумна Самооборона",
      desc: "Ви вчитеся використовувати силу супротивника проти нього самого. Це ідеально для дівчат будь-якої комплекції.",
      icon: <Shield className="text-red-500" size={24} />
    },
    {
      title: "Антистрес та Енергія",
      desc: "Виплеск емоцій через удари та глибока концентрація допомагають повністю перезавантажити мозок після роботи.",
      icon: <Zap className="text-red-500" size={24} />
    },
    {
      title: "Функціональне Тіло",
      desc: "Рівномірне навантаження на всі групи м'язів без зайвого 'перекачування'. Тільки рельєф та витривалість.",
      icon: <Dumbbell className="text-red-500" size={24} />
    }
  ];

  const comparison = [
    { karate: "Гармонійний розвиток всього тіла" },
    { karate: "Робота ногами" },
    { karate: "Філософія та контроль емоцій" },
    { karate: "Естетика рухів та розтяжка" }
  ];

  const fears = [
    {
      q: "Чи це не надто жорстко для дівчини?",
      a: "Ми практикуємо Кіокушинкай з акцентом на техніку та контроль. У наших групах панує атмосфера підтримки, а не агресії."
    },
    {
      q: "Я боюсь отримати синці на обличчі",
      a: "У карате Кіокушинкай удари руками в голову заборонені. Ваше обличчя залишається недоторканим, на відміну від боксу."
    },
    {
      q: "У мене немає спортивної підготовки",
      a: "90% наших учениць прийшли 'з нуля'. Ми починаємо з базової розминки та поступово нарощуємо навантаження."
    }
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-600 selection:text-white">
      <SEO 
        title={content?.women_seo_title || "Карате для дівчат"}
        description={content?.women_seo_description || "Секція карате для дівчат у Києві. Естетика, самооборона, гнучкість та зняття стресу. Чому карате краще за бокс? Запишіться на безкоштовне тренування!"}
        keywords={content?.women_seo_keywords || "карате для дівчат київ, самооборона для дівчат київ, фітнес карате київ, секція карате шулявка"}
      />
      
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={content?.women_hero_bg || "https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=2000&auto=format&fit=crop"} 
            alt="Women Karate" 
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
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600/20 border border-red-600/30 text-red-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-8">
              <Flame size={12} />
              Естетика • Сила • Впевненість
            </div>
            <h1 
              className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9] mb-8"
              dangerouslySetInnerHTML={{ __html: content?.women_hero_title || 'Карате для <br /> <span className="text-red-600">Дівчат</span>' }}
            />
            <p 
              className="text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed max-w-xl"
              dangerouslySetInnerHTML={{ __html: content?.women_hero_subtitle || 'Відкрийте для себе мистецтво, яке дарує ідеальне тіло, непохитний спокій та навички самооборони без ризику для вашої краси.' }}
            />
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>
                Спробувати безкоштовно
              </Button>
              <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-zinc-800 overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?u=women${i}`} alt="User" />
                    </div>
                  ))}
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
                  <span className="text-white">40+ дівчат</span> вже з нами
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-24 bg-zinc-950 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6">
              Чому Карате <span className="text-red-600">краще за Бокс?</span>
            </h2>
            <p className="text-zinc-500 max-w-2xl mx-auto">
              Ми поважаємо всі види спорту, але для організму дівчат карате пропонує більш гармонійний підхід.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              {comparison.map((item, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-4 group hover:border-red-600/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="text-red-600" size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-white mb-1">{item.karate}</div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl overflow-hidden border border-white/10">
                <img 
                  src={content?.women_advantages_image || "https://images.unsplash.com/photo-1599058917233-3583503c5e8e?q=80&w=1000&auto=format&fit=crop"} 
                  alt="Training" 
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 p-8 bg-red-600 rounded-3xl shadow-2xl max-w-[240px]">
                <Quote className="text-white/30 mb-4" size={32} />
                <p className="text-white font-bold italic text-sm">
                  "Я шукала спорт для душі та тіла. В карате я знайшла набагато більше."
                </p>
                <div className="mt-4 text-[10px] uppercase tracking-widest font-black text-white/70">— Єва, 17 років</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-6">
            {benefits.map((benefit, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-3xl bg-zinc-900 border border-white/5 hover:border-red-600/30 transition-all group"
              >
                <div className="mb-6 p-4 rounded-2xl bg-black inline-block group-hover:scale-110 transition-transform">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold mb-4">{benefit.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  {benefit.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing Objections (FAQ Style) */}
      <section className="py-24 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4">
              Ваші <span className="text-red-600">Страхи</span> — Наші Відповіді
            </h2>
            <p className="text-zinc-500">Ми розуміємо ваші сумніви. Ось як ми робимо тренування комфортними.</p>
          </div>

          <div className="space-y-6">
            {fears.map((fear, idx) => (
              <div key={idx} className="p-8 rounded-3xl bg-white/5 border border-white/10">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shrink-0 font-black text-xs">?</div>
                  <div>
                    <h4 className="text-lg font-bold mb-3">{fear.q}</h4>
                    <p className="text-zinc-400 text-sm leading-relaxed">{fear.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <ContactForm 
        locations={locations}
        title="Запишіться на перше безкоштовне тренування"
        subtitle="Ми зателефонуємо вам, щоб підібрати зручний час та відповісти на всі запитання."
        ageGroups={[
          { value: "Група для дівчат", label: "Група для дівчат" },
          { value: "Дівчата (підлітки)", label: "Дівчата (підлітки)" },
          { value: "Індивідуально", label: "Індивідуальні тренування" }
        ]}
        source="women_landing"
      />

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 flex items-center justify-center rotate-3">
              <span className="text-white font-black italic text-sm">B</span>
            </div>
            <span className="font-black tracking-tighter text-lg uppercase">Black Bear Dojo</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Instagram size={20} /></a>
            <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Facebook size={20} /></a>
          </div>
          <div className="text-zinc-600 text-[10px] uppercase tracking-widest">
            © 2026 Black Bear Dojo. Всі права захищені.
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
          Записатись зараз
        </motion.button>
      </div>
    </div>
  );
};
