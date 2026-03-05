/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';

const LoginPage = lazy(() => import('./Admin').then(m => ({ default: m.LoginPage })));
const AdminPage = lazy(() => import('./Admin').then(m => ({ default: m.AdminPage })));

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
  Send,
  User
} from 'lucide-react';

declare global {
  interface Window {
    fbq: any;
  }
}

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

      <div className="pt-8 flex justify-center">
        <Button variant="secondary" onClick={onBack} showIcon={false}>
          Повернутись на головну
        </Button>
      </div>

      <div className="pt-12 flex items-center justify-center gap-8 text-zinc-600">
        <a href="https://instagram.com/karate_kyiv" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 hover:text-white transition-colors">
          <Instagram size={24} />
          <span className="text-[10px] uppercase font-bold tracking-widest">Instagram</span>
        </a>
      </div>
    </div>
  </motion.div>
);

const BrandLogo = ({ size = 'md', showKanji = false, align = 'center' }: { size?: 'sm' | 'md' | 'lg', showKanji?: boolean, align?: 'start' | 'center' }) => {
  const sizes = {
    sm: { text: 'text-[28px]', b: 'w-6 h-6 text-xs', spacing: 'gap-3', kanji: 'text-[7px]', line: 'h-[2px]' },
    md: { text: 'text-[36px]', b: 'w-8 h-8 text-sm', spacing: 'gap-4', kanji: 'text-[9px]', line: 'h-[2px]' },
    lg: { text: 'text-[42px] md:text-[56px]', b: 'w-10 h-10 md:w-14 md:h-14 text-lg md:text-2xl', spacing: 'gap-5 md:gap-6', kanji: 'text-[10px] md:text-sm', line: 'h-[2px]' },
  };
  const s = sizes[size];

  return (
    <div className={`flex flex-col ${align === 'center' ? 'items-center' : 'items-start'} ${size === 'lg' ? 'mb-10' : ''}`}>
      <div className={`flex items-center ${s.spacing} font-sans uppercase group cursor-pointer`}>
        {/* Skewed B Icon */}
        <div 
          className={`${s.b} bg-[#C10000] flex items-center justify-center shrink-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]`}
          style={{ clipPath: 'polygon(15% 0, 100% 0, 85% 100%, 0 100%)' }}
        >
          <span className="text-white font-black italic tracking-tighter">B</span>
        </div>
        
        {/* Text Part */}
        <div className={`${s.text} flex items-baseline gap-3 md:gap-4 whitespace-nowrap font-black tracking-tight leading-none`}>
          <div className="flex flex-col items-start relative pb-1">
            <span className="text-[#FFFFFF]">BLACK BEAR</span>
            <div className={`absolute bottom-0 left-0 w-full ${s.line} bg-gradient-to-r from-[#C8A400] to-[#E8C547]`} />
          </div>
          
          <div className="text-[#C10000] tracking-[0.06em] group-hover:drop-shadow-[0_0_10px_rgba(193,0,0,0.5)] transition-all duration-200" style={{ textShadow: '0 0 10px rgba(255,0,0,0.3)' }}>
            DOJO
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
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [activeHash, setActiveHash] = React.useState(typeof window !== 'undefined' ? window.location.hash : '');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [content, setContent] = useState<any>(null);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [activeLocation, setActiveLocation] = useState<'shulyavka' | 'nekrasova'>('shulyavka');

  React.useEffect(() => {
    fetch(`/api/content?t=${Date.now()}`)
      .then(res => res.json())
      .then(setContent);
    
    fetch(`/api/coaches?t=${Date.now()}`)
      .then(res => res.json())
      .then(setCoaches);
  }, []);

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
      event_id: eventId
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Failed to submit lead', err);
    } finally {
      setIsSubmitting(false);
    }

    // Conversion Tracking
    console.log('Conversion Event: Lead Generated');
    if (typeof window !== 'undefined') {
      // Google Ads (if configured)
      if ((window as any).gtag) {
        (window as any).gtag('event', 'conversion', {
          'send_to': 'AW-CONVERSION_ID/LABEL',
          'value': 1.0,
          'currency': 'UAH'
        });
      }
      // Meta Pixel
      if ((window as any).fbq) {
        (window as any).fbq('track', 'Lead', {
          content_name: 'Trial Lesson Signup',
          currency: 'UAH',
          value: 1.0
        }, { eventID: eventId });
      }
    }
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

  React.useEffect(() => {
    const injectScript = (code: string, id: string) => {
      if (!code || typeof code !== 'string') return [];
      
      const elements: HTMLElement[] = [];
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = code;
      
      const scripts = tempDiv.querySelectorAll('script');
      if (scripts.length > 0) {
        scripts.forEach((s, idx) => {
          const newScript = document.createElement('script');
          newScript.id = `${id}-script-${idx}`;
          if (s.src) {
            newScript.src = s.src;
            newScript.async = s.async;
          } else {
            newScript.innerHTML = s.innerHTML;
          }
          document.head.appendChild(newScript);
          elements.push(newScript);
        });
      } else if (code.trim().length > 0) {
        // If no script tags found, but there is content
        // Check if it looks like HTML (contains tags)
        if (tempDiv.children.length === 0) {
          // It's just text/comments, assume it's raw JS
          const script = document.createElement('script');
          script.id = id;
          script.innerHTML = code;
          document.head.appendChild(script);
          elements.push(script);
        }
      }
      
      // Handle noscript tags separately
      const noscripts = tempDiv.querySelectorAll('noscript');
      noscripts.forEach((ns, idx) => {
        const newNoScript = document.createElement('noscript');
        newNoScript.id = `${id}-noscript-${idx}`;
        newNoScript.innerHTML = ns.innerHTML;
        document.body.appendChild(newNoScript);
        elements.push(newNoScript);
      });

      return elements;
    };

    const googleElements = injectScript(content?.google_pixel_code, 'google-pixel');
    const metaElements = injectScript(content?.meta_pixel_code, 'meta-pixel');

    return () => {
      [...googleElements, ...metaElements].forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
    };
  }, [content?.google_pixel_code, content?.meta_pixel_code]);

  const navLinks = [
    { name: 'Про клуб', href: '#about' },
    { name: 'Напрями', href: '#directions' },
    { name: 'Тренери', href: '#coach' },
    { name: 'Розклад', href: '#schedule' },
    { name: 'Контакти', href: '#contact' },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-600 selection:text-white scroll-smooth">
      
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
          <div 
            className="flex items-center shrink-0 cursor-pointer" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
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
              <Link to="/login" className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#EAEAEA] hover:text-red-500 transition-all duration-300 flex items-center gap-2">
                <User size={14} />
                Вхід
              </Link>
              <Button 
                id="cta-button-header"
                variant="primary" 
                className="h-[48px] px-8 text-[11px] shadow-[0_8px_24px_rgba(196,0,0,0.35)] hover:translate-y-[-2px] hover:shadow-[0_12px_28px_rgba(196,0,0,0.45)]" 
                onClick={() => {
                  if (window.fbq) window.fbq('track', 'Lead');
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
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
                <Link 
                  to="/login" 
                  onClick={() => setIsMenuOpen(false)}
                  className="text-2xl font-bold text-red-500"
                >
                  Вхід до CRM
                </Link>
                <Button 
                  id="cta-button-mobile"
                  variant="primary" 
                  onClick={() => { 
                    if (window.fbq) window.fbq('track', 'Lead');
                    setIsMenuOpen(false); 
                    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }); 
                  }}
                >
                  Записатися на пробне
                </Button>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden pt-24">
        {/* Background Image with Deep Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src={content?.hero_bg || "https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=1920&auto=format&fit=crop"} 
            alt="Kyokushin Karate Training Kyiv" 
            className="w-full h-full object-cover opacity-40 scale-105"
            referrerPolicy="no-referrer"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />
        </div>

        {/* Decorative Japanese Kanji (Kyokushin) - REMOVED AS REQUESTED */}

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <BrandLogo size="lg" />
            
            <h1 className="text-xl md:text-2xl font-bold mb-4 tracking-tight uppercase text-red-600">
              Карате Київ <span className="text-white/50 block md:inline md:ml-2">м. Шулявська • Дитяче карате Київ • Секція карате Київ</span>
            </h1>

            <div className="text-3xl md:text-6xl font-black mb-6 tracking-tighter leading-none uppercase">
              <div dangerouslySetInnerHTML={{ __html: content?.hero_title || "<span class='bg-gradient-to-r from-white via-white to-zinc-500 bg-clip-text text-transparent'>Формуємо дисципліну,</span><br /><span class='text-red-600 tracking-tight'>силу та впевненість.</span>" }} />
            </div>
            
            <p className="text-base md:text-lg text-zinc-300 max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
              {content?.hero_subtitle || "Професійна секція карате Київ під керівництвом 3 дану. 20+ років досвіду. Дитяче карате Київ для майбутніх чемпіонів України та Європи."}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-8">
              <Button 
                id="cta-button-hero"
                variant="primary" 
                className="w-full sm:w-auto" 
                onClick={() => {
                  if (window.fbq) window.fbq('track', 'Lead');
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Записатися на пробне
              </Button>
              <Button 
                id="cta-button-question"
                variant="secondary" 
                className="w-full sm:w-auto" 
                showIcon={false} 
                onClick={() => {
                  if (window.fbq) window.fbq('track', 'Contact');
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
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
      <section className="py-8 md:py-10 bg-black relative overflow-hidden">
        {/* Subtle Background Accents */}
        {content?.transformation_bg ? (
          <div className="absolute inset-0 z-0">
            <img 
              src={content.transformation_bg} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
          </div>
        ) : (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
        )}
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-black uppercase mb-4 tracking-tight">
                {content?.transformation_title || "Як дитяче карате змінює дитину"}
              </h2>
              <div 
                className="text-zinc-500 text-base md:text-lg max-w-2xl mx-auto font-medium"
                dangerouslySetInnerHTML={{ __html: content?.transformation_subtitle || `Наша секція карате Київ допомагає батькам виховувати сильних особистостей. <br />
                <span class="text-red-500/80">Ми перетворюємо слабкість на силу.</span>` }}
              />
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
              <Button variant="primary" className="mx-auto mb-6 h-[52px]" onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>
                Записати дитину на пробне
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works & What you need Section */}
      <section className="py-8 md:py-10 bg-black relative overflow-hidden">
        {content?.how_bg && (
          <div className="absolute inset-0 z-0">
            <img 
              src={content.how_bg} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6 relative z-10">
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
      <section id="about" className="py-8 md:py-10 bg-zinc-950 relative overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src={content?.about_image || "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1200&auto=format&fit=crop"} 
            alt="Karate Emotion" 
            className="w-full h-full object-cover grayscale opacity-30"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/40" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="max-w-3xl">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.2em] mb-4">Клуб кіокушинкай карате в Києві</h2>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-8 uppercase tracking-tight text-white leading-tight">
              {content?.about_title || "Дисципліна. Сила. Характер."}
            </h2>
            
            <div 
              className="text-zinc-300 text-lg md:text-xl mb-8 leading-relaxed font-medium"
              dangerouslySetInnerHTML={{ __html: content?.about_text || `Black Bear Dojo — це середовище, де ваша дитина здобуває <span class="text-red-500 font-bold">дисципліну</span> та впевненість.<br class="hidden md:block" />
              Системні тренування формують міцний характер, повагу до оточуючих та вміння досягати цілей.<br class="hidden md:block" />
              Розвиток відбувається поступово: від базових навичок до участі у <span class="text-red-500 font-bold">змаганнях</span>.<br class="hidden md:block" />
              Наш багаторічний <span class="text-red-500 font-bold">досвід</span> допомагає виховувати не лише сильних спортсменів, а й цілеспрямованих особистостей.` }}
            />

            <div className="flex flex-wrap gap-3 mb-10">
              <span className="px-5 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-white">Для дітей 4–7 років</span>
              <span className="px-5 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-white">Для дітей 7–12 років</span>
              <span className="px-5 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-white">Для підлітків 12+</span>
            </div>

            <Button variant="primary" className="px-10 py-5 text-sm" onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>
              Записатися на пробне тренування
            </Button>
          </div>
        </div>
      </section>

      {/* Directions Section */}
      <section id="directions" className="py-8 md:py-10 bg-black relative overflow-hidden">
        {content?.directions_bg && (
          <div className="absolute inset-0 z-0">
            <img 
              src={content.directions_bg} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionTitle 
            title={content?.directions_title || "Секція карате для дітей у Києві"} 
            subtitle={content?.directions_subtitle || "Ми розробили спеціальні програми для кожної вікової категорії з чіткими результатами"}
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
      <section id="results" className="py-8 md:py-10 bg-[#0B0B0B] relative overflow-hidden">
        {content?.results_bg && (
          <div className="absolute inset-0 z-0">
            <img 
              src={content.results_bg} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0B0B0B] via-[#0B0B0B]/90 to-[#0B0B0B]" />
          </div>
        )}
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          
          {/* Header */}
          <div className="text-center mb-12">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mb-4"
            >
              {content?.results_title || "Результати, що підтверджують рівень підготовки"}
            </motion.h2>
            <motion.div 
              initial={{ opacity: 0, scaleX: 0 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-24 h-0.5 bg-[#D40000] mx-auto mb-6"
            />
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="text-zinc-400 text-lg md:text-xl"
            >
              Фактичні досягнення клубу та його вихованців
            </motion.p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-16">
            {[
              { top: '20+ років', bottom: 'тренерського досвіду' },
              { top: 'Чемпіони України', bottom: 'серед вихованців клубу' },
              { top: 'Призери та чемпіони Європи', bottom: 'міжнародний рівень підготовки' },
              { top: 'Міжнародні турніри', bottom: 'участь у змаганнях за межами України' },
              { top: 'Регіональні та всеукраїнські змагання', bottom: 'постійна участь у міських та обласних турнірах' },
            ].map((card, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * idx, duration: 0.5 }}
                className="bg-[#141414] p-6 rounded-2xl border border-[#D40000]/20 hover:border-[#D40000]/60 hover:shadow-[0_0_20px_rgba(212,0,0,0.15)] transition-all duration-300 flex flex-col justify-center text-center min-h-[140px]"
              >
                <div className="text-white font-bold text-lg leading-tight mb-2 uppercase tracking-wide">{card.top}</div>
                <div className="text-zinc-500 text-xs uppercase tracking-widest leading-relaxed">{card.bottom}</div>
              </motion.div>
            ))}
          </div>

          {/* Photo Block */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="relative w-full aspect-[21/9] md:aspect-[21/7] rounded-3xl overflow-hidden mb-16 group"
          >
            <img 
              src={content?.results_image || "https://images.unsplash.com/photo-1564415315949-7a0c4c73aab4?q=80&w=1200&auto=format&fit=crop"} 
              alt="Карате змагання" 
              className="w-full h-full object-cover grayscale brightness-50 group-hover:scale-105 transition-transform duration-1000"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-[#0B0B0B]/40 to-transparent flex flex-col justify-end p-8 md:p-12 text-center">
              <h3 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight mb-2">
                {content?.results_image_title || "Системна підготовка"}
              </h3>
              <p className="text-[#D40000] font-bold text-sm md:text-lg uppercase tracking-[0.2em]">
                {content?.results_image_subtitle || "Техніка. Фізика. Дисципліна."}
              </p>
            </div>
          </motion.div>

          {/* CTA Button */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-center"
          >
            <a 
              href="#contact"
              className="inline-flex items-center justify-center bg-[#D40000] hover:bg-[#A30000] text-white font-bold uppercase tracking-widest text-sm px-10 py-5 rounded-full shadow-[0_10px_30px_rgba(212,0,0,0.3)] hover:shadow-[0_15px_40px_rgba(212,0,0,0.4)] transition-all duration-300 hover:-translate-y-1"
            >
              Записатися на пробне тренування
            </a>
          </motion.div>

        </div>
      </section>

      {/* Coaches Section */}
      <section id="coach" className="py-8 md:py-10 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle 
            title="Наші Тренери" 
            subtitle="Професіонали, які передають досвід та формують нове покоління чемпіонів"
            light
          />
          
          <div className="grid lg:grid-cols-2 gap-8">
            {coaches.map((coach, index) => (
              <motion.div 
                key={coach.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-white/5 flex flex-col md:flex-row group ${index % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}
              >
                <div className="relative w-full md:w-1/2 h-[400px] md:h-auto overflow-hidden">
                  <img 
                    src={coach.photo || "https://picsum.photos/seed/coach/800/1000"} 
                    alt={coach.name} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
                    referrerPolicy="no-referrer"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent md:bg-gradient-to-${index % 2 !== 0 ? 'l' : 'r'} md:from-transparent md:to-zinc-900`} />
                </div>
                
                <div className="p-8 md:w-1/2 flex flex-col justify-center space-y-6">
                  <div>
                    <span className={`bg-${index === 0 ? 'red-600' : 'zinc-700'} text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block shadow-lg ${index === 0 ? 'shadow-red-600/20' : ''}`}>{coach.role}</span>
                    <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{coach.name}</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="text-red-500 font-bold text-[10px] uppercase tracking-widest">Звання та досягнення</div>
                    <ul className="grid grid-cols-1 gap-y-2 text-zinc-300 text-sm">
                      {(coach.achievements || []).map((ach: string, i: number) => (
                        <li key={i} className="flex items-center gap-3"><CheckCircle2 size={16} className="text-red-600" /> {ach}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <p className="text-zinc-400 italic text-sm leading-relaxed">
                      "{coach.bio}"
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Schedule Section */}
      <section id="schedule" className="py-8 md:py-10 bg-[#0B0B0B] relative overflow-hidden">
        {content?.schedule_bg && (
          <div className="absolute inset-0 z-0">
            <img 
              src={content.schedule_bg} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0B0B0B] via-[#0B0B0B]/90 to-[#0B0B0B]" />
          </div>
        )}
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          
          {/* Header */}
          <div className="text-center mb-12">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mb-4"
            >
              Розклад занять
            </motion.h2>
            <motion.div 
              initial={{ opacity: 0, scaleX: 0 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-24 h-0.5 bg-[#D40000] mx-auto mb-6"
            />
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="text-zinc-400 text-lg md:text-xl"
            >
              Оберіть зручну локацію та групу
            </motion.p>
          </div>

          {/* Two Cards Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Location 1: Shulyavka */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-[#141414] rounded-3xl p-6 md:p-8 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#D40000]/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-[#D40000]/10 transition-colors"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-[#D40000] mb-3">
                  <MapPin size={20} />
                  <span className="font-bold uppercase tracking-widest text-xs">Локація 1</span>
                </div>
                <h3 className="text-2xl font-black text-white mb-2">Шулявка</h3>
                <p className="text-zinc-400 text-sm mb-4">вул. Сім'ї Бродських, 31/33<br/>Київ, 03057 (м. Шулявська)</p>
                
                <div className="inline-block px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-widest mb-6">
                  Дні: Пн, Ср, Пт
                </div>

                <div className="space-y-3">
                  {[
                    { group: 'Молодша група', age: '4–7 років', time: '17:00 – 17:40' },
                    { group: 'Середня група', age: '7–12 років', time: '18:00 – 19:00' },
                    { group: 'Старша група', age: '12+ років', time: '19:00 – 20:30' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-black/50 border border-white/5 hover:border-[#D40000]/30 transition-colors">
                      <div>
                        <div className="text-white font-bold text-base">{item.group}</div>
                        <div className="text-zinc-500 text-[10px] uppercase tracking-widest">{item.age}</div>
                      </div>
                      <div className="text-[#D40000] font-mono font-bold text-lg mt-1 sm:mt-0">
                        {item.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Location 2: Nekrasova */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-[#141414] rounded-3xl p-6 md:p-8 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#D40000]/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-[#D40000]/10 transition-colors"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-[#D40000] mb-3">
                  <MapPin size={20} />
                  <span className="font-bold uppercase tracking-widest text-xs">Локація 2</span>
                </div>
                <h3 className="text-2xl font-black text-white mb-2">Віктора Некрасова 1–3</h3>
                <p className="text-zinc-400 text-sm mb-1">Тренер: Крамаренко Олег</p>
                <a href="tel:+380955680604" className="text-[#D40000] hover:text-white transition-colors font-bold text-base mb-4 block">+38 095 568 06 04</a>
                
                <div className="inline-block px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-widest mb-6">
                  Дні: Пн, Ср, Пт
                </div>

                <div className="space-y-3">
                  {[
                    { group: 'Група', age: '5–7 років', time: '17:00 – 18:00' },
                    { group: 'Група', age: '8–12 років', time: '18:00 – 19:00' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-black/50 border border-white/5 hover:border-[#D40000]/30 transition-colors">
                      <div>
                        <div className="text-white font-bold text-base">{item.group}</div>
                        <div className="text-zinc-500 text-[10px] uppercase tracking-widest">{item.age}</div>
                      </div>
                      <div className="text-[#D40000] font-mono font-bold text-lg mt-1 sm:mt-0">
                        {item.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>

          {/* CTA Button */}
          <div className="text-center mt-12 relative z-20">
            <a 
              href="#contact"
              className="inline-flex items-center justify-center bg-[#D40000] hover:bg-[#A30000] text-white font-bold uppercase tracking-widest text-sm px-10 py-5 rounded-full shadow-[0_10px_30px_rgba(212,0,0,0.3)] hover:shadow-[0_15px_40px_rgba(212,0,0,0.4)] transition-all duration-300 hover:-translate-y-1 mb-4"
            >
              Записатися на пробне тренування
            </a>
            <p className="text-zinc-500 text-xs uppercase tracking-widest">
              або зателефонувати тренеру
            </p>
          </div>

        </div>
      </section>

      {/* Reviews Section */}
      <section className="py-8 md:py-10 bg-black relative overflow-hidden">
        {content?.reviews_bg && (
          <div className="absolute inset-0 z-0">
            <img 
              src={content.reviews_bg} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionTitle title={content?.reviews_title || "Відгуки батьків"} subtitle={content?.reviews_subtitle || "Що кажуть про нас ті, хто вже довірив нам своїх дітей"} light />
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
      <section className="py-8 md:py-10 bg-black relative overflow-hidden">
        {content?.faq_bg && (
          <div className="absolute inset-0 z-0">
            <img 
              src={content.faq_bg} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionTitle title={content?.faq_title || "Часті запитання (FAQ)"} subtitle={content?.faq_subtitle || "Відповідаємо на головні питання батьків"} light />
          
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
                a: 'Тренування проводять Ігор Котляревський та Олег Крамаренко.\n\nІгор Котляревський — 3 дан кіокушинкай, майстер спорту України, призер чемпіонату Європи, абсолютний чемпіон України, з досвідом понад 20 років у спорті та підготовці спортсменів.\n\nОлег Крамаренко — тренер клубу, який працює з дитячими та підлітковими групами, готує спортсменів до змагань і забезпечує системну підготовку відповідно до стандартів кіокушинкай.\n\nУ клубі підготовлені чемпіони та призери України й Європи. Методика поєднує класичну школу кіокушинкай та сучасну фізичну підготовку, з акцентом на дисципліну, техніку та поступовий розвиток спортсмена.' 
              },
              { 
                q: 'Скільки коштує навчання і що входить у абонемент?', 
                a: 'Вартість абонемента — 2500 грн на місяць.\n\nАбонемент включає:\n– регулярні тренування у віковій групі\n– системну фізичну підготовку\n– технічну базу кіокушинкай\n– підготовку до змагань (за рівнем готовності)\n\nПерше тренування — пробне.\nДля занять необхідна базова форма.' 
              },
            ].map((item, idx) => (
              <details key={idx} className="group bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
                <summary className="p-4 cursor-pointer flex items-center justify-between font-bold text-base list-none">
                  {item.q}
                  <ChevronRight className="group-open:rotate-90 transition-transform text-red-600" size={16} />
                </summary>
                <div className="px-4 pb-4 text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contact & Footer Section */}
      <section id="contact" className="py-8 md:py-10 flex flex-col bg-zinc-950 relative overflow-hidden">
        {content?.contact_bg ? (
          <div className="absolute inset-0 z-0">
            <img 
              src={content.contact_bg} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/90 to-zinc-950" />
          </div>
        ) : (
          <div className="absolute top-0 right-0 w-1/2 h-full bg-red-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        )}
        
        <div className="flex-grow flex items-center relative z-10">
          {!content?.contact_bg && (
             <div className="absolute top-0 right-0 w-1/2 h-full bg-red-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
          )}
          
          <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4 uppercase leading-tight" dangerouslySetInnerHTML={{ __html: content?.contact_title || "Запишіть дитину в секцію карате Київ" }} />
                <p className="text-zinc-400 text-base mb-6" dangerouslySetInnerHTML={{ __html: content?.contact_subtitle || "Залиште заявку на дитяче карате Київ, і ми зателефонуємо вам для узгодження часу пробного заняття." }} />
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center text-red-600 border border-white/5 shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Локації</div>
                      <div className="space-y-2">
                        <div className="text-white text-sm font-medium leading-tight">вул. Сім'ї Бродських, 31/33<br/><span className="text-zinc-500 text-xs">Київ, 03057 (м. Шулявська)</span></div>
                        <div className="text-white text-sm font-medium leading-tight">вул. Віктора Некрасова, 1-3<br/><span className="text-zinc-500 text-xs">Київ, 04136</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center text-red-600 border border-white/5 shrink-0">
                      <Send size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Телефони (Telegram / Viber)</div>
                      <div className="space-y-2">
                        <div className="text-white text-sm font-medium">Ігор Котляревський:<br/><a href="tel:+380954756500" className="text-red-500 hover:text-red-400 transition-colors">095 475 65 00</a></div>
                        <div className="text-white text-sm font-medium">Олег Крамаренко:<br/><a href="tel:+380955680604" className="text-red-500 hover:text-red-400 transition-colors">095 568 06 04</a></div>
                      </div>
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
                      name="name"
                      type="text" 
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors text-xs"
                      placeholder="Олександр"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Телефон</label>
                    <input 
                      required
                      name="phone"
                      type="tel" 
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors text-xs"
                      placeholder="+38 (0__) ___ __ __"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Локація</label>
                    <select name="location" className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors appearance-none text-xs text-white">
                      <option value="Шулявка">Шулявка (вул. Сім'ї Бродських, 31/33)</option>
                      <option value="Віктора Некрасова">Віктора Некрасова, 1-3</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Вік дитини / Група</label>
                    <select name="age" className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors appearance-none text-xs text-white">
                      <option value="4-7 років">Молодша група (4–7 років)</option>
                      <option value="7-12 років">Середня група (7–12 років)</option>
                      <option value="12+ років">Старша група (12+ років)</option>
                      <option value="Дорослий">Доросла група</option>
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
              <a href={content?.social_instagram || "https://instagram.com/karate_kyiv"} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors"><Instagram size={20} /></a>
              <a href={content?.social_facebook || "https://www.facebook.com/karatee.kyiv/"} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors"><Facebook size={20} /></a>
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
