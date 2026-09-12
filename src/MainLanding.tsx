import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useSpring, useReducedMotion, useTransform, AnimatePresence } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import {
  Shield,
  Users,
  Clock,
  MapPin,
  ChevronDown,
  ChevronRight,
  Star,
  CheckCircle2,
  Instagram,
  Facebook,
  Send,
  Quote,
  Medal,
  BookOpen,
  Trophy,
  Target,
  Zap,
  Brain
} from 'lucide-react';
import SEO, { SITE_URL } from './components/SEO';
import { PAGE_SEO } from './lib/seoPages';
import { clubGraph, faqPage } from './lib/structuredData';
import { startEngagementTracking } from './lib/engagement';
import { resizedImage } from './lib/images';
import { ContactForm } from './components/ContactForm';
import { QuickLeadModal } from './components/QuickLeadModal';
import { Navbar } from './components/Navbar';
import { BrandLogo } from './components/BrandLogo';
import { trackLeadIntent } from './lib/leadTracking';
import {
  CONTAINER,
  SECTION_Y,
  CARD,
  EYEBROW,
  H2,
  H3,
  BODY,
  HAIRLINE,
  EASE,
  Reveal,
  Eyebrow,
  SectionHeading,
  Button,
  Divider,
  Mark,
  PhotoReveal
} from './components/landing-ui';

/**
 * Головна сторінка клубу. Увесь текст лишається редагованим з адмінки через
 * content.* (ті самі ключі, що й раніше), а секції — вимикаються hide_section_*.
 * Фото — з клубної фотосесії (public/main, public/kids, public/juniors, public/personal);
 * картинки з адмінки (hero_bg, about_image, modern_image, results_image) тут не
 * використовуються — hero_bg лишається og:image для соцмереж.
 */
const PHOTOS = {
  hero: '/kids/coach-kid.webp',
  club: '/main/club-all.webp',
  kidsShape: '/main/kids-shape.webp',
  teensPair: '/main/teens-pair.webp',
  teensMedals: '/main/teens-medals.webp',
  kids: '/kids/hero-boy-smile.webp',
  juniors: '/juniors/hero-boy-medals.webp',
  women: '/personal/hero-woman-blackbelt.webp',
  personal: '/personal/igor-student.webp',
  belt: '/kids/first-belt.webp'
};

export const MAIN_FAQ: { q: string; a: string }[] = [
  {
    q: 'Як проходять тренування під час повітряної тривоги?',
    a: 'Зал у безпечному приміщенні — тренування не зупиняється.\n\nЯкщо у вас є питання щодо конкретної локації, зателефонуйте тренеру перед записом: Ігор Котляревський — 095 475 65 00, Олег Крамаренко — 095 568 06 04.'
  },
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
    a: 'Тренування проводять Ігор Котляревський та Олег Крамаренко.\n\nІгор Котляревський — 3 дан кіокушинкай, майстер спорту України, призер чемпіонату Європи, абсолютний чемпіон України, з досвідом понад 5 років у спорті та підготовці спортсменів.\n\nОлег Крамаренко — тренер клубу, який працює з дитячими та підлітковими групами, готує спортсменів до змагань і забезпечує системну підготовку відповідно до стандартів кіокушинкай.\n\nУ клубі підготовлені чемпіони та призери України й Європи. Методика поєднує класичну школу кіокушинкай та сучасну фізичну підготовку, з акцентом на дисципліну, техніку та поступовий розвиток спортсмена.'
  },
  {
    q: 'Скільки коштує навчання і що входить у абонемент?',
    a: 'Вартість абонемента — 2500 грн на місяць.\n\nАбонемент включає:\n– регулярні тренування у віковій групі\n– системну фізичну підготовку\n– технічну базу кіокушинкай\n– підготовку до змагань (за рівнем готовності)\n\nПерше тренування — пробне.\nДля занять необхідна базова форма.'
  }
];

const DEFAULT_COACHES = [
  {
    id: 1,
    name: 'Ігор Котляревський',
    role: 'Засновник клубу',
    bio: 'Моя мета — не просто навчити битися, а сформувати характер, який допоможе дитині перемагати в житті.',
    photo: '/coach-igor-personal.jpg',
    achievements: ['3 дан карате Кіокушинкай', 'Майстер спорту України', 'Чемпіон України', 'Призер чемпіонатів Європи']
  },
  {
    id: 2,
    name: 'Олег Крамаренко',
    role: 'Провідний тренер',
    bio: 'Кожне тренування — це перемога над собою. Ми вчимо дітей не здаватися перед труднощами.',
    photo: '',
    achievements: ['10 років тренерської практики', 'Підготовка до змагань', 'Всеукраїнський та міжнародний рівень']
  }
];

const DEFAULT_LOCATIONS = [
  { id: 1, name: 'Шулявка', address: "вул. Сім'ї Бродських, 31/33\nКиїв, 03057 (м. Шулявська)" },
  { id: 2, name: 'Відрадний / Сирець', address: 'вул. Віктора Некрасова, 1-3\nКиїв, 04136' }
];

const DEFAULT_SCHEDULE = [
  { id: 1, location_id: 1, coach_name: 'Ігор Котляревський', day_of_week: 'Пн, Ср, Пт', start_time: '17:00', end_time: '17:40', group_name: 'Молодша група (4–7 років)', price: '2500' },
  { id: 2, location_id: 1, coach_name: 'Ігор Котляревський', day_of_week: 'Пн, Ср, Пт', start_time: '18:30', end_time: '19:30', group_name: 'Середня група (7–12 років)', price: '2500' },
  { id: 3, location_id: 1, coach_name: 'Ігор Котляревський', day_of_week: 'Пн, Ср, Пт', start_time: '19:40', end_time: '21:00', group_name: 'Старша група (12+ років)', price: '2500' },
  { id: 4, location_id: 2, coach_name: 'Олег Крамаренко', day_of_week: 'Пн, Ср, Пт', start_time: '17:30', end_time: '18:30', group_name: 'Середня група (7–9 років)', price: '2500' },
  { id: 5, location_id: 2, coach_name: 'Олег Крамаренко', day_of_week: 'Пн, Ср, Пт', start_time: '18:30', end_time: '19:10', group_name: 'Молодша група (4–6 років)', price: '2500' }
];

