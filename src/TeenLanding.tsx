import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Shield, 
  Trophy, 
  Users, 
  ChevronRight, 
  Star, 
  Instagram, 
  Facebook, 
  Quote,
  Send,
  Zap,
  Target,
  Sword,
  Medal,
  Dumbbell,
  Brain,
  Flame
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

export const TeenLanding = () => {
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

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const painPoints = [
    {
      icon: <Shield className="text-red-500" size={32} />,
      title: "Невпевненість та булінг",
      desc: "Підлітковий вік — час викликів. Ми вчимо не просто битися, а випромінювати впевненість, яка зупиняє агресію без слів."
    },
    {
      icon: <Brain className="text-red-500" size={32} />,
      title: "Стрес та навчання",
      desc: "Величезні навантаження в школі виснажують? Карате — це ідеальне перезавантаження для мозку та вихід для емоцій."
    },
    {
      icon: <Dumbbell className="text-red-500" size={32} />,
      title: "Фізична форма",
      desc: "Хочеться мати атлетичне тіло та бути сильнішим за однолітків? Наші тренування формують справжню чоловічу та жіночу статуру."
    },
    {
      icon: <Users className="text-red-500" size={32} />,
      title: "Пошук свого кола",
      desc: "Важливо бути серед тих, хто прагне більшого. У нас підліток знайде друзів з правильними цінностями та дисципліною."
    }
  ];

  const advantages = [
    {
      title: "Ефективність Кіокушинкай",
      desc: "Один з найсильніших стилів у світі. Ти навчишся реальному захисту, який працює в житті, а не тільки в залі.",
      icon: <Sword size={24} />
    },
    {
      title: "Шлях до Чорного Поясу",
      desc: "Ми готуємо майстрів. Твій прогрес фіксується міжнародними сертифікатами WKO ShinKyokushinkai.",
      icon: <Medal size={24} />
    },
    {
      title: "Лідерство та Харизма",
      desc: "Карате вчить контролювати емоції та вести за собою. Це база для успішної кар'єри та впевненості в будь-якій компанії.",
      icon: <Target size={24} />
    },
    {
      title: "Елітне ком'юніті",
      desc: "Ти будеш серед тих, хто обирає розвиток замість деградації. Друзі на все життя з правильними цінностями.",
      icon: <Users size={24} />
    }
  ];

  const privileges = [
    { title: "Спецпідготовка", desc: "Додаткові тренування для тих, хто готується до чемпіонатів Європи та світу." },
    { title: "Школа інструкторів", desc: "Можливість у майбутньому стати асистентом тренера та розвиватись професійно." },
    { title: "Міжнародні збори", desc: "Виїзди на семінари в Японію та країни Європи до кращих майстрів." },
    { title: "Networking", desc: "Доступ до закритої спільноти успішних випускників нашого клубу." }
  ];

  const steps = [
    { num: "01", title: "Виклик собі", desc: "Приходь на перше безкоштовне тренування. Перевір, на що ти здатний насправді." },
    { num: "02", title: "Загартування", desc: "Освоєння техніки 'куміте' та зміцнення тіла. Початок трансформації характеру." },
    { num: "03", title: "Вихід на Татамі", desc: "Перші змагання та атестації. Перемога над власними страхами та лінню." },
    { num: "04", title: "Майстерність", desc: "Отримання майстерських ступенів та перетворення карате на твою внутрішню силу." }
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-600 selection:text-white scroll-smooth">
      <SEO 
        title={content?.teen_seo_title || "Карате для підлітків 12+ років"}
        description={content?.teen_seo_description || "Секція карате для підлітків у Києві. Професійні турніри, самооборона, лідерство та впевненість у собі. Локації: Шулявка, Відрадний. Перше тренування безкоштовно!"}
        keywords={content?.teen_seo_keywords || "карате для підлітків київ, секція карате для підлітків шулявка, самооборона для підлітків київ, карате кіокушинкай підлітки київ"}
      />
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        isScrolled ? 'bg-black/95 backdrop-blur-xl h-[64px] border-b border-red-600/20 shadow-2xl shadow-black' : 'bg-transparent h-[80px]'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-red-600 flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform shadow-[0_0_20px_rgba(220,38,38,0.3)]">
              <span className="text-white font-black italic">B</span>
            </div>
            <span className="font-black tracking-tighter text-xl uppercase">Black Bear <span className="text-red-600">Dojo</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-[11px] font-bold uppercase tracking-[0.2em] hover:text-red-500 transition-colors">Головна</Link>
            <Button variant="primary" className="h-10 px-6 text-[10px]" onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>
              Записатись
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={content?.teen_hero_bg || "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=2000&auto=format&fit=crop"} 
            alt="Teen Karate" 
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
              Група 12+: Залишилось 4 вільних місця
            </div>
            <h1 
              className="text-6xl md:text-[130px] font-black uppercase leading-[0.8] tracking-tighter mb-10"
              dangerouslySetInnerHTML={{ __html: content?.teen_hero_title || 'Стань <br /> <span className="text-red-600 text-glow">найкращою</span> <br /> версією себе' }}
            />
            <p 
              className="text-xl md:text-2xl text-zinc-400 mb-12 leading-relaxed max-w-2xl font-medium"
              dangerouslySetInnerHTML={{ __html: content?.teen_hero_subtitle || 'Карате для підлітків — це не просто спорт. Це твоя перевага в житті, впевненість у будь-якій компанії та сталевий характер. <span className="text-white">Перше тренування — БЕЗКОШТОВНО.</span>' }}
            />
            <div className="flex flex-col sm:flex-row gap-6">
              <Button 
                className="shadow-[0_20px_50px_rgba(209,0,0,0.3)]"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Спробувати безкоштовно
              </Button>
              <Button variant="secondary" onClick={() => document.getElementById('pain-points')?.scrollIntoView({ behavior: 'smooth' })}>
                Дізнатись більше
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section id="pain-points" className="py-32 bg-zinc-950 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-20">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Твої виклики</h2>
            <h3 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none">
              Час стати <br /> <span className="text-zinc-700">сильнішим</span>
            </h3>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {painPoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-10 bg-zinc-900/30 rounded-[2.5rem] border border-white/5 hover:border-red-600/40 transition-all duration-500 group"
              >
                <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center mb-8 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  {point.icon}
                </div>
                <h3 className="text-2xl font-black mb-4 uppercase tracking-tighter">{point.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">{point.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20 text-center"
          >
            <Button 
              className="mx-auto"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Записатись на перше тренування
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Unique Advantages Section */}
      <section className="py-32 bg-black relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-6 border border-red-600/20 rounded-[4rem] -rotate-2" />
              <div className="absolute -inset-6 border border-zinc-800 rounded-[4rem] rotate-1" />
              <img 
                src={content?.teen_advantages_image || "https://images.unsplash.com/photo-1552072805-2a9039d00e57?q=80&w=1000&auto=format&fit=crop"} 
                alt="Teen Training" 
                className="relative rounded-[3.5rem] grayscale hover:grayscale-0 transition-all duration-1000 shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-12 -right-12 bg-red-600 p-8 rounded-[2rem] shadow-2xl hidden md:block">
                <div className="text-4xl font-black text-white leading-none mb-1">100%</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/80">Результат</div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Твої переваги</h2>
              <h3 className="text-4xl md:text-7xl font-black uppercase tracking-tighter mb-10 leading-[0.9]">
                Більше ніж <br /> просто <span className="text-red-600">хобі</span>
              </h3>
              
              <div className="space-y-10">
                {advantages.map((adv, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-6 group"
                  >
                    <div className="shrink-0 w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-red-600 border border-white/5 group-hover:border-red-600/50 transition-colors">
                      {adv.icon}
                    </div>
                    <div>
                      <h4 className="text-xl font-black uppercase tracking-tight mb-2">{adv.title}</h4>
                      <p className="text-zinc-500 text-sm leading-relaxed max-w-md font-medium">{adv.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privileges Section */}
      <section className="py-32 bg-zinc-900/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Привілеї клубу</h2>
            <h3 className="text-4xl md:text-7xl font-black uppercase tracking-tighter">Більше ніж <span className="text-zinc-700">тренування</span></h3>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {privileges.map((priv, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 bg-black/40 rounded-[2rem] border border-white/5 hover:border-red-600/30 transition-all group"
              >
                <div className="w-12 h-12 bg-red-600/10 rounded-xl flex items-center justify-center mb-6 text-red-600 group-hover:scale-110 transition-transform">
                  <Zap size={24} />
                </div>
                <h4 className="text-xl font-black uppercase tracking-tight mb-3">{priv.title}</h4>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">{priv.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works / Steps */}
      <section className="py-32 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Твій шлях</h2>
            <h3 className="text-4xl md:text-7xl font-black uppercase tracking-tighter">Як стати <span className="text-zinc-700">майстром</span></h3>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {steps.map((step, i) => (
              <div key={i} className="relative group">
                <div className="text-8xl font-black text-zinc-900 absolute -top-10 -left-4 group-hover:text-red-600/10 transition-colors duration-500">
                  {step.num}
                </div>
                <div className="relative z-10 pt-4">
                  <h4 className="text-2xl font-black uppercase tracking-tighter mb-4 group-hover:text-red-600 transition-colors">{step.title}</h4>
                  <p className="text-zinc-500 text-sm leading-relaxed font-medium">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-16">Що ти отримаєш?</h2>
          
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { val: "100%", label: "Впевненість", desc: "Ти будеш знати, що можеш постояти за себе" },
              { val: "MAX", label: "Енергія", desc: "Замість втоми — заряд бадьорості на весь день" },
              { val: "∞", label: "Характер", desc: "Вміння долати будь-які труднощі в житті" }
            ].map((stat, i) => (
              <div key={i} className="space-y-4">
                <div className="text-7xl font-black text-red-600 tracking-tighter">{stat.val}</div>
                <div className="text-xl font-bold uppercase tracking-widest">{stat.label}</div>
                <p className="text-zinc-500 text-sm">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-24 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-zinc-900 p-12 rounded-[3rem] border border-white/5 relative">
            <Quote className="absolute top-8 right-8 text-red-600/20 w-24 h-24" />
            <div className="relative z-10">
              <div className="flex gap-1 mb-6">
                {[1,2,3,4,5].map(i => <Star key={i} size={16} className="fill-red-600 text-red-600" />)}
              </div>
              <p className="text-2xl md:text-3xl font-medium italic text-zinc-300 mb-8 leading-relaxed">
                "Я прийшов у 14 років, бо хотів навчитися захищатися. Зараз мені 17, у мене вже коричневий пояс і я виступаю на змаганнях. Карате змінило моє ставлення до життя та навчання."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden">
                  <img src="https://i.pravatar.cc/100?img=33" alt="Student" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <div className="font-bold text-white uppercase tracking-widest text-xs">Дмитро, 17 років</div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest">Старша група</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <ContactForm 
        locations={locations}
        title="Запишись на пробне"
        subtitle="Перше тренування безкоштовне. Приходь та відчуй силу Кіокушинкай."
        ageGroups={[
          { value: "12+ років", label: "Старша група (12+ років)" },
          { value: "Індивідуально", label: "Індивідуальні тренування" }
        ]}
        source="teen_landing"
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
            © 2024 Black Bear Dojo. Всі права захищені.
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
          Записатись на пробне
        </motion.button>
      </div>
    </div>
  );
};
