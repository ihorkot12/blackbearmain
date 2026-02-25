/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Trophy, 
  Users, 
  Clock, 
  MapPin, 
  ChevronRight, 
  Menu, 
  X, 
  Star, 
  CheckCircle2,
  Instagram,
  Facebook,
  Send
} from 'lucide-react';

// --- Components ---

const ThankYouPage = ({ onBack }: { onBack: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-6"
  >
    <div className="max-w-xl w-full text-center space-y-8">
      <div className="relative inline-block">
        <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(209,0,0,0.5)]">
          <CheckCircle2 size={48} className="text-white" />
        </div>
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 bg-red-600 rounded-full -z-10"
        />
      </div>
      
      <div className="space-y-4">
        <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Дякуємо за заявку!</h2>
        <p className="text-zinc-400 text-lg">
          Ми отримали ваші дані. Наш адміністратор зателефонує вам протягом <span className="text-white font-bold">15 хвилин</span> для підтвердження запису на пробне заняття.
        </p>
      </div>

      <div className="pt-8">
        <Button variant="secondary" onClick={onBack} showIcon={false}>
          Повернутись на головну
        </Button>
      </div>

      <div className="pt-12 flex items-center justify-center gap-8 text-zinc-600">
        <div className="flex flex-col items-center gap-2">
          <Instagram size={24} />
          <span className="text-[10px] uppercase font-bold tracking-widest">Instagram</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Send size={24} />
          <span className="text-[10px] uppercase font-bold tracking-widest">Telegram</span>
        </div>
      </div>
    </div>
  </motion.div>
);

const BrandLogo = ({ size = 'md', showKanji = false, align = 'center' }: { size?: 'sm' | 'md' | 'lg', showKanji?: boolean, align?: 'start' | 'center' }) => {
  const sizes = {
    sm: { text: 'text-base md:text-lg', b: 'w-6 h-6 text-xs', spacing: 'gap-2', kanji: 'text-[7px]', line: 'h-[1.5px]' },
    md: { text: 'text-xl', b: 'w-8 h-8 text-sm', spacing: 'gap-3', kanji: 'text-[9px]', line: 'h-[2px]' },
    lg: { text: 'text-3xl md:text-5xl', b: 'w-10 h-10 md:w-16 md:h-16 text-lg md:text-2xl', spacing: 'gap-4 md:gap-6', kanji: 'text-[10px] md:text-sm', line: 'h-[2px] md:h-[4px]' },
  };
  const s = sizes[size];

  return (
    <div className={`flex flex-col ${align === 'center' ? 'items-center' : 'items-start'} ${size === 'lg' ? 'mb-10' : ''}`}>
      <div className={`flex items-center ${s.spacing} font-brand uppercase`}>
        {/* Skewed B Icon */}
        <div className={`${s.b} bg-[#D10000] rounded-[2px] flex items-center justify-center shadow-[0_0_20px_rgba(209,0,0,0.5)] transform -skew-x-[18deg] shrink-0 border border-white/10`}>
          <span className="text-white transform skew-x-[18deg] font-black italic tracking-tighter">B</span>
        </div>
        
        {/* Text Part */}
        <div className={`${s.text} flex items-center gap-4 whitespace-nowrap font-black tracking-tighter`}>
          <div className="flex flex-col items-start">
            <span className="text-white leading-none">Black Bear</span>
            <div className={`w-full ${s.line} bg-[#FFB800] mt-2 shadow-[0_0_10px_rgba(255,184,0,0.5)]`} />
          </div>
          
          <div className="flex items-center text-[#D10000] leading-none drop-shadow-[0_0_12px_rgba(209,0,0,0.4)]">
            <span className="font-bold">D</span>
            <div className="w-[0.72em] h-[0.72em] bg-[#D10000] rounded-full mx-[0.06em] shadow-[0_0_15px_rgba(209,0,0,0.7)]" />
            <span>J</span>
            <div className="w-[0.72em] h-[0.72em] bg-[#D10000] rounded-full mx-[0.06em] shadow-[0_0_15px_rgba(209,0,0,0.7)]" />
          </div>
        </div>
      </div>
      
      {showKanji && (
        <div className={`${s.kanji} text-zinc-500 font-medium tracking-[1.5em] mt-6 uppercase opacity-50 select-none`}>
          極 真 空 手
        </div>
      )}
    </div>
  );
};

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

