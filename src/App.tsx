/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { AIChat } from './components/AIChat';
import SEO from './components/SEO';
import { ContactForm } from './components/ContactForm';

const AdminPage = lazy(() => import('./Admin').then(m => ({ default: m.AdminPage })));
const LoginPage = lazy(() => import('./CRM').then(m => ({ default: m.LoginPage })));
const CoachDashboard = lazy(() => import('./CRM').then(m => ({ default: m.CoachDashboard })));
const ParentProfile = lazy(() => import('./CRM').then(m => ({ default: m.ParentProfile })));
const KidsLanding = lazy(() => import('./KidsLanding').then(m => ({ default: m.KidsLanding })));
const JuniorLanding = lazy(() => import('./JuniorLanding').then(m => ({ default: m.JuniorLanding })));
const TeenLanding = lazy(() => import('./TeenLanding').then(m => ({ default: m.TeenLanding })));
const PersonalLanding = lazy(() => import('./PersonalLanding').then(m => ({ default: m.PersonalLanding })));
const WomenLanding = lazy(() => import('./WomenLanding').then(m => ({ default: m.WomenLanding })));

import { 
  Shield, 
  Trophy, 
  Users, 
  Clock, 
  MapPin, 
  ChevronRight, 
  ChevronDown,
  Menu, 
  X, 
  Star, 
  CheckCircle2,
  Instagram,
  Facebook,
  Send,
  User,
  Quote,
  Award,
  Info,
  ExternalLink
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
  <div className="mb-16 text-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6"
    >
      <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
      Black Bear Dojo
    </motion.div>
    <motion.h2 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`text-4xl md:text-6xl font-black mb-6 uppercase tracking-tighter leading-none ${light ? 'text-white' : 'text-zinc-900'}`}
    >
      {title}
    </motion.h2>
    {subtitle && (
      <motion.p 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className={`text-lg md:text-xl max-w-3xl mx-auto font-medium ${light ? 'text-zinc-400' : 'text-zinc-600'}`}
      >
        {subtitle}
      </motion.p>
    )}
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
          <Route path="/dashboard" element={<CoachDashboard />} />
          <Route path="/profile" element={<ParentProfile />} />
          <Route path="/kids-4-7" element={<KidsLanding />} />
          <Route path="/juniors-7-12" element={<JuniorLanding />} />
          <Route path="/teens-12-plus" element={<TeenLanding />} />
          <Route path="/personal-training" element={<PersonalLanding />} />
          <Route path="/women-karate" element={<WomenLanding />} />
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
  const [locations, setLocations] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);

  const defaultCoaches = [
    {
      id: 1,
      name: "Ігор Котляревський",
      role: "Засновник клубу",
      bio: "Моя мета — не просто навчити битися, а сформувати характер, який допоможе дитині перемагати в житті.",
      photo: "https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=800&auto=format&fit=crop",
      achievements: ["3 дан карате Кіокушинкай", "Майстер спорту України", "Чемпіон України", "Призер чемпіонатів Європи"]
    },
    {
      id: 2,
      name: "Олег Крамаренко",
      role: "Провідний тренер",
      bio: "Кожне тренування — це перемога над собою. Ми вчимо дітей не здаватися перед труднощами.",
      photo: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=800&auto=format&fit=crop",
      achievements: ["10 років тренерської практики", "Підготовка до змагань", "Всеукраїнський та міжнародний рівень"]
    }
  ];

  const defaultLocations = [
    { id: 1, name: "Шулявка", address: "вул. Сім'ї Бродських, 31/33\nКиїв, 03057 (м. Шулявська)", map_link: "https://maps.app.goo.gl/9Z9Z9Z" },
    { id: 2, name: "Віктора Некрасова", address: "вул. Віктора Некрасова, 1-3\nКиїв, 04136", map_link: "https://maps.app.goo.gl/8Y8Y8Y" }
  ];

  const defaultSchedule = [
    { id: 1, location_id: 1, coach_name: "Ігор Котляревський", day_of_week: "Пн, Ср, Пт", start_time: "17:00", end_time: "17:40", group_name: "Молодша група (4–7 років)", price: "2500" },
    { id: 2, location_id: 1, coach_name: "Ігор Котляревський", day_of_week: "Пн, Ср, Пт", start_time: "18:00", end_time: "19:00", group_name: "Середня група (7–12 років)", price: "2500" },
    { id: 3, location_id: 1, coach_name: "Ігор Котляревський", day_of_week: "Пн, Ср, Пт", start_time: "19:00", end_time: "20:30", group_name: "Старша група (12+ років)", price: "2500" },
    { id: 4, location_id: 2, coach_name: "Олег Крамаренко", day_of_week: "Пн, Ср, Пт", start_time: "17:00", end_time: "18:00", group_name: "Група (5–7 років)", price: "2500" },
    { id: 5, location_id: 2, coach_name: "Олег Крамаренко", day_of_week: "Пн, Ср, Пт", start_time: "18:00", end_time: "19:00", group_name: "Група (8–12 років)", price: "2500" }
  ];

  React.useEffect(() => {
    fetch(`/api/content?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => setContent(data && !data.error ? data : null))
      .catch(() => setContent(null));
    
    fetch(`/api/coaches?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => setCoaches(Array.isArray(data) && data.length > 0 ? data : defaultCoaches))
      .catch(() => setCoaches(defaultCoaches));

    fetch('/api/locations')
      .then(res => res.json())
      .then(data => setLocations(Array.isArray(data) && data.length > 0 ? data : defaultLocations))
      .catch(() => setLocations(defaultLocations));

    fetch('/api/schedule')
      .then(res => res.json())
      .then(data => setSchedule(Array.isArray(data) && data.length > 0 ? data : defaultSchedule))
      .catch(() => setSchedule(defaultSchedule));
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
      // Google Ads / Analytics
      if ((window as any).gtag) {
        (window as any).gtag('event', 'generate_lead', {
          'event_id': eventId,
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
    { 
      name: 'Програми', 
      href: '#directions',
      subItems: [
        { name: 'Діти 4-7 років', href: '/kids-4-7' },
        { name: 'Діти 7-12 років', href: '/juniors-7-12' },
        { name: 'Підлітки 12+', href: '/teens-12-plus' },
        { name: 'Для жінок', href: '/women-karate' },
        { name: 'Персональні', href: '/personal-training' },
      ]
    },
    { name: 'Тренери', href: '#coach' },
    { name: 'Розклад', href: '#schedule' },
    { name: 'Контакти', href: '#contact' },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-600 selection:text-white scroll-smooth">
      <SEO 
        title="Головна"
        description="Black Bear Dojo — професійна школа карате Кіокушинкай у Києві. Тренування для дітей від 4 років, підлітків та дорослих. Локації: Шулявка та Відрадний. Перше тренування безкоштовно!"
        keywords="карате київ, кіокушинкай карате київ, карате для дітей київ, секція карате шулявка, карате відрадний, бойові мистецтва київ, black bear dojo"
      />
      
      <AnimatePresence>
        {isSubmitted && <ThankYouPage onBack={() => setIsSubmitted(false)} />}
      </AnimatePresence>

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
                
                if (link.subItems) {
                  return (
                    <div key={link.name} className="relative group/dropdown">
                      <a 
                        href={link.href}
                        className={`relative text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-300 flex items-center gap-1 group ${
                          isActive ? 'text-red-500' : 'text-[#EAEAEA] hover:text-red-500'
                        }`}
                      >
                        {link.name}
                        <ChevronDown size={12} className="group-hover/dropdown:rotate-180 transition-transform duration-300" />
                        <span className={`absolute -bottom-1 left-0 h-[1px] bg-red-600 transition-all duration-300 ${
                          isActive ? 'w-full' : 'w-0 group-hover:w-full'
                        }`} />
                      </a>
                      
                      {/* Dropdown Menu */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all duration-300 z-50">
                        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-2 min-w-[200px] shadow-2xl backdrop-blur-xl">
                          {link.subItems.map((sub) => (
                            <Link 
                              key={sub.name}
                              to={sub.href}
                              className="block px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-red-600/10 rounded-xl transition-all"
                            >
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

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

          {/* Mobile Actions */}
          <div className="flex items-center gap-3 md:hidden">
            <button 
              className="bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(220,38,38,0.4)] hover:bg-red-500 transition-colors"
              onClick={() => {
                if (window.fbq) window.fbq('track', 'Lead');
                document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Записатися
            </button>
            <button className="text-white p-1" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black pt-24 px-6 md:hidden overflow-y-auto"
          >
              <div className="flex flex-col gap-6 text-center pb-12">
                {navLinks.map((link) => {
                  if (link.subItems) {
                    return (
                      <div key={link.name} className="space-y-4">
                        <div className="text-sm font-black text-red-600 uppercase tracking-widest">{link.name}</div>
                        <div className="flex flex-col gap-4">
                          {link.subItems.map(sub => (
                            <Link 
                              key={sub.name}
                              to={sub.href}
                              onClick={() => setIsMenuOpen(false)}
                              className="text-2xl font-bold text-white"
                            >
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <a 
                      key={link.name} 
                      href={link.href} 
                      onClick={() => setIsMenuOpen(false)}
                      className="text-2xl font-bold text-white"
                    >
                      {link.name}
                    </a>
                  );
                })}
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

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <BrandLogo size="lg" />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600/10 border border-red-600/20 mb-8"
            >
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
                Перше тренування — БЕЗКОШТОВНО • Залишилось 3 місця
              </span>
            </motion.div>

            <h1 className="text-xl md:text-2xl font-bold mb-4 tracking-tight uppercase text-red-600">
              Карате Київ <span className="text-white/50 block md:inline md:ml-2">м. Шулявська • Дитяче карате Київ • Секція карате Київ</span>
            </h1>

            <div className="text-4xl md:text-7xl font-black mb-6 tracking-tighter leading-none uppercase">
              <div dangerouslySetInnerHTML={{ __html: content?.hero_title || "<span class='bg-gradient-to-r from-white via-white to-zinc-500 bg-clip-text text-transparent'>Формуємо дисципліну,</span><br /><span class='text-red-600 tracking-tight'>силу та впевненість.</span>" }} />
            </div>
            
            <p className="text-lg md:text-xl text-zinc-200 max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
              {content?.hero_subtitle || "Професійна секція карате Київ під керівництвом 3 дану. 20+ років досвіду. Дитяче карате Київ для майбутніх чемпіонів України та Європи."}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-12">
              <Button 
                id="cta-button-hero"
                variant="primary" 
                className="w-full sm:w-auto h-[64px] px-12 text-lg" 
                onClick={() => {
                  if (window.fbq) window.fbq('track', 'Lead');
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {content?.hero_button || "Записатися на пробне"}
              </Button>
              <a 
                href="#about"
                className="text-zinc-400 hover:text-white font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2"
              >
                Дізнатися більше <ChevronRight size={14} />
              </a>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">
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

        {/* Trust Bar */}
        <div className="relative z-10 border-y border-white/5 bg-zinc-950/50 backdrop-blur-md py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {[
                { label: "Досвід викладання", value: "20+ років", icon: <Award className="text-red-600" size={24} /> },
                { label: "Вихованців клубу", value: "500+", icon: <Users className="text-red-600" size={24} /> },
                { label: "Філії у Києві", value: "2 локації", icon: <MapPin className="text-red-600" size={24} /> },
                { label: "Чорні пояси", value: "3 дан", icon: <Shield className="text-red-600" size={24} /> },
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex flex-col items-center md:items-start text-center md:text-left gap-4"
                >
                  <div className="p-3 rounded-2xl bg-red-600/10 border border-red-600/20">
                    {stat.icon}
                  </div>
                  <div>
                    <div className="text-2xl md:text-3xl font-black text-white mb-1">{stat.value}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{stat.label}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
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

      {/* Problem Section */}
      <section className="py-24 bg-zinc-950 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.3em] mb-4">Виклики сучасності</h2>
              <h3 className="text-4xl md:text-5xl font-black uppercase mb-8 tracking-tight leading-tight">
                Ваша дитина проводить занадто багато часу в <span className="text-zinc-600">гаджетах?</span>
              </h3>
              <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                Сучасний світ пропонує дітям пасивний відпочинок, що веде до слабкої дисципліни, невпевненості та відсутності фізичної активності. Батьки часто стикаються з тим, що дитина:
              </p>
              <div className="space-y-4">
                {[
                  'Не вміє постояти за себе',
                  'Має проблеми з концентрацією',
                  'Швидко здається перед труднощами',
                  'Потребує сильного прикладу для наслідування'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 text-zinc-300 font-medium">
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-square rounded-[3rem] overflow-hidden border border-white/5"
            >
              <img 
                src="https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=800&auto=format&fit=crop" 
                alt="Karate Discipline" 
                className="w-full h-full object-cover grayscale brightness-75"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute bottom-10 left-10 right-10">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
                  <p className="text-white font-bold italic">"Карате — це не про бійку. Це про перемогу над своєю слабкістю кожного дня."</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
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
              decoding="async"
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
                className="text-zinc-400 text-base md:text-lg max-w-2xl mx-auto font-medium"
                dangerouslySetInnerHTML={{ __html: content?.transformation_subtitle || `Наша секція карате Київ допомагає батькам виховувати сильних особистостей. <br />
                <span class="text-red-500">Ми перетворюємо слабкість на силу.</span>` }}
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
                  <li key={i} className="flex items-start gap-4 text-base text-zinc-400 group-hover:text-zinc-300 transition-colors">
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

      {/* Video Section */}
      <section className="py-24 bg-black relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.3em] mb-4">Атмосфера додзьо</h2>
            <h3 className="text-4xl md:text-5xl font-black uppercase tracking-tight">Відчуйте енергію тренувань</h3>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative aspect-video rounded-[3rem] overflow-hidden border border-white/10 group cursor-pointer"
          >
            <img 
              src="https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=1200&auto=format&fit=crop" 
              alt="Training Video Placeholder" 
              className="w-full h-full object-cover brightness-50 group-hover:scale-105 transition-transform duration-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.5)] group-hover:scale-110 transition-transform">
                <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2" />
              </div>
            </div>
            <div className="absolute bottom-10 left-10">
              <p className="text-white font-bold uppercase tracking-widest text-sm">Дивитись відео тренування</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Coach Authority Section */}

      {/* How it works Section */}
      <section className="py-24 bg-black relative overflow-hidden">
        {content?.how_bg && (
          <div className="absolute inset-0 z-0">
            <img 
              src={content.how_bg} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.3em] mb-4">Процес навчання</h2>
            <h3 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
              {content?.how_title || "Як почати тренування"}
            </h3>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: content?.how_step1_title || 'Запис', text: content?.how_step1_text || 'Залиште заявку на сайті або зателефонуйте нам.' },
              { title: content?.how_step2_title || 'Пробне', text: content?.how_step2_text || 'Приходьте на перше безкоштовне заняття.' },
              { title: content?.how_step3_title || 'Результат', text: content?.how_step3_text || 'Починайте регулярні тренування та прогресуйте.' }
            ].map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="bg-zinc-900/50 backdrop-blur-sm p-8 rounded-3xl border border-white/5 text-center"
              >
                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-xl font-black mx-auto mb-6">
                  {i + 1}
                </div>
                <h4 className="text-xl font-bold mb-4 uppercase tracking-tight">{step.title}</h4>
                <p className="text-zinc-400 leading-relaxed">{step.text}</p>
              </motion.div>
            ))}
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
            decoding="async"
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

            {content?.about_quote && (
              <div className="bg-white/5 border-l-4 border-red-600 p-6 rounded-r-2xl mb-10 italic text-zinc-300">
                "{content.about_quote}"
              </div>
            )}

            <div className="flex flex-wrap gap-3 mb-10">
              <Link to="/kids-4-7" className="px-5 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-white hover:bg-red-600/20 hover:border-red-600/50 transition-all">Для дітей 4–7 років</Link>
              <Link to="/juniors-7-12" className="px-5 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-white hover:bg-red-600/20 hover:border-red-600/50 transition-all">Для дітей 7–12 років</Link>
              <Link to="/teens-12-plus" className="px-5 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-white hover:bg-red-600/20 hover:border-red-600/50 transition-all">Для підлітків 12+</Link>
              <Link to="/women-karate" className="px-5 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-white hover:bg-red-600/20 hover:border-red-600/50 transition-all">Для жінок</Link>
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
              decoding="async"
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
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-16">
            {[
              { age: '4–7 років', title: content?.dir1_title || 'Перші кроки', desc: content?.dir1_text || 'Розвиток координації, ігрова форма, база дисципліни.', result: 'Координація', link: '/kids-4-7', badge: 'Популярно' },
              { age: '7–12 років', title: content?.dir2_title || 'Формування', desc: content?.dir2_text || 'Техніка, фізична підготовка, перші змагання.', result: 'База сили', link: '/juniors-7-12', badge: 'Набір' },
              { age: 'Підлітки', title: content?.dir3_title || 'Впевненість', desc: content?.dir3_text || 'Професійні турніри, самооборона та лідерство.', result: 'Лідерство', link: '/teens-12-plus' },
              { age: 'Для жінок', title: 'Естетика та Сила', desc: 'Гнучкість, самооборона та зняття стресу без травм.', result: 'Впевненість', link: '/women-karate', badge: 'New' },
              { age: 'Персональні', title: 'Шлях майстра', desc: 'Максимальний результат, індивідуальний графік та 100% уваги.', result: 'Результат x3', link: '/personal-training', badge: 'VIP' },
            ].map((item, idx) => {
              const CardContent = (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="group p-8 bg-zinc-900 rounded-[2.5rem] border border-white/5 hover:border-red-600/50 transition-all duration-500 flex flex-col h-full cursor-pointer relative overflow-hidden"
                >
                  {item.badge && (
                    <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-red-600 text-white text-[8px] font-black uppercase tracking-widest shadow-lg">
                      {item.badge}
                    </div>
                  )}
                  <div className="text-red-600 font-black text-[10px] uppercase tracking-[0.2em] mb-4">{item.age}</div>
                  <h3 className="text-2xl font-black mb-4 group-hover:text-red-500 transition-colors uppercase tracking-tighter">{item.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed mb-8 flex-grow font-medium">{item.desc}</p>
                  <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                      Результат: <span className="text-white">{item.result}</span>
                    </div>
                    <ChevronRight size={16} className="text-red-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              );

              if (item.link) {
                return <Link key={idx} to={item.link} className="h-full">{CardContent}</Link>;
              }
              return CardContent;
            })}
          </div>

          <div className="text-center">
            <Button 
              variant="primary" 
              className="mx-auto h-[64px] px-12 shadow-[0_20px_50px_rgba(209,0,0,0.3)]"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Записати дитину на пробне
            </Button>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black mt-8">
              Перше тренування — БЕЗКОШТОВНО
            </p>
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
              decoding="async"
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
              decoding="async"
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

      {/* Coaches Section (Authority) */}
      <section id="coach" className="py-24 bg-black relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-[0.3em] mb-4">Експертність та досвід</h2>
            <h3 className="text-4xl md:text-5xl font-black uppercase tracking-tight">Наші <span className="text-zinc-600">майстри</span></h3>
          </div>

          <div className="space-y-32">
            {coaches.map((coach, index) => (
              <div key={coach.id} className={`grid lg:grid-cols-2 gap-20 items-center ${index % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  <div className={`absolute -inset-4 border border-red-600/20 rounded-[4rem] ${index % 2 !== 0 ? 'rotate-3' : '-rotate-3'}`} />
                  <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden border border-white/10">
                    <img 
                      src={coach.photo || "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=800&auto=format&fit=crop"} 
                      alt={coach.name} 
                      className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                    <div className="absolute bottom-10 left-10">
                      <h4 className="text-3xl font-black uppercase tracking-tighter">{coach.name}</h4>
                      <p className="text-red-600 font-bold uppercase tracking-widest text-sm">{coach.role}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: index % 2 !== 0 ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                >
                  <div className="space-y-6 mb-12">
                    {(typeof coach.achievements === 'string' ? JSON.parse(coach.achievements) : (coach.achievements || [])).map((item: string, i: number) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="w-6 h-6 rounded-full bg-red-600/10 flex items-center justify-center shrink-0 mt-1">
                          <CheckCircle2 size={14} className="text-red-600" />
                        </div>
                        <p className="text-zinc-300 font-medium text-lg">{item}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-8 bg-zinc-900/50 rounded-3xl border border-white/5 relative overflow-hidden group">
                    <Quote className="absolute top-4 right-4 text-white/5 w-16 h-16" />
                    <p className="text-zinc-400 italic mb-4 relative z-10">
                      "{coach.bio}"
                    </p>
                    <p className="font-bold uppercase tracking-widest text-xs text-white">— {coach.name}</p>
                  </div>
                </motion.div>
              </div>
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
              loading="lazy"
              decoding="async"
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
              {content?.schedule_title || "Розклад занять"}
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
              {content?.schedule_subtitle || "Оберіть зручну локацію та групу"}
            </motion.p>
          </div>

          {/* Dynamic Locations Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {locations.map((loc, idx) => {
              const locSchedule = schedule.filter(s => s.location_id === loc.id);
              const uniqueDays = Array.from(new Set(locSchedule.map(s => s.day_of_week))).join(', ');
              
              return (
                <motion.div 
                  key={loc.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-[#111111] rounded-[2.5rem] border border-white/5 relative overflow-hidden group hover:border-red-600/20 transition-all duration-500 shadow-2xl"
                >
                  {/* Decorative element */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-[100px] -mr-20 -mt-20 group-hover:bg-red-600/10 transition-colors duration-700" />
                  
                  <div className="relative z-10 p-8 md:p-10">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
                      <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-[10px] font-black uppercase tracking-[0.2em]">
                          <MapPin size={12} />
                          Локація {idx + 1}
                        </div>
                        <h3 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none">{loc.name}</h3>
                        <div className="flex items-start gap-2 text-zinc-500 group/addr cursor-default">
                          <Info size={14} className="shrink-0 mt-1 group-hover/addr:text-red-500 transition-colors" />
                          <p className="text-sm font-medium leading-relaxed">{loc.address}</p>
                        </div>
                      </div>

                      {uniqueDays && (
                        <div className="shrink-0">
                          <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Графік</div>
                            <div className="text-white text-sm font-black uppercase tracking-tighter">{uniqueDays}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {locSchedule.map((item) => (
                        <div 
                          key={item.id} 
                          className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] items-center gap-4 p-5 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-red-600/30 transition-all duration-300 group/item"
                        >
                          <div className="space-y-1">
                            <div className="text-lg font-black text-white group-hover/item:text-red-500 transition-colors uppercase tracking-tight">{item.group_name}</div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                              <span>Тренер:</span>
                              <span className="text-zinc-300">{item.coach_name}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {item.price && (
                              <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-wider">
                                {item.price} грн
                              </div>
                            )}
                            <div className="w-px h-4 bg-white/10 hidden md:block" />
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-red-600" />
                            <div className="text-white font-mono font-black text-xl tracking-tighter">
                              {item.start_time} <span className="text-zinc-600 mx-1">—</span> {item.end_time}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {loc.map_link && (
                      <div className="mt-10 pt-8 border-t border-white/5">
                        <a 
                          href={loc.map_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-3 text-zinc-500 hover:text-white transition-all duration-300 text-[11px] font-black uppercase tracking-[0.2em] group/map"
                        >
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover/map:bg-red-600 group-hover/map:text-white transition-all">
                            <ExternalLink size={16} />
                          </div>
                          Відкрити маршрут у Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* CTA Button */}
          <div className="text-center mt-16 relative z-20">
            <Button 
              variant="primary"
              className="h-[64px] px-12 shadow-[0_15px_40px_rgba(220,38,38,0.2)]"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Записатися на пробне тренування
            </Button>
            <p className="text-zinc-500 text-xs uppercase tracking-[0.2em] font-bold mt-6">
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
              loading="lazy"
              decoding="async"
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
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionTitle title={content?.faq_title || "Часті запитання (FAQ)"} subtitle={content?.faq_subtitle || "Відповідаємо на головні питання батьків"} light />
          
          <div className="max-w-3xl mx-auto space-y-4">
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
              <motion.details 
                key={idx} 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden hover:border-red-600/30 transition-all duration-300"
              >
                <summary className="p-6 cursor-pointer flex items-center justify-between font-bold text-lg list-none select-none">
                  <span className="pr-8">{item.q}</span>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-open:bg-red-600 group-open:text-white transition-all duration-300">
                    <ChevronDown className="group-open:rotate-180 transition-transform" size={18} />
                  </div>
                </summary>
                <div className="px-6 pb-6 text-zinc-400 text-base leading-relaxed whitespace-pre-line border-t border-white/5 pt-4">
                  {item.a}
                </div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 bg-zinc-950 relative overflow-hidden border-t border-white/5">
        {/* Subtle Red Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-red-600/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
              Обмежений набір
            </div>
            
            <h2 className="text-4xl md:text-7xl font-black uppercase text-white mb-8 tracking-tighter leading-none">
              Готові виховати <br /> <span className="text-red-600">чемпіона?</span>
            </h2>
            
            <p className="text-lg md:text-xl text-zinc-400 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
              Запишіться на перше безкоштовне тренування вже сьогодні. <br className="hidden md:block" /> 
              Допоможіть дитині стати сильнішою версією себе.
            </p>
            
            <div className="flex flex-col items-center justify-center gap-8">
              <Button 
                variant="primary" 
                className="w-full sm:w-auto h-[72px] px-16 text-xl shadow-[0_20px_50px_rgba(220,38,38,0.3)]"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Записатись зараз
              </Button>
              
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-zinc-900 bg-zinc-800 overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?img=${i+20}`} alt="User" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <div className="text-white font-bold text-sm">+12 батьків записались сьогодні</div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest">Залишилось 4 вільних місця у молодшій групі</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact & Footer Section */}
      <ContactForm 
        locations={locations} 
        title={content?.contact_title}
        subtitle={content?.contact_subtitle}
        source="main"
      />

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

      <AIChat content={content} />
    </div>
  );
}