const districtOf = (name: string) =>
  /Бродськ|Шуляв/i.test(name) ? 'Шулявка' : /Некрасов|Сирец|Відрадн/i.test(name) ? 'Відрадний / Сирець' : name;

const parseAchievements = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fallthrough */
    }
  }
  return [];
};

const ThankYouOverlay = ({ onBack }: { onBack: () => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-6"
  >
    <div className="w-full max-w-xl space-y-8 text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-600 shadow-[0_0_40px_rgba(209,0,0,0.5)]">
        <CheckCircle2 size={48} className="text-white" />
      </div>
      <div className="space-y-4">
        <h2 className="text-4xl font-black uppercase tracking-tight md:text-5xl">Дякуємо за заявку!</h2>
        <p className="text-lg text-zinc-400">
          Ми отримали ваші дані. Зателефонуємо найближчим часом, щоб підібрати групу, зал і час пробного заняття.
        </p>
      </div>
      <Button variant="secondary" showIcon={false} onClick={onBack}>
        Повернутись на головну
      </Button>
    </div>
  </motion.div>
);

export const MainLanding = ({ initialContent }: { initialContent: any }) => {
  React.useEffect(() => startEngagementTracking('main'), []);
  const location = useLocation();
  const reduce = useReducedMotion();

  const [content, setContent] = useState<any>(initialContent);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const openQuickLead = React.useCallback((ctaName: string) => {
    trackLeadIntent(ctaName, 'main');
    setQuickLeadOpen(true);
  }, []);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(heroProgress, [0, 1], ['0%', '18%']);
  const heroFade = useTransform(heroProgress, [0, 1], [1, 0.15]);

  const clubRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: clubProgress } = useScroll({ target: clubRef, offset: ['start end', 'end start'] });
  const clubY = useTransform(clubProgress, [0, 1], ['-8%', '8%']);

  useEffect(() => {
    const apply = (data: any) => {
      if (data.content) setContent(data.content);
      if (Array.isArray(data.coaches)) setCoaches(data.coaches);
      if (Array.isArray(data.locations)) setLocations(data.locations);
      if (Array.isArray(data.schedule)) setSchedule(data.schedule);
    };
    const cached = sessionStorage.getItem('site_init_data');
    if (cached) {
      try {
        apply(JSON.parse(cached));
      } catch (e) {
        console.error('Error parsing cached data', e);
      }
    }
    const controller = new AbortController();
    fetch('/api/init', { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          apply(data);
          sessionStorage.setItem('site_init_data', JSON.stringify(data));
        }
      })
      .catch(err => {
        if (err?.name !== 'AbortError') console.error('Init fetch failed', err);
      });
    return () => controller.abort();
  }, []);

  // Перехід за якорем з інших сторінок (/#schedule)
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.substring(1);
    const el = document.getElementById(id);
    if (!el) return;
    const t = window.setTimeout(() => {
      const top = el.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    }, 600);
    return () => window.clearTimeout(t);
  }, [location.hash, reduce]);

  // Липкий CTA на мобільному — після першого екрана
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = heroRef.current;
      if (!el) return;
      setPastHero(el.getBoundingClientRect().bottom < window.innerHeight - 96);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });

  // Картка тренера з бази доповнюється дефолтами (фото/факти/цитата), якщо поле порожнє
  const allCoaches = React.useMemo(() => {
    const base = coaches.length ? coaches : DEFAULT_COACHES;
    return base.map((c: any) => {
      const d = DEFAULT_COACHES.find(x => /Котляревськ/i.test(c?.name || '') === /Котляревськ/i.test(x.name) && /Крамаренк/i.test(c?.name || '') === /Крамаренк/i.test(x.name));
      const facts = parseAchievements(c?.achievements);
      return {
        ...c,
        role: c?.role || d?.role || '',
        bio: c?.bio || d?.bio || '',
        photo: c?.photo || d?.photo || '',
        achievements: facts.length ? facts : d?.achievements || []
      };
    });
  }, [coaches]);
  const allLocations = React.useMemo(() => {
    const list = locations.length ? [...locations] : [...DEFAULT_LOCATIONS];
    return list.sort((a: any, b: any) => Number(districtOf(b.name) === 'Шулявка') - Number(districtOf(a.name) === 'Шулявка'));
  }, [locations]);
  const allSchedule = schedule.length ? schedule : DEFAULT_SCHEDULE;
  const hidden = (key: string) => content?.[`hide_section_${key}`] === 'true';
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});

  const problems = [
    { icon: <Shield size={22} />, text: content?.modern_problem1 || 'Не вміє постояти за себе' },
    { icon: <Target size={22} />, text: content?.modern_problem2 || 'Має проблеми з концентрацією' },
    { icon: <Zap size={22} />, text: content?.modern_problem3 || 'Швидко здається перед труднощами' },
    { icon: <Users size={22} />, text: content?.modern_problem4 || 'Потребує сильного прикладу для наслідування' }
  ];

  const results = [
    { icon: <Brain size={20} />, title: content?.result1_title || 'Дисципліна', text: content?.result1_text || 'Дитина стає більш організованою та відповідальною.' },
    { icon: <Shield size={20} />, title: content?.result2_title || 'Впевненість', text: content?.result2_text || 'Зникає страх перед труднощами та новими викликами.' },
    { icon: <Trophy size={20} />, title: content?.result3_title || 'Фізична сила', text: content?.result3_text || 'Покращується постава, витривалість та імунітет.' }
  ];

  const directions = [
    { age: '4–7 років', title: content?.dir1_title || 'Перші кроки', desc: content?.dir1_text || 'Розвиток координації, ігрова форма, база дисципліни.', where: 'Шулявка · Сирець', link: '/kids-4-7', badge: 'Популярно', photo: PHOTOS.kids, position: '50% 15%' },
    { age: '7–12 років', title: content?.dir2_title || 'Формування', desc: content?.dir2_text || 'Техніка, фізична підготовка, перші змагання.', where: 'Шулявка · Сирець', link: '/juniors-7-12', photo: PHOTOS.juniors, position: '50% 5%' },
    { age: 'Підлітки 12+', title: content?.dir3_title || 'Впевненість', desc: content?.dir3_text || 'Професійні турніри, самооборона та лідерство.', where: 'Шулявка · Сирець', link: '/teens-12-plus', photo: PHOTOS.teensPair, position: '50% 20%' },
    { age: 'Карате для дівчат', title: content?.dir4_title || 'Кардіо та техніка', desc: content?.dir4_text || 'Активні тренування, робота руками й ногами, пари та впевненість у русі.', where: 'Шулявка', link: '/women-karate', badge: 'New', photo: PHOTOS.women, position: '50% 12%' },
    { age: 'Персональні', title: content?.dir5_title || 'Формат 1:1', desc: content?.dir5_text || 'Розбір техніки, зручний темп, підготовка до цілі та більше уваги тренера.', where: 'Шулявка · один на один', link: '/personal-training', badge: '1:1', photo: PHOTOS.personal, position: '50% 20%' }
  ];

  const steps = [
    { num: '01', title: content?.how_step1_title || 'Запис', text: content?.how_step1_text || 'Залиште заявку на сайті або зателефонуйте — підберемо групу за віком і зал.' },
    { num: '02', title: content?.how_step2_title || 'Пробне', text: content?.how_step2_text || 'Приходьте на перше безкоштовне заняття. Дитина пробує, ви дивитесь.' },
    { num: '03', title: content?.how_step3_title || 'Результат', text: content?.how_step3_text || 'Регулярні тренування, перший пояс через 4–6 місяців, змагання за бажанням.' }
  ];


  const reviews = [
    { name: 'Олена', text: 'Син став набагато дисциплінованішим вже за перші два місяці. Дуже задоволені підходом тренера.' },
    { name: 'Андрій', text: 'Шукали секцію біля дому. Black Bear Dojo — це професійний рівень, який рідко зустрінеш.' },
    { name: 'Марина', text: 'Донька раніше була дуже сором’язливою. Зараз з радістю біжить на тренування і стала впевненішою.' }
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-red-600 selection:text-white">
      <SEO
        title={PAGE_SEO['/'].title}
        description={PAGE_SEO['/'].description}
        keywords={PAGE_SEO['/'].keywords}
        image={PAGE_SEO['/'].image}
        imageAlt={PAGE_SEO['/'].imageAlt}
        url={`${SITE_URL}/`}
        jsonLd={clubGraph([faqPage(MAIN_FAQ)])}
      />

      <AnimatePresence>{isSubmitted && <ThankYouOverlay onBack={() => setIsSubmitted(false)} />}</AnimatePresence>

      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="fixed top-0 left-0 right-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-red-700 via-red-500 to-red-700"
      />

      <Navbar />

      {/* ---------------------------------------------------------------- *
       * HERO
       * ---------------------------------------------------------------- */}
      <section id="hero" ref={heroRef as any} className="relative flex min-h-[100svh] items-center overflow-hidden pt-28 pb-20">
        <motion.div style={reduce ? undefined : { y: heroY, opacity: heroFade }} className="absolute inset-0 z-0">
          <div className="absolute -left-40 top-1/3 h-[520px] w-[520px] rounded-full bg-red-700/20 blur-[160px]" aria-hidden />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.6) 1px, transparent 1px)',
              backgroundSize: '96px 96px',
              maskImage: 'radial-gradient(ellipse at 30% 40%, black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 30% 40%, black 0%, transparent 70%)'
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />
        </motion.div>

        <motion.span
          aria-hidden
          className="absolute left-6 top-32 hidden w-px origin-top bg-gradient-to-b from-red-600 via-red-600/60 to-transparent lg:left-8 xl:block"
          initial={reduce ? { height: 260 } : { height: 0 }}
          animate={{ height: 260 }}
          transition={{ duration: 1.2, delay: 0.4, ease: EASE }}
        />

        <div className={`${CONTAINER} relative z-10`}>
          <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 xl:gap-16">
            <div className="min-w-0">
              <Reveal y={16}>
                <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-red-600/25 bg-red-600/10 px-4 py-2">
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400">
                    Перше тренування безкоштовно<span className="hidden sm:inline"> · набір у групи 4–7, 7–12, 12+</span>
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                {/* hero_title з адмінки стає H1 (HTML), інакше — SEO-заголовок за замовчуванням */}
                <h1 className="mb-7 text-[clamp(2.5rem,7vw,5.5rem)] font-black uppercase leading-[0.98] tracking-tight md:leading-[0.92]">
                  {content?.hero_title ? (
                    <span dangerouslySetInnerHTML={{ __html: content.hero_title }} />
                  ) : (
                    <>
                      Карате
                      <br />
                      <span className="text-red-600">для дітей</span>
                      <br />
                      у Києві
                    </>
                  )}
                  <span className="mt-3 block text-[0.36em] font-black leading-tight tracking-[0.02em] text-zinc-400">
                    Шулявка · Сирець · Відрадний
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={0.16}>
                <p className="mb-4 text-xl font-black uppercase leading-tight tracking-tight text-white sm:text-2xl md:text-3xl">
                  Формуємо дисципліну, <span className="text-zinc-400">силу та впевненість.</span>
                </p>
                <p className="mb-10 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg md:text-xl">
                  {content?.hero_subtitle ||
                    'Кіокушинкай для дітей з 4 років і підлітків. Тренер — 3 дан, майстер спорту України. Групи до 12 дітей, два зали, вихованці — чемпіони України та Європи.'}
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Button className="sm:whitespace-nowrap" onClick={() => openQuickLead('Hero CTA')}>
                    {content?.hero_button || 'Записатись на безкоштовне'}
                  </Button>
                  <Button variant="secondary" showIcon={false} className="whitespace-nowrap max-sm:hidden" onClick={() => scrollTo('directions')}>
                    Обрати групу
                  </Button>
                  <button
                    type="button"
                    onClick={() => scrollTo('directions')}
                    className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400 underline decoration-red-600 underline-offset-4 sm:hidden"
                  >
                    Обрати групу за віком ↓
                  </button>
                </div>
              </Reveal>

              <Reveal delay={0.32}>
                <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  {['Чемпіони та призери України і Європи', 'Міжнародні турніри', 'Групи до 12 дітей', 'Два зали в Києві'].map(item => (
                    <li key={item} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">
                      <CheckCircle2 size={14} className="shrink-0 text-red-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            <div className="relative lg:ml-auto lg:w-full lg:max-w-[440px] lg:pb-28 xl:max-w-[470px]">
              <motion.div
                className="relative hidden lg:block"
                initial={reduce ? false : { opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.25, ease: EASE }}
              >
                <div className="relative aspect-[4/5] w-full">
                  <div className="pointer-events-none absolute -inset-10 rounded-full bg-red-600/20 blur-[90px]" aria-hidden />
                  <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950">
                    <img
                      src={PHOTOS.hero}
                      alt="Карате для дітей у Києві — тренер Ігор Котляревський з маленьким учнем, Black Bear Dojo"
                      fetchPriority="high"
                      decoding="async"
                      className="h-full w-full object-cover object-[50%_20%]"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/30 to-transparent" aria-hidden />
                    <span aria-hidden className="absolute left-5 top-5 h-7 w-7 border-l-2 border-t-2 border-red-600" />
                    <span aria-hidden className="absolute right-5 top-5 h-7 w-7 border-r-2 border-t-2 border-red-600" />
                    <div className="absolute right-6 top-6 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 backdrop-blur">
                      Black Bear Dojo · з 2015
                    </div>
                  </div>
                </div>
              </motion.div>

              <Reveal delay={0.2} y={32} className="lg:absolute lg:inset-x-5 lg:bottom-0">
                <div className="relative">
                  <div className="absolute -inset-px rounded-[32px] bg-gradient-to-b from-red-600/40 to-transparent" aria-hidden />
                  <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/85 p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl md:p-8 lg:p-6">
                    <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-600/20 blur-3xl" aria-hidden />

                    <div className="relative -mx-7 -mt-7 mb-7 aspect-[4/3] overflow-hidden md:-mx-8 md:-mt-8 lg:hidden">
                      <img
                        src={PHOTOS.hero}
                        alt="Карате для дітей у Києві — тренер з маленьким учнем"
                        fetchPriority="high"
                        decoding="async"
                        className="h-full w-full object-cover object-[50%_25%]"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" aria-hidden />
                      <span aria-hidden className="absolute left-5 top-5 h-6 w-6 border-l-2 border-t-2 border-red-600" />
                      <span aria-hidden className="absolute right-5 top-5 h-6 w-6 border-r-2 border-t-2 border-red-600" />
                    </div>

                    <div className="relative">
                      <div className="mb-5 flex flex-wrap items-center gap-3 lg:mb-3">
                        <span className="inline-flex rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                          З 4 років
                        </span>
                        <span className={`${EYEBROW} text-[10px]`}>Перше тренування</span>
                      </div>
                      <div className="mb-5 lg:mb-4">
                        <span className="block text-4xl font-black uppercase leading-none tracking-tight text-red-600 md:text-5xl lg:text-4xl">
                          Безкоштовно
                        </span>
                        <span className="mt-2 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-300">
                          Далі — 2500 грн/міс · без зобовʼязань
                        </span>
                      </div>
                      <p className={`${BODY} mb-7 border-b ${HAIRLINE} pb-7 text-sm lg:hidden`}>
                        Підберемо групу за віком: 4–7, 7–12 або 12+. Кімоно на перший раз не потрібне.
                      </p>
                      <Button className="w-full" onClick={() => openQuickLead('Hero CTA')}>
                        Записатись на безкоштовне
                      </Button>
                      <p className="mt-5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 lg:mt-3 lg:text-[10px]">
                        Зателефонуємо і підберемо групу
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {!reduce && (
          <motion.button
            type="button"
            aria-label="Прокрутити далі"
            onClick={() => scrollTo('directions')}
            className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 text-zinc-600 transition-colors hover:text-white lg:block"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown size={26} />
          </motion.button>
        )}
      </section>

      {/* ---------------------------------------------------------------- *
       * НАПРЯМИ — картки з фото для кожного віку
       * ---------------------------------------------------------------- */}
      {!hidden('directions') && (
        <>
          <Divider />
          <section id="directions" className={`${SECTION_Y} bg-zinc-950`}>
            <div className={CONTAINER}>
              <SectionHeading eyebrow="Оберіть групу за віком">
                {content?.directions_title || (
                  <>
                    Секція карате <Mark>для кожного віку</Mark>
                  </>
                )}
              </SectionHeading>

              {[
                { label: 'Дитячі групи', items: directions.slice(0, 3), cols: 'md:grid-cols-3', aspect: 'aspect-[16/10] md:aspect-[3/4]' },
                { label: 'Для дорослих', items: directions.slice(3), cols: 'md:grid-cols-2', aspect: 'aspect-[16/10]' }
              ].map(group => (
                <div key={group.label} className="mb-10 last:mb-0">
                  <Reveal>
                    <p className="mb-5 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                      <span className="h-px w-8 bg-red-600" aria-hidden />
                      {group.label}
                    </p>
                  </Reveal>
                  <div className={`grid gap-4 ${group.cols} md:gap-5`}>
                    {group.items.map((d, i) => (
                      <Reveal key={d.link} delay={0.08 * i}>
                        <Link to={d.link} className={`group relative block ${group.aspect} overflow-hidden rounded-[28px] border border-white/10 bg-black transition-colors duration-500 hover:border-red-600/50 md:rounded-[32px]`}>
                          <img
                            src={d.photo}
                            alt={`${d.age} — ${d.title}, карате Black Bear Dojo`}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                            style={{ objectPosition: d.position }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" aria-hidden />
                          {d.badge && (
                            <span className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white">
                              {d.badge}
                            </span>
                          )}
                          <span aria-hidden className="absolute left-5 top-5 h-6 w-6 border-l-2 border-t-2 border-red-600/80" />
                          <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-red-500">{d.age}</span>
                            <span className="block text-2xl font-black uppercase leading-tight tracking-tight text-white">{d.title}</span>
                            <span className="mt-2 block max-w-sm text-sm font-medium leading-relaxed text-zinc-400">{d.desc}</span>
                            <span className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                              <span className="flex items-center gap-2">
                                <MapPin size={12} className="text-red-600" />
                                <span className="text-white">{d.where}</span>
                              </span>
                              <ChevronRight size={16} className="text-red-600 transition-transform group-hover:translate-x-1" />
                            </span>
                          </div>
                        </Link>
                      </Reveal>
                    ))}
                  </div>
                </div>
              ))}

              <Reveal delay={0.3}>
                <div className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-4 text-center md:mt-16">
                  <Button onClick={() => openQuickLead('Directions CTA')}>Записатись на безкоштовне</Button>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    {content?.directions_subtitle || 'Не знаєте, яка група — підберемо на дзвінку'}
                  </p>
                </div>
              </Reveal>
            </div>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------------- *
       * ПРОБЛЕМА — чому батьки обирають карате
       * ---------------------------------------------------------------- */}
      {!hidden('problem') && (
        <>
          <Divider />
          <section id="pains" className={`${SECTION_Y} bg-black`}>
            <div className={CONTAINER}>
              <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
                <div>
                  <Reveal>
                    <Eyebrow>{content?.modern_label || 'Чому батьки обирають карате для дитини'}</Eyebrow>
                    {content?.modern_title ? (
                      <h2 className={`${H2} mb-8`} dangerouslySetInnerHTML={{ __html: content.modern_title }} />
                    ) : (
                      <h2 className={`${H2} mb-8`}>
                        Дитина забагато часу <Mark>в гаджетах?</Mark>
                      </h2>
                    )}
                    <p className={`${BODY} mb-8 max-w-xl text-base`}>
                      {content?.modern_description ||
                        'Сучасний світ пропонує дітям пасивний відпочинок, що веде до слабкої дисципліни, невпевненості та відсутності фізичної активності. Батьки часто стикаються з тим, що дитина:'}
                    </p>
                  </Reveal>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {problems.map((p, i) => (
                      <Reveal key={p.text} delay={0.08 * i}>
                        <li className={`${CARD} group flex items-center gap-4 p-5 transition-colors duration-500 hover:border-red-600/40`}>
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600/10 text-red-600 transition-transform duration-500 group-hover:scale-110">
                            {p.icon}
                          </span>
                          <span className="text-[15px] font-bold leading-snug text-white">{p.text}</span>
                        </li>
                      </Reveal>
                    ))}
                  </ul>
                </div>

                <PhotoReveal
                  src={PHOTOS.kidsShape}
                  alt="Учні клубу карате Black Bear Dojo на клубній фотосесії"
                  className="w-full max-w-lg lg:max-w-none"
                  imgClassName="aspect-[4/5] scale-[1.05]"
                  position="50% 40%"
                >
                  <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/10 bg-black/70 px-5 py-4 backdrop-blur">
                    <p className="text-sm font-bold italic leading-relaxed text-white">
                      {content?.modern_quote || '«Карате — це не про бійку. Це про перемогу над своєю слабкістю кожного дня.»'}
                    </p>
                  </div>
                </PhotoReveal>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------------- *
       * ЩО ДАЄ КАРАТЕ — результати + чому ми
       * ---------------------------------------------------------------- */}
      {!hidden('transformation') && (
        <>
          <Divider />
          <section id="transformation" className={`${SECTION_Y} relative overflow-hidden bg-zinc-950`}>
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/[0.06] blur-[140px]" aria-hidden />
            <div className={`${CONTAINER} relative z-10`}>
              <SectionHeading eyebrow={content?.transformation_label || 'Що дає дитині карате Кіокушинкай'}>
                {content?.transformation_title || (
                  <>
                    Як карате <Mark>змінює дитину</Mark>
                  </>
                )}
              </SectionHeading>

              <div>
                <div>
                  <Reveal>
                    <p className={`${BODY} mx-auto mb-8 max-w-2xl text-center text-base`}>
                      {content?.transformation_subtitle ||
                        'Ми не просто вчимо техніці — ми формуємо особистість. Через 3 місяці регулярних занять батьки помічають суттєві зміни:'}
                    </p>
                  </Reveal>
                  <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
                    {results.map((r, i) => (
                      <Reveal key={r.title} delay={0.08 * i} className="h-full">
                        <article className={`${CARD} group relative flex h-full flex-col overflow-hidden p-6 transition-colors duration-500 hover:border-red-600/40`}>
                          <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-red-600 to-transparent transition-transform duration-700 group-hover:scale-x-100" />
                          <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600/10 text-red-600">{r.icon}</span>
                          <h3 className={`${H3} mb-2`}>{r.title}</h3>
                          <p className={BODY}>{r.text}</p>
                        </article>
                      </Reveal>
                    ))}
                  </div>
                </div>

                <Reveal delay={0.3}>
                  <div className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-4 text-center">
                    <Button onClick={() => openQuickLead('Results CTA')}>Записатись на безкоштовне</Button>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">Перше тренування безкоштовне · без зобовʼязань</p>
                  </div>
                </Reveal>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------------- *
       * КЛУБ — широкий кадр усього клубу, паралакс
       * ---------------------------------------------------------------- */}
      <section id="about" ref={clubRef as any} className="relative overflow-hidden bg-black">
        <div className="relative min-h-[600px] md:min-h-[720px]">
          <motion.img
            src={PHOTOS.club}
            alt="Black Bear Dojo — увесь клуб карате кіокушинкай на клубній фотосесії, Київ"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover object-[50%_75%]"
            style={reduce ? undefined : { y: clubY }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/85 to-black/20" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" aria-hidden />

          <div className={`${CONTAINER} relative z-10 flex min-h-[720px] items-start pb-[26rem] pt-20 md:min-h-[840px] md:pb-[30rem] md:pt-24`}>
            <div className="grid w-full items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <Reveal>
                  <Eyebrow>Клуб кіокушинкай карате в Києві</Eyebrow>
                  <h2 className="text-3xl font-black uppercase leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
                    {content?.about_title || (
                      <>
                        Дисципліна. Сила. <Mark>Характер.</Mark>
                      </>
                    )}
                  </h2>
                </Reveal>
              </div>
              <div>
                <Reveal delay={0.1}>
                  <div
                    className={`${BODY} mb-8 max-w-md text-base [&_span]:font-bold [&_span]:text-red-500`}
                    dangerouslySetInnerHTML={{
                      __html:
                        content?.about_text ||
                        'Black Bear Dojo — це середовище, де ваша дитина здобуває <span>дисципліну</span> та впевненість. Системні тренування формують міцний характер, повагу до оточуючих та вміння досягати цілей. Розвиток відбувається поступово: від базових навичок до участі у <span>змаганнях</span>.'
                    }}
                  />
                </Reveal>
                <Reveal delay={0.2}>
                  <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-black/60 px-5 py-4 backdrop-blur sm:grid-cols-4 sm:gap-6">
                    {[
                      ['2015', 'рік заснування'],
                      ['10+', 'років у тренерстві'],
                      ['3 дан', 'головний тренер'],
                      ['2', 'зали в Києві']
                    ].map(([v, l]) => (
                      <div key={l}>
                        <dt className="whitespace-nowrap text-2xl font-black leading-none text-white sm:text-3xl md:text-4xl">{v}</dt>
                        <dd className="mt-2 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 sm:text-[10px] sm:tracking-[0.2em]">{l}</dd>
                      </div>
                    ))}
                  </dl>
                </Reveal>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ЯК ПОЧАТИ
       * ---------------------------------------------------------------- */}
      {!hidden('how') && (
        <>
          <Divider />
          <section id="how" className={`${SECTION_Y} bg-zinc-950`}>
            <div className={CONTAINER}>
              <SectionHeading eyebrow="Як записатися на карате в Києві">
                {content?.how_title || (
                  <>
                    Перше тренування — <Mark>три кроки</Mark>
                  </>
                )}
              </SectionHeading>
              <ol className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
                {steps.map((s, i) => (
                  <Reveal key={s.num} delay={i * 0.1} className="h-full">
                    <li className={`${CARD} relative flex h-full flex-col p-8`}>
                      <span className="mb-6 text-5xl font-black leading-none text-red-600/80">{s.num}</span>
                      <h3 className={`${H3} mb-3`}>{s.title}</h3>
                      <p className={BODY}>{s.text}</p>
                    </li>
                  </Reveal>
                ))}
              </ol>
              <Reveal delay={0.3}>
                <div className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-4 text-center">
                  <Button onClick={() => openQuickLead('How CTA')}>Записатись на безкоштовне</Button>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">Без зобовʼязань · зателефонуємо і підберемо групу</p>
                </div>
              </Reveal>
            </div>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------------- *
       * ТРЕНЕРИ
       * ---------------------------------------------------------------- */}
      {!hidden('coaches') && (
        <>
          <Divider />
          <section id="coach" className={`${SECTION_Y} overflow-x-clip bg-zinc-950`}>
            <div className={CONTAINER}>
              <SectionHeading eyebrow={content?.coach_subtitle || 'Тренери з карате'}>
                {content?.coach_title ? <span dangerouslySetInnerHTML={{ __html: content.coach_title }} /> : (
                  <>
                    Тренери, які бачать <Mark>кожного</Mark>
                  </>
                )}
              </SectionHeading>

              <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
                {allCoaches.map((c: any, i: number) => {
                  const photo = typeof c.photo === 'string' && c.photo && !failedPhotos[c.name] ? resizedImage(c.photo.split('?')[0], 800) : null;
                  const facts = parseAchievements(c.achievements);
                  return (
                    <Reveal key={c.id ?? c.name} delay={i * 0.1} className="h-full">
                      <article className={`${CARD} group flex h-full flex-col overflow-hidden`}>
                        <div className={`relative overflow-hidden bg-black ${photo ? 'aspect-[4/3]' : 'h-28 bg-red-600/10'}`}>
                          <div className="absolute inset-0 flex items-center justify-center text-5xl font-black text-red-600/60" aria-hidden>
                            {String(c.name || '?').charAt(0)}
                          </div>
                          {photo && (
                            <img
                              src={photo}
                              alt={`${c.name} — тренер з карате, Black Bear Dojo`}
                              loading="lazy"
                              decoding="async"
                              className="relative h-full w-full object-cover object-[50%_15%] transition-transform duration-[1200ms] group-hover:scale-105"
                              onError={() => setFailedPhotos(prev => ({ ...prev, [c.name]: true }))}
                            />
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-950 to-transparent" aria-hidden />
                          <span aria-hidden className="absolute left-5 top-5 h-6 w-6 border-l-2 border-t-2 border-red-600/80" />
                        </div>
                        <div className="flex flex-1 flex-col p-7">
                          <h3 className="text-2xl font-black uppercase leading-none tracking-tight">{c.name}</h3>
                          <p className="mb-6 mt-2 text-[10px] font-black uppercase tracking-[0.28em] text-red-500">{c.role}</p>
                          <ul className="mb-6 space-y-2.5">
                            {facts.map((f: string) => (
                              <li key={f} className="flex items-start gap-3 text-[15px] font-medium text-zinc-300">
                                <Medal size={16} className="mt-0.5 shrink-0 text-red-600" />
                                {f}
                              </li>
                            ))}
                          </ul>
                          {c.bio && (
                            <figure className={`mt-auto rounded-2xl border ${HAIRLINE} bg-black/40 p-5`}>
                              <Quote size={18} className="mb-2 text-red-600" aria-hidden />
                              <blockquote className="text-sm italic leading-relaxed text-zinc-300">{c.bio}</blockquote>
                            </figure>
                          )}
                        </div>
                      </article>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------------- *
       * РЕЗУЛЬТАТИ КЛУБУ
       * ---------------------------------------------------------------- */}
      {!hidden('results') && (
        <>
          <Divider />
          <section id="results" className={`${SECTION_Y} bg-black`}>
            <div className={CONTAINER}>
              <SectionHeading eyebrow="Результати клубу">
                {content?.results_title || (
                  <>
                    Результати, що підтверджують <Mark>рівень</Mark>
                  </>
                )}
              </SectionHeading>

              <Reveal delay={0.1}>
                <div className="group relative aspect-[4/5] overflow-hidden rounded-[28px] border border-white/10 sm:aspect-[21/9] md:rounded-[32px]">
                  <img
                    src={PHOTOS.teensMedals}
                    alt="Учні Black Bear Dojo з медалями змагань з карате"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover object-[50%_30%] transition-transform duration-[1500ms] group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" aria-hidden />
                  <span aria-hidden className="absolute left-6 top-6 h-7 w-7 border-l-2 border-t-2 border-red-600" />
                  <div className="absolute inset-x-0 bottom-0 p-8 md:p-12">
                    <span className="mb-3 block text-[11px] font-black uppercase tracking-[0.35em] text-zinc-300">{content?.results_image_subtitle || 'Техніка. Фізика. Дисципліна.'}</span>
                    <h3 className="text-3xl font-black uppercase tracking-tight text-white md:text-5xl">
                      {content?.results_image_title || 'Системна підготовка'}
                    </h3>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------------- *
       * РОЗКЛАД
       * ---------------------------------------------------------------- */}
      {!hidden('schedule') && (
        <>
          <Divider />
          <section id="schedule" className={`${SECTION_Y} bg-zinc-950`}>
            <div className={CONTAINER}>
              <SectionHeading eyebrow={content?.schedule_subtitle || 'Зал у безпечному приміщенні — тренування не зупиняється'}>
                {content?.schedule_title || (
                  <>
                    Розклад тренувань: <Mark>Шулявка і Сирець</Mark>
                  </>
                )}
              </SectionHeading>

              <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
                {allLocations.map((loc: any, i: number) => {
                  const rows = allSchedule.filter((s: any) => String(s.location_id) === String(loc.id));
                  return (
                    <Reveal key={loc.id ?? loc.name} delay={i * 0.1} className="h-full">
                      <article className={`${CARD} group flex h-full flex-col p-7 transition-colors duration-500 hover:border-red-600/40 md:p-8`}>
                        <div className="mb-6 flex items-center gap-4">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600/10 text-red-600 transition-colors duration-300 group-hover:bg-red-600 group-hover:text-white">
                            <MapPin size={20} />
                          </span>
                          <div>
                            <h3 className="text-xl font-black uppercase tracking-tight md:text-2xl">{districtOf(loc.name)}</h3>
                            <p className="text-sm font-medium text-zinc-500">{String(loc.address || '').split('\n')[0]}</p>
                          </div>
                        </div>

                        {rows.length ? (
                          <ul className={`divide-y ${HAIRLINE} border-y ${HAIRLINE}`}>
                            {rows.map((r: any, k: number) => (
                              <li key={r.id ?? k} className="flex flex-col gap-1.5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <span>
                                  <span className="block text-sm font-black uppercase tracking-tight text-white">{r.group_name}</span>
                                  <span className="block text-xs font-medium text-zinc-500">
                                    {r.coach_name}
                                    {r.price ? ` · ${r.price} грн/міс` : ''}
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-red-500">
                                  <Clock size={13} />
                                  {r.day_of_week} · {r.start_time}–{r.end_time}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className={BODY}>Розклад уточнюємо після заявки.</p>
                        )}

                        <div className="mt-auto pt-6">
                          <Button className="w-full" onClick={() => openQuickLead(`Schedule CTA ${districtOf(loc.name)}`)}>
                            Записатись на безкоштовне
                          </Button>
                        </div>
                      </article>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------------- *
       * ВІДГУКИ
       * ---------------------------------------------------------------- */}
      {!hidden('reviews') && (
        <>
          <Divider />
          <section id="reviews" className={`${SECTION_Y} bg-black`}>
            <div className={CONTAINER}>
              <SectionHeading eyebrow={content?.reviews_subtitle || 'Що кажуть батьки'}>
                {content?.reviews_title || (
                  <>
                    Відгуки батьків про <Mark>дитяче карате</Mark>
                  </>
                )}
              </SectionHeading>
              <div className="grid gap-5 md:grid-cols-3">
                {reviews.map((r, i) => (
                  <Reveal key={r.name} delay={0.08 * i} className="h-full">
                    <figure className={`${CARD} relative flex h-full flex-col p-7`}>
                      <Quote className="absolute right-6 top-6 h-12 w-12 text-red-600/15" aria-hidden />
                      <div className="mb-5 flex gap-1">
                        {[1, 2, 3, 4, 5].map(k => (
                          <Star key={k} size={14} className="fill-red-600 text-red-600" />
                        ))}
                      </div>
                      <blockquote className="mb-6 text-[15px] italic leading-relaxed text-zinc-300">«{r.text}»</blockquote>
                      <figcaption className="mt-auto flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-base font-black text-red-500" aria-hidden>
                          {r.name.charAt(0)}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-widest text-white">{r.name}</span>
                      </figcaption>
                    </figure>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------------- *
       * FAQ
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="faq" className={`${SECTION_Y} bg-zinc-950`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow={content?.faq_subtitle || 'Відповідаємо на головні питання батьків'}>
            {content?.faq_title || (
              <>
                Часті <Mark>запитання</Mark>
              </>
            )}
          </SectionHeading>
          <div className="mx-auto max-w-3xl space-y-3">
            {MAIN_FAQ.map((item, i) => (
              <Reveal key={item.q} delay={i * 0.05}>
                <details
                  open={i === 0 || undefined}
                  className={`group overflow-hidden rounded-3xl border ${HAIRLINE} bg-zinc-900/40 transition-colors duration-300 hover:border-red-600/30 open:border-red-600/30`}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 p-6 [&::-webkit-details-marker]:hidden">
                    <span className="text-[15px] font-black uppercase leading-snug tracking-tight text-white">{item.q}</span>
                    <ChevronDown size={20} className="shrink-0 text-red-600 transition-transform duration-300 group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className={`${BODY} whitespace-pre-line px-6 pb-6`}>{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ЕНЦИКЛОПЕДІЯ — компактно, для авторитету і SEO
       * ---------------------------------------------------------------- */}
      <section id="manual" className="bg-zinc-950 pb-20 md:pb-28">
        <div className={CONTAINER}>
          <Reveal>
            <div className={`${CARD} mx-auto flex max-w-3xl flex-col items-start gap-6 p-7 sm:flex-row sm:items-center md:p-8`}>
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-600/20 bg-red-600/10 text-red-500">
                <BookOpen size={26} />
              </span>
              <div className="flex-1">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
                  {content?.encyclopedia_main_label || 'Нормативи на пояси Кіокушинкай'}
                </span>
                <h3 className={`${H3} mb-2`}>Нормативи, словник, історія — онлайн-енциклопедія</h3>
                <p className={`${BODY} text-sm`}>
                  {content?.encyclopedia_main_description ||
                    'Для учнів та батьків: від історії засновника до детальних вимог на кожен пояс.'}
                </p>
              </div>
              <Link
                to="/encyclopedia"
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.03] px-6 text-[12px] font-black uppercase tracking-[0.12em] text-white transition-all duration-300 hover:border-white/35 hover:bg-white/[0.08]"
              >
                Відкрити
                <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ЗАЯВКА
       * ---------------------------------------------------------------- */}
      <ContactForm
        locations={allLocations}
        title={content?.contact_title || 'Готові виховати чемпіона?'}
        subtitle={content?.contact_subtitle || 'Перше тренування — безкоштовно. Залиште імʼя і номер — зателефонуємо, підберемо групу за віком, зал і зручний час.'}
        source="main"
        submitLabel="Записати безкоштовно"
        onSuccess={() => {
          setIsSubmitted(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        offerNote={
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600">
              <Star className="text-white" size={21} />
            </span>
            <span>
              <span className="mb-1 block text-sm font-black uppercase tracking-tight text-white">Перше тренування — безкоштовно</span>
              <span className="block text-xs font-medium leading-relaxed text-zinc-400">Далі — абонемент 2500 грн/міс · групи 4–7, 7–12, 12+ · без зобовʼязань</span>
            </span>
          </div>
        }
      />

      {/* ---------------------------------------------------------------- *
       * FOOTER
       * ---------------------------------------------------------------- */}
      <footer className={`border-t ${HAIRLINE} bg-black pt-12 pb-28 md:pb-12`}>
        <div className={`${CONTAINER} flex flex-col items-center justify-between gap-7 md:flex-row`}>
          <BrandLogo size="sm" />
          <div className="flex items-center gap-6">
            <a href={content?.social_instagram || 'https://instagram.com/karate_kyiv'} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-zinc-500 transition-colors hover:text-white">
              <Instagram size={19} />
            </a>
            <a href={content?.social_facebook || 'https://www.facebook.com/karatee.kyiv/'} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-zinc-500 transition-colors hover:text-white">
              <Facebook size={19} />
            </a>
            <Link to="/register-member" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-red-500">
              Реєстрація
            </Link>
          </div>
          <p className="max-w-xs text-center text-[10px] font-medium leading-relaxed text-zinc-600 md:text-right">
            Black Bear Dojo — секція карате Кіокушинкай для дітей та дорослих у Києві: Шулявка, Сирець, Відрадний.
            <span className="mt-1 block font-black uppercase tracking-[0.18em] text-zinc-500">© 2026 Black Bear Dojo</span>
          </p>
        </div>
      </footer>

      <QuickLeadModal open={quickLeadOpen} onClose={() => setQuickLeadOpen(false)} source="main" locations={allLocations} />

      <div className="fixed inset-x-4 bottom-4 z-50 md:hidden">
        <motion.button
          type="button"
          initial={false}
          animate={{ y: pastHero ? 0 : 120, opacity: pastHero ? 1 : 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          whileTap={{ scale: 0.97 }}
          aria-hidden={!pastHero}
          tabIndex={pastHero ? 0 : -1}
          onClick={() => openQuickLead('Mobile Sticky CTA')}
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-[#D10000] to-[#A80000] text-[13px] font-black uppercase tracking-[0.12em] text-white shadow-[0_16px_40px_-10px_rgba(209,0,0,0.8)]"
        >
          <Send size={17} />
          Записатись на безкоштовне
        </motion.button>
      </div>
    </div>
  );
};