const SectionTitle = ({ title, subtitle, light = false }: { title: string, subtitle?: string, light?: boolean }) => (
  <div className="mb-8 text-center">
    <motion.h2 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`text-3xl md:text-4xl font-bold mb-2 tracking-tight ${light ? 'text-white' : 'text-zinc-900'}`}
    >
      {title}
    </motion.h2>
    {subtitle && (
      <motion.p 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className={`text-base max-w-2xl mx-auto ${light ? 'text-zinc-400' : 'text-zinc-600'}`}
      >
        {subtitle}
      </motion.p>
    )}
    <div className="w-16 h-1 bg-red-600 mx-auto mt-4" />
  </div>
);

// --- Main App ---

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [activeHash, setActiveHash] = React.useState(typeof window !== 'undefined' ? window.location.hash : '');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Conversion Tracking (Mock)
    console.log('Conversion Event: Lead Generated');
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        'send_to': 'AW-CONVERSION_ID/LABEL',
        'value': 1.0,
        'currency': 'UAH'
      });
    }

    setIsSubmitting(false);
    setIsSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    const handleHashChange = () => {
      setActiveHash(window.location.hash);
    };
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navLinks = [
    { name: 'Про клуб', href: '#about' },
    { name: 'Напрями', href: '#directions' },
    { name: 'Тренери', href: '#coach' },
    { name: 'Розклад', href: '#schedule' },
    { name: 'Контакти', href: '#contact' },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-600 selection:text-white">
      
      <AnimatePresence>
        {isSubmitted && <ThankYouPage onBack={() => setIsSubmitted(false)} />}
      </AnimatePresence>
      {/* Sticky CTA for Mobile */}
      <div className="fixed bottom-6 left-6 right-6 z-50 md:hidden">
        <Button variant="primary" className="w-full shadow-2xl" onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>
          Записатись
        </Button>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        isScrolled 
          ? 'bg-black/95 backdrop-blur-xl h-[64px] border-b border-amber-500/30 shadow-2xl shadow-black' 
          : 'bg-gradient-to-r from-[#0F0F0F] to-[#1A0000] backdrop-blur-md h-[72px] border-b border-amber-500/10'
      }`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-full flex items-center justify-between">
          <div className="flex items-center shrink-0">
            <BrandLogo size="sm" align="start" />
          </div>

          {/* Desktop Nav */}
            <div className="hidden md:flex items-center lg:gap-10 md:gap-6">
              {navLinks.map((link) => {
                const isActive = activeHash === link.href;
                return (
                  <a 
                    key={link.name} 
                    href={link.href} 
                    className={`relative text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-300 group ${
                      isActive ? 'text-red-500' : 'text-[#EAEAEA] hover:text-red-500'
                    }`}
                  >
                    {link.name}
                    <span className={`absolute -bottom-1 left-0 h-[1px] bg-red-600 transition-all duration-300 ${
                      isActive ? 'w-full' : 'w-0 group-hover:w-full'
                    }`} />
                  </a>
                );
              })}
              <Button variant="primary" className="h-[48px] px-8 text-[11px] shadow-[0_8px_24px_rgba(196,0,0,0.35)] hover:translate-y-[-2px] hover:shadow-[0_12px_28px_rgba(196,0,0,0.45)]">
                Записатись
              </Button>
            </div>

          {/* Mobile Toggle */}
          <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black pt-24 px-6 md:hidden"
          >
              <div className="flex flex-col gap-6 text-center">
                {navLinks.map((link) => (
                  <a 
                    key={link.name} 
                    href={link.href} 
                    onClick={() => setIsMenuOpen(false)}
                    className="text-2xl font-bold text-white"
                  >
                    {link.name}
                  </a>
                ))}
                <Button variant="primary">Записатися на пробне</Button>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden snap-start pt-24">
        {/* Background Image with Deep Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=1920&auto=format&fit=crop" 
            alt="Kyokushin Karate Training Kyiv" 
            className="w-full h-full object-cover opacity-30 grayscale scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />
        </div>

        {/* Decorative Japanese Kanji (Kyokushin) */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-[0.03] select-none pointer-events-none hidden lg:block">
          <span className="text-[40vh] font-serif leading-none">極真</span>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <BrandLogo size="lg" showKanji />
            
            <h1 className="text-xl md:text-2xl font-bold mb-4 tracking-tight uppercase text-red-600">
              Карате Київ <span className="text-white/50 block md:inline md:ml-2">м. Шулявська • Дитяче карате Київ • Секція карате Київ</span>
            </h1>

            <div className="text-3xl md:text-6xl font-black mb-6 tracking-tighter leading-none uppercase">
              <span className="bg-gradient-to-r from-white via-white to-zinc-500 bg-clip-text text-transparent">Формуємо дисципліну,</span><br />
              <span className="text-red-600 tracking-tight">силу та впевненість.</span>
            </div>
            
            <p className="text-base md:text-lg text-zinc-300 max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
              Професійна секція карате Київ під керівництвом 3 дану. <br className="hidden md:block" />
              20+ років досвіду. Дитяче карате Київ для майбутніх чемпіонів України та Європи.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-8">
              <Button variant="primary" className="w-full sm:w-auto">
                Записатися на пробне
              </Button>
              <Button variant="secondary" className="w-full sm:w-auto" showIcon={false} onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>
                Задати питання тренеру
              </Button>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-16">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-red-600" />
                <span>500+ учнів пройшли школу</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-red-600" />
                <span>Регулярні міжнародні турніри</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-red-600" />
                <span>Малочисельні групи</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-zinc-500"
        >
          <div className="w-6 h-10 border-2 border-zinc-700 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-red-600 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Transformation Section (Dark Professional Style) */}
      <section className="min-h-screen py-12 flex items-center bg-black relative overflow-hidden snap-start">
        {/* Subtle Background Accents */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-black uppercase mb-4 tracking-tight">Як дитяче карате змінює дитину</h2>
              <p className="text-zinc-500 text-base md:text-lg max-w-2xl mx-auto font-medium">
                Наша секція карате Київ допомагає батькам виховувати сильних особистостей. <br />
                <span className="text-red-500/80">Ми перетворюємо слабкість на силу.</span>
              </p>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Side - Problems */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-zinc-900/40 backdrop-blur-sm p-8 md:p-12 rounded-[2.5rem] border border-white/5 relative group hover:border-red-600/20 transition-all duration-500"
            >
              <div className="absolute top-0 left-10 w-20 h-[2px] bg-zinc-700 group-hover:bg-red-600 transition-colors duration-500" />
              <h3 className="text-xl md:text-2xl font-black uppercase mb-8 text-zinc-300 flex items-center gap-4">
                Ваша дитина:
              </h3>
              <ul className="space-y-6">
                {[
                  'Невпевнена у власних силах?',
                  'Багато часу проводить у телефоні?',
                  'Потребує дисципліни та фізичного розвитку?',
                  'Має труднощі у спілкуванні з однолітками?'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-base text-zinc-500 group-hover:text-zinc-400 transition-colors">
                    <div className="w-5 h-5 rounded-full border border-red-600/30 flex items-center justify-center shrink-0 mt-1">
                      <X size={12} className="text-red-600/50" />
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Right Side - Results */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-zinc-900/80 backdrop-blur-sm p-8 md:p-12 rounded-[2.5rem] border border-red-600/10 relative group hover:border-red-600/30 transition-all duration-500 shadow-2xl shadow-red-600/5"
            >
              <div className="absolute top-0 left-10 w-20 h-[2px] bg-red-600" />
              <h3 className="text-xl md:text-2xl font-black uppercase mb-8 text-white flex items-center gap-4">
                Через 3 місяці тренувань:
              </h3>
              <ul className="space-y-6">
                {[
                  'Покращується самодисципліна та фокус',
                  'Зростає впевненість у собі та своїх діях',
                  'Підвищується фізична витривалість та імунітет',
                  'З’являється повага до старших та однолітків'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-base md:text-lg font-bold text-white">
                    <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-red-600/40">
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <div className="mt-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Button variant="primary" className="mx-auto mb-6 h-[52px]">
                Записати дитину на пробне
              </Button>
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-red-600" />
                  <span>500+ дітей пройшли школу</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-red-600" />
                  <span>20 років досвіду</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works & What you need Section */}
      <section className="min-h-screen py-12 flex items-center bg-black snap-start">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Steps */}
            <div>
              <h2 className="text-2xl font-black uppercase mb-8 tracking-tight">Як проходить перше тренування</h2>
              <div className="space-y-4">
                {[
                  { step: '1', title: 'Запис', desc: 'Залишаєте заявку на сайті або за телефоном.' },
                  { step: '2', title: 'Приходите без форми', desc: 'На перше заняття купувати кімоно не потрібно.' },
                  { step: '3', title: 'Знайомство', desc: 'Тренер знайомиться з дитиною та батьками.' },
                  { step: '4', title: 'Тестове заняття', desc: 'Дитина пробує себе в групі під наглядом.' },
                  { step: '5', title: 'Рекомендація', desc: 'Тренер рекомендує групу за рівнем підготовки.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shrink-0">{item.step}</div>
                    <div>
                      <h4 className="font-bold text-sm uppercase">{item.title}</h4>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-zinc-900/80 p-8 rounded-[2rem] border border-red-600/10 flex flex-col justify-center">
              <h2 className="text-2xl font-black uppercase mb-8 tracking-tight">Що потрібно для старту</h2>
              <ul className="space-y-6">
                {[
                  'Форма не потрібна на перше заняття',
                  'Зручний спортивний одяг (футболка, штани)',
                  '60 хвилин вільного часу',
                  'Бажання дитини спробувати нове'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-lg font-bold text-white">
                    <CheckCircle2 size={24} className="text-red-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button variant="primary" className="mt-10" onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>
                Записатись на пробне
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="min-h-screen py-12 flex items-center bg-zinc-950 border-y border-white/5 snap-start">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.2em] mb-2">Клуб карате Black Bear Dojo Київ</h2>
              <h2 className="text-3xl font-bold mb-4 uppercase tracking-tight">Більше, ніж просто спорт</h2>
              <p className="text-zinc-400 text-base mb-4 leading-relaxed">
                Black Bear Dojo — це спортивна система підготовки, яка формує дисципліну, силу та конкурентоспроможність на татамі і поза ним. Ми не просто вчимо битися — ми виховуємо особистість через філософію кіокушинкай.
              </p>
              <p className="text-zinc-400 text-base mb-6 leading-relaxed">
                Наш підхід базується на трьох стовпах: фізична міць, ментальна стійкість та повага до оточуючих.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-900 rounded-xl border border-white/5">
                  <div className="text-2xl font-bold text-red-600 mb-1">20+</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Років досвіду</div>
                </div>
                <div className="p-3 bg-zinc-900 rounded-xl border border-white/5">
                  <div className="text-2xl font-bold text-red-600 mb-1">500+</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Учнів пройшли шлях</div>
                </div>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            >
              <img 
                src="https://images.unsplash.com/photo-1509011553436-198a69499b5e?q=80&w=800&auto=format&fit=crop" 
                alt="Dojo Atmosphere" 
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-red-600/10 mix-blend-overlay" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Directions Section */}
      <section id="directions" className="min-h-screen py-12 flex items-center bg-black snap-start">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle 
            title="Секція карате для дітей у Києві" 
            subtitle="Ми розробили спеціальні програми для кожної вікової категорії з чіткими результатами"
            light
          />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { age: '4–7 років', title: 'Перші кроки', desc: 'Розвиток координації, ігрова форма, база дисципліни.', result: 'Координація' },
              { age: '7–12 років', title: 'Формування', desc: 'Техніка, фізична підготовка, перші змагання.', result: 'База сили' },
              { age: 'Підлітки', title: 'Впевненість', desc: 'Професійні турніри, самооборона та лідерство.', result: 'Лідерство' },
              { age: 'Дорослі', title: 'Шлях воїна', desc: 'Зняття стресу, ідеальна форма та бойове мистецтво.', result: 'Стресостійкість' },
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group p-6 bg-zinc-900 rounded-2xl border border-white/5 hover:border-red-600/50 transition-all duration-500 flex flex-col h-full"
              >
                <div className="text-red-600 font-bold text-[10px] uppercase tracking-widest mb-2">{item.age}</div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-red-500 transition-colors">{item.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed mb-4 flex-grow">{item.desc}</p>
                <div className="pt-3 border-t border-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                  Результат: <span className="text-white">{item.result}</span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Button variant="primary" className="mx-auto">
              Записати дитину на пробне
            </Button>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="min-h-screen py-12 flex items-center bg-zinc-950 border-y border-white/5 snap-start">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle title="Наші результати" subtitle="Елітний рівень підготовки підтверджений фактами та нагородами" light />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Досвіду', value: '20+', sub: 'років у спорті' },
              { label: 'Учнів', value: '500+', sub: 'пройшли школу' },
              { label: 'Чемпіонів', value: 'UA/EU', sub: 'серед вихованців' },
              { label: 'Турнірів', value: 'INTL', sub: 'міжнародний рівень' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-6 bg-zinc-900 rounded-[2rem] border border-white/5">
                <div className="text-4xl font-black text-red-600 mb-1">{stat.value}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1">{stat.label}</div>
                <div className="text-[9px] uppercase tracking-widest text-zinc-500">{stat.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              'https://images.unsplash.com/photo-1578267153699-8958577e2d58?q=80&w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1564415315949-7a0c4c73aab4?q=80&w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1622599511051-16f55a123326?q=80&w=800&auto=format&fit=crop'
            ].map((img, i) => (
              <div key={i} className="aspect-video rounded-2xl overflow-hidden border border-white/10 grayscale hover:grayscale-0 transition-all duration-500">
                <img src={img} alt="Competition Results" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us Section */}
      <section className="min-h-screen py-12 flex items-center bg-black snap-start">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle 
            title="Чому обирають Black Bear Dojo" 
            subtitle="Карате для дітей Шулявка / Солом’янський район — системна модель успіху вашої дитини"
            light
          />
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { title: 'Реальні чемпіони', desc: 'Виховуємо переможців національних та європейських першостей.', icon: Trophy },
              { title: 'Професійний склад', desc: 'Тренери з 3 даном та 20-річним досвідом діяльності.', icon: Star },
              { title: 'Системна модель', desc: 'Поєднання класичної школи та сучасних методик розвитку.', icon: Shield },
            ].map((item, idx) => (
              <div key={idx} className="p-8 bg-zinc-900 rounded-[2rem] border border-red-600/20 hover:border-red-600 transition-all duration-500">
                <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white mb-6 shadow-lg shadow-red-600/20">
                  <item.icon size={24} />
                </div>
                <h3 className="text-xl font-black mb-3 uppercase tracking-tight">{item.title}</h3>
                <p className="text-zinc-400 leading-relaxed text-base">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {[
              { title: 'Контроль дисципліни', desc: 'Чіткі правила поведінки.' },
              { title: 'Фокус на безпеці', desc: 'Контрольоване середовище.' },
              { title: 'Спортивні табори', desc: 'Виїзні інтенсиви в горах.' },
            ].map((item, idx) => (
              <div key={idx} className="p-4 bg-zinc-900/50 rounded-xl border border-white/5 flex items-center gap-3">
                <CheckCircle2 className="text-red-600 shrink-0" size={16} />
                <div>
                  <h4 className="font-bold text-[10px] uppercase">{item.title}</h4>
                  <p className="text-[9px] text-zinc-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coaches Section */}
      <section id="coach" className="min-h-screen py-12 flex items-center bg-zinc-950 snap-start">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle 
            title="Наші Тренери" 
            subtitle="Професіонали, які передають досвід та формують нове покоління чемпіонів"
            light
          />
          
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Coach 1: Ihor Kotliarevskyi */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-white/5 flex flex-col md:flex-row group"
            >
              <div className="relative w-full md:w-1/2 h-[400px] md:h-auto overflow-hidden">
                <img 
                  src="https://ais-dev-52dzs75wldpn6rggyas75b-286910022589.europe-west2.run.app/api/image/step-77" 
                  alt="Ігор Котляревський" 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-zinc-900" />
              </div>
              
              <div className="p-8 md:w-1/2 flex flex-col justify-center space-y-6">
                <div>
                  <span className="bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block shadow-lg shadow-red-600/20">Засновник клубу</span>
                  <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">Ігор <br />Котляревський</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="text-red-500 font-bold text-[10px] uppercase tracking-widest">Звання та досягнення</div>
                  <ul className="grid grid-cols-1 gap-y-2 text-zinc-300 text-sm">
                    <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-red-600" /> 3 дан карате Кіокушинкай</li>
                    <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-red-600" /> Майстер спорту України</li>
                    <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-red-600" /> Чемпіон України</li>
                    <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-red-600" /> Призер чемпіонатів Європи</li>
                  </ul>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <p className="text-zinc-400 italic text-sm leading-relaxed">
                    "Моя мета — не просто навчити битися, а сформувати характер, який допоможе дитині перемагати в житті."
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Coach 2: Oleh Kramarenko */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-white/5 flex flex-col md:flex-row-reverse group"
            >
              <div className="relative w-full md:w-1/2 h-[400px] md:h-auto overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=800&auto=format&fit=crop" 
                  alt="Олег Крамаренко" 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent md:bg-gradient-to-l md:from-transparent md:to-zinc-900" />
              </div>
              
              <div className="p-8 md:w-1/2 flex flex-col justify-center space-y-6">
                <div>
                  <span className="bg-zinc-700 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Провідний тренер</span>
                  <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">Олег <br />Крамаренко</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="text-red-500 font-bold text-[10px] uppercase tracking-widest">Звання та досягнення</div>
                  <ul className="grid grid-cols-1 gap-y-2 text-zinc-300 text-sm">
                    <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-red-600" /> Чемпіон Європи</li>
                    <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-red-600" /> Багаторазовий чемпіон України</li>
                    <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-red-600" /> Експерт з техніки куміте</li>
                    <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-red-600" /> 15+ років досвіду викладання</li>
                  </ul>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <p className="text-zinc-400 italic text-sm leading-relaxed">
                    "Кожне тренування — це перемога над собою. Ми вчимо дітей не здаватися перед труднощами."
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Schedule Section */}
      <section id="schedule" className="min-h-screen py-12 flex items-center bg-black snap-start">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle title="Розклад занять" light />
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-6 px-4 text-zinc-500 uppercase text-xs font-bold tracking-widest">Дні</th>
                  <th className="py-6 px-4 text-zinc-500 uppercase text-xs font-bold tracking-widest">Група</th>
                  <th className="py-6 px-4 text-zinc-500 uppercase text-xs font-bold tracking-widest">Час</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-4 px-4 font-bold text-lg">Пн, Ср, Пт</td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-base">Молодша група</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">4–12 років</div>
                  </td>
                  <td className="py-4 px-4 font-mono text-red-500 font-bold text-lg">18:15 – 19:15</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-bold text-lg">Пн, Ср, Пт</td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-base">Старша група</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Підлітки та дорослі</div>
                  </td>
                  <td className="py-4 px-4 font-mono text-red-500 font-bold text-lg">19:15 – 20:45</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="min-h-screen py-12 flex items-center bg-black snap-start">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle title="Відгуки батьків" subtitle="Що кажуть про нас ті, хто вже довірив нам своїх дітей" light />
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Олена', text: 'Син став набагато дисциплінованішим вже за перші два місяці. Дуже задоволені підходом тренера.' },
              { name: 'Андрій', text: 'Шукали секцію біля дому. Black Bear Dojo — це професійний рівень, який рідко зустрінеш.' },
              { name: 'Марина', text: 'Донька раніше була дуже сором’язливою. Зараз з радістю біжить на тренування і стала впевненішою.' },
            ].map((review, i) => (
              <div key={i} className="p-8 bg-zinc-900 rounded-[2rem] border border-white/5 italic text-zinc-400 leading-relaxed">
                "{review.text}"
                <div className="mt-6 not-italic font-bold text-white uppercase tracking-widest text-xs">— {review.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="min-h-screen py-12 flex items-center bg-black snap-start">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle title="Часті запитання (FAQ)" subtitle="Відповідаємо на головні питання батьків" light />
          
          <div className="max-w-3xl mx-auto space-y-2">
            {[
              { 
                q: 'Чи безпечні тренування для дитини 4–12 років?', 
                a: 'Так. Тренування проходять у вікових групах із поступовим навантаженням. Контактні елементи вводяться поетапно та під контролем тренера. Дисципліна в залі — обов’язкова умова. Пріоритет — техніка, координація, самоконтроль і правильна фізична база.' 
              },
              { 
                q: 'Чи підійде карате моїй дитині, якщо вона сором’язлива або фізично слабка?', 
                a: 'Так. Більшість дітей приходять без підготовки. Початковий етап спрямований на адаптацію, розвиток координації та впевненості. Через системні тренування поступово зростає витривалість, сила та внутрішня впевненість. Навчання будується від простого до складного.' 
              },
              { 
                q: 'Які результати дає карате через 3–6 місяців?', 
                a: 'За умови регулярних тренувань: покращується дисципліна та самоконтроль, зростає впевненість у собі, розвивається фізична витривалість, формується повага до старших та однолітків, зменшується залежність від гаджетів. Результат напряму залежить від системності відвідування.' 
              },
              { 
                q: 'Хто тренує дітей і який у вас досвід?', 
                a: 'Тренування проводить Ігор Котляревський — 3 дан кіокушинкай, майстер спорту України, призер чемпіонату Європи, абсолютний чемпіон України, з досвідом понад 20 років. У клубі підготовлені чемпіони та призери України й Європи. Методика поєднує класичну школу кіокушинкай і сучасну фізичну підготовку.' 
              },
              { 
                q: 'Скільки коштує навчання і що входить у абонемент?', 
                a: 'Абонемент включає: регулярні тренування у віковій групі, системну фізичну підготовку, технічну базу карате, підготовку до змагань (за рівнем готовності). Перше тренування — пробне. Необхідна базова форма для занять.' 
              },
            ].map((item, idx) => (
              <details key={idx} className="group bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
                <summary className="p-4 cursor-pointer flex items-center justify-between font-bold text-base list-none">
                  {item.q}
                  <ChevronRight className="group-open:rotate-90 transition-transform text-red-600" size={16} />
                </summary>
                <div className="px-4 pb-4 text-zinc-400 text-sm leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Local Block with Map */}
      <section className="min-h-screen py-12 flex items-center bg-zinc-950 border-y border-white/5 snap-start">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="text-left">
              <h2 className="text-2xl font-black mb-4 uppercase tracking-tight">Карате в Києві — Black Bear Dojo</h2>
              <p className="text-zinc-400 text-base mb-6 leading-relaxed">
                Зручна локація біля метро Шулявська. Системний розвиток вашої дитини в професійному середовищі.
              </p>
              <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest text-red-500">
                <span>карате Київ</span>
                <span>•</span>
                <span>кіокушинкай</span>
                <span>•</span>
                <span>секція для дітей</span>
              </div>
            </div>
            <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 flex items-center justify-center">
              <div className="text-center p-4">
                <MapPin size={32} className="text-red-600 mx-auto mb-2" />
                <p className="text-zinc-500 uppercase tracking-widest font-black text-[10px]">Google Maps Placeholder</p>
                <p className="text-[10px] text-zinc-600 mt-1">Київ, вул. Прикладна, 5</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact & Footer Section */}
      <section id="contact" className="min-h-screen flex flex-col bg-zinc-950 relative overflow-hidden snap-start">
        <div className="flex-grow flex items-center py-12">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-red-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4 uppercase leading-tight">Запишіть дитину в секцію карате Київ</h2>
                <p className="text-zinc-400 text-base mb-6">
                  Залиште заявку на дитяче карате Київ, і ми зателефонуємо вам для узгодження часу пробного заняття.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-red-600 border border-white/5">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Локація</div>
                      <div className="text-white text-sm font-medium">Київ, м. Шулявська (вул. Прикладна, 5)</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-red-600 border border-white/5">
                      <Send size={16} />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Telegram / Viber</div>
                      <div className="text-white text-sm font-medium">+38 (097) 123 45 67</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-2xl relative">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white font-black text-[10px] uppercase tracking-tighter rotate-12 shadow-xl">
                  Безкоштовно
                </div>
                <form className="space-y-4" onSubmit={handleFormSubmit}>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Ваше ім'я</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors text-xs"
                      placeholder="Олександр"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Телефон</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors text-xs"
                      placeholder="+38 (0__) ___ __ __"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Вік дитини</label>
                    <select className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors appearance-none text-xs">
                      <option>4–7 років</option>
                      <option>7–12 років</option>
                      <option>Підліток</option>
                    </select>
                  </div>
                  <Button 
                    variant="primary" 
                    className="w-full h-[52px]" 
                    showIcon={!isSubmitting}
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? 'Відправляємо...' : 'Записатися на пробне'}
                  </Button>
                  <div className="text-center space-y-1">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Ми зв’яжемось протягом 15 хвилин</p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-8 bg-black border-t border-white/5 w-full">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <BrandLogo size="sm" />
            
            <div className="flex items-center gap-6">
              <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Instagram size={20} /></a>
              <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Facebook size={20} /></a>
              <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Send size={20} /></a>
            </div>

            <div className="text-zinc-600 text-[10px] max-w-xs text-center md:text-right">
              Black Bear Dojo — найкраща секція карате Київ для дітей та дорослих. Професійне дитяче карате Київ на Шулявці. Тренування карате Київ за методикою Кіокушинкай.
              <div className="mt-2">© 2024 Black Bear Dojo. Всі права захищені.</div>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
