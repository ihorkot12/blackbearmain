import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Navbar } from './components/Navbar';
import { 
  Shield, 
  Trophy, 
  Users, 
  Clock, 
  MapPin, 
  Award,
  ChevronRight, 
  Star, 
  CheckCircle2,
  Instagram,
  Facebook,
  Send,
  Quote,
  Heart,
  Zap,
  Target,
  Smile,
  Sword,
  Medal,
  Dumbbell,
  Brain
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from './components/SEO';
import { ContactForm } from './components/ContactForm';

const Button = ({ children, variant = 'primary', className = '', showIcon = true, ...props }: any) => {
  const variants = {
    primary: 'bg-gradient-to-b from-[#D10000] to-[#A80000] text-white shadow-[0_8px_24px_rgba(209,0,0,0.35)] hover:shadow-[0_12px_28px_rgba(209,0,0,0.45)] active:shadow-[0_4px_12px_rgba(209,0,0,0.4)]',
    secondary: 'bg-transparent border-2 border-white/20 text-white hover:bg-white/10 hover:border-white',
    gold: 'bg-amber-500 hover:bg-amber-600 text-black',
  };
  
  const baseStyles = "h-[58px] px-10 rounded-[18px] font-bold uppercase tracking-[0.05em] transition-all duration-300 flex items-center justify-center gap-3";
  const hoverStyles = variant === 'primary' ? "hover:translate-y-[-2px]" : "hover:translate-y-[-1px]";
  const activeStyles = "active:translate-y-[1px]";

  return (
    <button 
      className={`${baseStyles} ${hoverStyles} ${activeStyles} ${variants[variant as keyof typeof variants]} ${className}`}
      {...props}
    >
      <span>{children}</span>
      {variant === 'primary' && showIcon && <ChevronRight size={18} className="shrink-0" />}
    </button>
  );
};

export const JuniorLanding = () => {
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

  const painPoints = [
    {
      icon: <Zap className="text-red-500" size={32} />,
      title: "Залежність від гаджетів",
      desc: "Дитина проводить весь вільний час у телефоні? Ми замінимо віртуальні перемоги на реальні досягнення в залі."
    },
    {
      icon: <Shield className="text-red-500" size={32} />,
      title: "Булінг та самозахист",
      desc: "Хвилюєтесь, чи зможе дитина постояти за себе? Ми вчимо не тільки техніці, а й впевненості, яка зупиняє конфлікти."
    },
    {
      icon: <Target className="text-red-500" size={32} />,
      title: "Відсутність дисципліни",
      desc: "Важко привчити до порядку та відповідальності? Карате формує внутрішній стержень та повагу до правил."
    },
    {
      icon: <Dumbbell className="text-red-500" size={32} />,
      title: "Малорухливий спосіб життя",
      desc: "Погана постава та слабкі м'язи через школу? Регулярні тренування зроблять тіло міцним та витривалим."
    }
  ];

  const advantages = [
    {
      title: "Міжнародна сертифікація",
      desc: "Ми входимо до складу WKO ShinKyokushinkai. Кожен пояс вашої дитини визнається у 100+ країнах світу.",
      icon: <Shield size={24} />
    },
    {
      title: "Дисципліна без примусу",
      desc: "Через етикет карате ми вчимо дитину поважати час, працю та оточуючих. Це переноситься на навчання в школі.",
      icon: <Brain size={24} />
    },
    {
      title: "Спортивна кар'єра",
      desc: "Регулярні чемпіонати міста, області та України. Ми готуємо справжніх атлетів та чемпіонів.",
      icon: <Trophy size={24} />
    },
    {
      title: "Команда однодумців",
      desc: "Дитина потрапляє в середовище, де модно бути сильним, здоровим та успішним, а не сидіти в гаджетах.",
      icon: <Users size={24} />
    }
  ];

  const privileges = [
    { title: "Програма лояльності", desc: "Знижки для постійних учнів та багатодітних родин." },
    { title: "Атестаційні збори", desc: "Можливість здавати на пояси майстрам міжнародного класу." },
    { title: "Спортивні табори", desc: "Зимові та літні збори в Карпатах та на морі." },
    { title: "Семінари з майстрами", desc: "Майстер-класи від чемпіонів світу та Європи." }
  ];

  const steps = [
    { num: "01", title: "Пробна зустріч", desc: "Запишіться на перше безкоштовне заняття. Тренер оцінить рівень підготовки дитини." },
    { num: "02", title: "Вступ до Додзьо", desc: "Ознайомлення з правилами та етикетом. Отримання першого тренувального плану." },
    { num: "03", title: "Системні тренування", desc: "Розвиток сили, гнучкості та техніки. Підготовка до першої атестації." },
    { num: "04", title: "Шлях майстра", desc: "Участь у змаганнях, семінарах та літніх зборах для професійного росту." }
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-600 selection:text-white">
      <SEO 
        title={content?.junior_seo_title || "Карате для дітей 7-12 років Київ | Секція карате Шулявка"}
        description={content?.junior_seo_description || "Секція карате для дітей 7-12 років у Києві. Формування характеру, фізична підготовка та підготовка до змагань. Найкраще дитяче карате Київ (Шулявка, Відрадний, Сирець). Перше тренування безкоштовно!"}
        keywords={content?.junior_seo_keywords || "карате для дітей 7 років київ, карате для дітей 8 років київ, карате для дітей 10 років київ, дитяча секція карате київ, карате на шулявці для дітей, карате сирець"}
      />
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={content?.junior_hero_bg || "https://images.unsplash.com/photo-1552072805-2a9039d00e57?q=80&w=2000&auto=format&fit=crop"} 
            alt="Junior Karate" 
            className="w-full h-full object-cover opacity-30 grayscale scale-110"
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
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
              <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
              Група 7–12 років: Залишилось 2 вільних місця
            </div>
            <h1 
              className="text-5xl sm:text-6xl md:text-[120px] font-black uppercase leading-[0.9] md:leading-[0.85] tracking-tighter mb-10"
              dangerouslySetInnerHTML={{ __html: content?.junior_hero_title || 'Секція <br /> <span className="text-red-600">карате</span> <br /> для дітей' }}
            />
            <p 
              className="text-xl md:text-2xl text-zinc-400 mb-12 leading-relaxed max-w-2xl font-medium"
              dangerouslySetInnerHTML={{ __html: content?.junior_hero_subtitle || 'Професійні тренування з карате в Києві (Шулявка, Сирець, Відрадний). Допоможіть дитині знайти впевненість та стати частиною сильної спільноти. <span className="text-white">Перше тренування — БЕЗКОШТОВНО.</span>' }}
            />
            <div className="flex flex-col sm:flex-row gap-6">
              <Button 
                className="shadow-[0_20px_50px_rgba(209,0,0,0.3)]"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Записатись на пробне заняття
              </Button>
              <Button variant="secondary" onClick={() => document.getElementById('pain-points')?.scrollIntoView({ behavior: 'smooth' })}>
                Результати учнів
              </Button>
            </div>
          </motion.div>
        </div>

      </section>

      {/* Pain Points Section */}
      <section id="pain-points" className="py-16 md:py-32 bg-zinc-950 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-12 md:mb-20">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Виклики цього віку</h2>
            <h3 className="text-3xl sm:text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none">
              Час діяти <br /> <span className="text-zinc-700">разом</span>
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
                className="p-6 sm:p-10 bg-zinc-900/30 rounded-3xl lg:rounded-[2.5rem] border border-white/5 hover:border-red-600/40 transition-all duration-500 group"
              >
                <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center mb-8 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  {point.icon}
                </div>
                <h3 className="text-2xl font-black mb-4 uppercase tracking-tighter">{point.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">{point.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Privileges Section */}
      <section className="py-16 md:py-32 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12 md:mb-20">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Клубні привілеї</h2>
            <h3 className="text-3xl sm:text-4xl md:text-7xl font-black uppercase tracking-tighter">Більше ніж <span className="text-zinc-700">секція</span></h3>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {privileges.map((priv, i) => (
              <div key={i} className="p-8 bg-zinc-900 rounded-3xl border border-white/5 flex items-start gap-6">
                <div className="w-12 h-12 bg-red-600/10 rounded-full flex items-center justify-center shrink-0">
                  <Star className="text-red-600" size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-black uppercase tracking-tight mb-2">{priv.title}</h4>
                  <p className="text-zinc-500 font-medium">{priv.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works / Steps */}
      <section className="py-16 md:py-32 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12 md:mb-20">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.4em] mb-6">Шлях до результату</h2>
            <h3 className="text-3xl sm:text-4xl md:text-7xl font-black uppercase tracking-tighter">Як ми <span className="text-zinc-700">навчаємо</span></h3>
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
      <section className="py-16 md:py-24 bg-black">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black uppercase tracking-tighter mb-12 md:mb-16">Результати тренувань</h2>
          
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { val: "100%", label: "Впевненість", desc: "Дитина вміє захистити себе та свої кордони" },
              { val: "10/10", label: "Здоров'я", desc: "Міцний імунітет та атлетична статура" },
              { val: "∞", label: "Дисципліна", desc: "Відповідальне ставлення до навчання та життя" }
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

      {/* Locations Section */}
      <section className="py-16 md:py-24 bg-black">
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

      {/* Testimonial Section */}
      <section className="py-16 md:py-24 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-zinc-900 p-8 md:p-12 rounded-3xl lg:rounded-[3rem] border border-white/5 relative">
            <Quote className="absolute top-8 right-8 text-red-600/20 w-24 h-24" />
            <div className="relative z-10">
              <div className="flex gap-1 mb-6">
                {[1,2,3,4,5].map(i => <Star key={i} size={16} className="fill-red-600 text-red-600" />)}
              </div>
              <p className="text-2xl md:text-3xl font-medium italic text-zinc-300 mb-8 leading-relaxed">
                "Син займається вже 3 роки. З сором'язливого хлопчика він перетворився на впевненого підлітка, який має мету — чорний пояс. Дякую тренерам за такий вклад у дитину!"
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden">
                  <img src="https://i.pravatar.cc/100?img=12" alt="Parent" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <div className="font-bold text-white uppercase tracking-widest text-xs">Олексій, тато Максима</div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest">Середня група</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <ContactForm 
        locations={locations}
        title="Записати дитину на пробне"
        subtitle="Зробіть перший крок до чемпіонства вашої дитини вже сьогодні."
        ageGroups={[
          { value: "7-12 років", label: "Середня група (7–12 років)" },
          { value: "Індивідуально", label: "Індивідуальні тренування" }
        ]}
        source="junior_landing"
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
          Записатись на пробне
        </motion.button>
      </div>
    </div>
  );
};
