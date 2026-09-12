import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useSpring, useReducedMotion, useTransform } from 'motion/react';
import { Navbar } from './components/Navbar';
import {
  Shield,
  Users,
  Clock,
  MapPin,
  ChevronDown,
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
  Medal
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO, { SITE_URL } from './components/SEO';
import { PAGE_SEO } from './lib/seoPages';
import { clubGraph, courseOffer, faqPage } from './lib/structuredData';
import { startEngagementTracking } from './lib/engagement';
import { resizedImage } from './lib/images';
import { ContactForm } from './components/ContactForm';
import { QuickLeadModal } from './components/QuickLeadModal';
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
  PhotoReveal,
  GalleryStrip,
  type GalleryShot
} from './components/landing-ui';

/** Фото з клубної фотосесії — молодша група. WebP ≤110 КБ, public/kids/. */
const PHOTOS = {
  hero: '/kids/hero-boy-smile.webp',
  playful: '/kids/boy-playful.webp',
  kick: '/kids/kid-kick.webp',
  split: '/kids/kid-split.webp',
  medals: '/kids/boy-medals.webp',
  group: '/kids/group-kids.webp',
  belt: '/kids/first-belt.webp',
  teaching: '/kids/coach-teaching.webp',
  coachKid: '/kids/coach-kid.webp'
};

/** Одна група на сторінці — селект не потрібен, поле йде прихованим */
const KIDS_GROUPS = [{ value: '4-7 років', label: 'Молодша група (4–7 років)' }];

/** Розклад молодших груп, якщо /api/init не віддав свій */
const DEFAULT_KIDS_SCHEDULE = [
  { location_id: 1, day_of_week: 'Пн, Ср, Пт', start_time: '17:00', end_time: '17:40', group_name: 'Нова група (4–7 років)', coach_name: 'Ігор Котляревський', price: '2500' },
  { location_id: 1, day_of_week: 'Пн, Ср, Пт', start_time: '17:40', end_time: '18:20', group_name: 'Молодша група (4–7 років)', coach_name: 'Ігор Котляревський', price: '2500' },
  { location_id: 1, day_of_week: 'Вт, Чт', start_time: '17:20', end_time: '18:00', group_name: 'Нова група (4–7 років)', coach_name: 'Ігор Котляревський', price: '2500' },
  { location_id: 1, day_of_week: 'Вт, Чт', start_time: '18:10', end_time: '18:50', group_name: 'Молодша група (4–7 років)', coach_name: 'Ігор Котляревський', price: '2500' },
  { location_id: 2, day_of_week: 'Пн, Ср, Пт', start_time: '17:00', end_time: '18:00', group_name: 'Група (5–7 років)', coach_name: 'Олег Крамаренко', price: '2500' }
];

const DEFAULT_LOCATIONS = [
  { id: 1, name: 'Шулявка', address: "вул. Сім'ї Бродських, 31/33\nКиїв, 03057 (м. Шулявська)" },
  { id: 2, name: 'Відрадний / Сирець', address: 'вул. Віктора Некрасова, 1-3\nКиїв, 04136' }
];

/** Назва залу для батьків — район, а не вулиця (вулиця йде підписом) */
const districtOf = (name: string) =>
  /Бродськ|Шуляв/i.test(name) ? 'Шулявка' : /Некрасов|Сирец|Відрадн/i.test(name) ? 'Відрадний / Сирець' : name;

/** Молодша група = 4–7. Ловимо і «Молодша», і «4–7», і «5–7» у назві */
const isKidsGroup = (name: string) => /молодш|нова|4\s*[–-]\s*7|5\s*[–-]\s*7/i.test(name || '');

const KIDS_FAQ = [
  {
    q: 'З якого віку беруть у групу карате?',
    a: 'З 4 років. Перші місяці — ігрова підготовка: координація, рівновага, вміння слухати тренера. Дитина звикає до залу і до групи, а не до навантаження.'
  },
  {
    q: 'Чи безпечні тренування для дитини 4–7 років?',
    a: 'Так. Навантаження — поступове, контактні елементи вводяться поетапно і лише під контролем тренера. Пріоритет у молодшій групі — техніка, координація, самоконтроль і правильна фізична база.'
  },
  {
    q: 'Як проходять тренування під час повітряної тривоги?',
    a: 'Зал у безпечному приміщенні — тренування не зупиняється. Якщо є питання щодо конкретної локації, зателефонуйте тренеру перед записом: Ігор Котляревський — 095 475 65 00, Олег Крамаренко — 095 568 06 04.'
  },
  {
    q: 'Дитина сором’язлива або фізично слабка — чи підійде карате?',
    a: 'Так. Більшість дітей приходять без підготовки. Початковий етап спрямований на адаптацію, координацію та впевненість; далі поступово зростає витривалість і сила. Навчання будується від простого до складного.'
  },
  {
    q: 'Які результати дає карате через 3–6 місяців?',
    a: 'За умови регулярних тренувань: краща дисципліна та самоконтроль, впевненість у собі, фізична витривалість, повага до старших і однолітків, менше гаджетів. Результат напряму залежить від системності відвідування.'
  },
  {
    q: 'Скільки коштує і що входить в абонемент?',
    a: 'Перше тренування — безкоштовне. Абонемент — 2500 грн на місяць: регулярні тренування у віковій групі, системна фізична підготовка, технічна база кіокушинкай, підготовка до змагань за рівнем готовності.'
  },
  {
    q: 'Що взяти на перше тренування?',
    a: 'Зручний спортивний одяг і воду. Кімоно (догі) на перше заняття не потрібне — з вибором допоможемо, коли дитина вирішить лишитися.'
  }
];

export const KidsLanding = () => {
  // Поведінка відвідувача: секції, час, глибина скролу, точка виходу
  React.useEffect(() => startEngagementTracking('kids'), []);
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const openQuickLead = React.useCallback((ctaName: string) => {
    trackLeadIntent(ctaName, 'kids');
    setQuickLeadOpen(true);
  }, []);
  const [locations, setLocations] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [content, setContent] = useState<any>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(heroProgress, [0, 1], ['0%', '18%']);
  const heroFade = useTransform(heroProgress, [0, 1], [1, 0.15]);

  const groupRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: groupProgress } = useScroll({ target: groupRef, offset: ['start end', 'end start'] });
  const groupY = useTransform(groupProgress, [0, 1], ['-8%', '8%']);

  useEffect(() => {
    const apply = (data: any) => {
      if (Array.isArray(data.locations)) setLocations(data.locations);
      if (Array.isArray(data.schedule)) setSchedule(data.schedule);
      if (Array.isArray(data.coaches)) setCoaches(data.coaches);
      if (data.content) setContent(data.content);
    };
    const cachedData = sessionStorage.getItem('site_init_data');
    if (cachedData) {
      try {
        apply(JSON.parse(cachedData));
      } catch (e) {
        console.error('Error parsing cached data', e);
      }
    }
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          apply(data);
          sessionStorage.setItem('site_init_data', JSON.stringify(data));
        }
      })
      .catch(err => console.error('Error fetching init data:', err));
  }, []);

  // Липкий CTA на мобільному — лише після першого екрана (там уже є кнопки й картка)
  // Фото тренера з бази може бути відсутнє (404) — тоді картка без порожнього блоку
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
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

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });

  // Шулявка — першою: там веде засновник і найбільше молодших груп
  const allLocations = React.useMemo(() => {
    const list = locations.length ? [...locations] : [...DEFAULT_LOCATIONS];
    return list.sort((a: any, b: any) => Number(districtOf(b.name) === 'Шулявка') - Number(districtOf(a.name) === 'Шулявка'));
  }, [locations]);
  const kidsSchedule = React.useMemo(() => {
    const own = schedule.filter((s: any) => isKidsGroup(s?.group_name));
    return own.length ? own : DEFAULT_KIDS_SCHEDULE;
  }, [schedule]);

  const pains = [
    {
      icon: <Zap size={22} />,
      title: 'Енергії забагато',
      desc: 'Дитина не може всидіти, вдома все догори дриґом. Карате дає цій енергії напрямок: рух — за правилами, з результатом.'
    },
    {
      icon: <Target size={22} />,
      title: 'Не слухає, не зосереджується',
      desc: 'На тренуванні дитина вчиться чути тренера, тримати увагу і доводити вправу до кінця — навичка, яка потім працює в садочку і школі.'
    },
    {
      icon: <Shield size={22} />,
      title: 'Соромиться і боїться за себе',
      desc: 'У групі однолітків, з поступовим навантаженням дитина звикає, що вона може. Впевненість росте з кожним новим рухом.'
    },
    {
      icon: <Heart size={22} />,
      title: 'Гаджети замість руху',
      desc: 'Три тренування на тиждень — це постава, координація і витривалість замість екрана. І звичка рухатись, яка лишається.'
    }
  ];

  const advantages = [
    {
      title: 'Офіційна федерація',
      desc: 'Клуб — частина WKO Shinkyokushinkai. Іспити на пояси і сертифікати — міжнародного зразка.',
      icon: <Shield size={22} />
    },
    {
      title: 'Мʼяка адаптація',
      desc: 'Перші два місяці — ігрова підготовка. Дитина не боїться залу, а біжить на тренування як на свято.',
      icon: <Smile size={22} />
    },
    {
      title: 'Безпека та гігієна',
      desc: 'Професійне татамі з амортизацією, регулярна дезінфекція залу. Зал у безпечному приміщенні — тренування не зупиняється.',
      icon: <CheckCircle2 size={22} />
    },
    {
      title: 'Малі групи — до 12 дітей',
      desc: 'Тренер бачить кожного. Не «масовка», а результат конкретної дитини.',
      icon: <Users size={22} />
    }
  ];

  const gallery: GalleryShot[] = [
    {
      src: PHOTOS.kick,
      alt: 'Дитина 6 років виконує удар ногою — координація на тренуванні з карате',
      position: '50% 25%',
      zoom: 'scale-[1.25] origin-[62%_40%] group-hover:scale-[1.3]',
      tag: 'Координація',
      title: 'Стійка, удар, рівновага',
      desc: 'Тіло вчиться слухатися: правильна стійка, точний рух, контроль.'
    },
    {
      src: PHOTOS.split,
      alt: 'Дитина сидить на шпагаті — гнучкість у молодшій групі карате',
      position: '50% 50%',
      zoom: 'scale-[1.45] origin-[50%_42%] group-hover:scale-[1.5]',
      tag: 'Гнучкість',
      title: 'Розтяжка без сліз',
      desc: 'Поступово, через гру — і за кілька місяців шпагат стає нормою.'
    },
    {
      src: PHOTOS.medals,
      alt: 'Хлопчик 6 років з медалями змагань з карате, Black Bear Dojo',
      position: '50% 15%',
      tag: 'Перші перемоги',
      title: 'Медалі — за працю',
      desc: 'Змагання — за бажанням і готовністю. Гордість за себе — у кожного.'
    }
  ];

  const steps = [
    { num: '01', title: 'Заявка і дзвінок', desc: 'Залишаєте імʼя та номер. Підбираємо групу і зал, де дитині буде комфортно за рівнем.' },
    { num: '02', title: 'Безкоштовне перше тренування', desc: 'Дитина пробує, ви спостерігаєте за атмосферою та підходом тренера. Без зобовʼязань.' },
    { num: '03', title: 'Форма і група', desc: 'Допомагаємо підібрати перше догі (кімоно) — символ нового етапу. Дитина стає частиною групи.' },
    { num: '04', title: 'Перший пояс', desc: 'Через 4–6 місяців регулярних тренувань — перший іспит і офіційний сертифікат.' }
  ];

  const privileges = [
    { title: 'Сімейна знижка', desc: '−20% на другу дитину з однієї сімʼї.' },
    { title: 'Літні табори', desc: 'Щорічні виїзди на природу — оздоровлення і друзі поза залом.' },
    { title: 'Щоденник успіху', desc: 'Система мотивації за старанність — дитина бачить свій прогрес.' },
    { title: 'Відкриті уроки', desc: 'Раз на квартал ви особисто бачите, що вміє дитина.' }
  ];

  const coachCards = React.useMemo(() => {
    const byName = (re: RegExp) => coaches.find((c: any) => re.test(c?.name || ''));
    const ihor = byName(/Котляревськ/i);
    const oleh = byName(/Крамаренк/i);
    return [
      {
        name: ihor?.name || 'Ігор Котляревський',
        role: 'Шулявка · засновник клубу',
        photo: PHOTOS.coachKid,
        position: '50% 20%',
        facts: ['3 дан кіокушинкай', 'Майстер спорту України', '27 років у карате']
      },
      {
        name: oleh?.name || 'Олег Крамаренко',
        role: 'Відрадний / Сирець',
        // у базі фото тренера може лежати і як /api/images/coaches/:id, і як /api/images/:id — беремо шлях з картки
        photo: typeof oleh?.photo === 'string' && oleh.photo ? resizedImage(oleh.photo.split('?')[0], 800) : null,
        position: '50% 15%',
        facts: ['Дитячі та підліткові групи', 'Підготовка до змагань', 'Стандарти кіокушинкай']
      }
    ];
  }, [coaches]);

  const heroTitle = content?.kids_hero_title as string | undefined;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-red-600 selection:text-white">
      <SEO
        title={content?.kids_seo_title || PAGE_SEO['/kids-4-7'].title}
        description={content?.kids_seo_description || PAGE_SEO['/kids-4-7'].description}
        keywords={content?.kids_seo_keywords || PAGE_SEO['/kids-4-7'].keywords}
        image={PAGE_SEO['/kids-4-7'].image}
        imageAlt={PAGE_SEO['/kids-4-7'].imageAlt}
        url={`${SITE_URL}/kids-4-7`}
        jsonLd={clubGraph([
          courseOffer({
            name: 'Карате для дітей 4–7 років',
            description: 'Молодша група Кіокушинкай карате: ігрова адаптація, координація, дисципліна, групи до 12 дітей.',
            url: `${SITE_URL}/kids-4-7`,
            ageRange: '4-7'
          }),
          faqPage(KIDS_FAQ)
        ])}
      />

      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="fixed top-0 left-0 right-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-red-700 via-red-500 to-red-700"
      />

      <Navbar />

      {/* ---------------------------------------------------------------- *
       * HERO — фото дитини з фотосесії + офер «перше безкоштовно»
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
            <div>
              <Reveal y={16}>
                <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-red-600/25 bg-red-600/10 px-4 py-2">
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400">
                    Набір у групу 4–7 років<span className="hidden sm:inline"> · перше тренування безкоштовно</span>
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                {heroTitle ? (
                  <h1
                    className="mb-7 text-[clamp(2.5rem,7vw,5.5rem)] font-black uppercase leading-[0.98] tracking-tight md:leading-[0.92]"
                    dangerouslySetInnerHTML={{ __html: heroTitle }}
                  />
                ) : (
                  <h1 className="mb-7 text-[clamp(2.5rem,7vw,5.5rem)] font-black uppercase leading-[0.98] tracking-tight md:leading-[0.92]">
                    Карате
                    <br />
                    <span className="text-red-600">для дітей</span>
                    <br />
                    4–7 років
                    <span className="mt-3 block text-[0.36em] font-black leading-tight tracking-[0.02em] text-zinc-400">
                      у Києві · Шулявка · Сирець
                    </span>
                  </h1>
                )}
              </Reveal>

              <Reveal delay={0.16}>
                <p className="mb-10 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg md:text-xl">
                  Дисципліна, координація і впевненість — через гру, а не через крик. Малі групи до 12 дітей,
                  тренер бачить кожного. <span className="text-white">Перше тренування — безкоштовно.</span>
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Button className="whitespace-nowrap" onClick={() => openQuickLead('Hero CTA')}>
                    Записати на безкоштовне
                  </Button>
                  <Button variant="secondary" showIcon={false} className="whitespace-nowrap max-sm:hidden" onClick={() => scrollTo('path')}>
                    Як це працює
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={0.32}>
                <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  {['Від 4 років', 'Групи до 12 дітей', 'Два зали в Києві', 'Тренер — 3 дан', 'WKO Shinkyokushinkai'].map(item => (
                    <li key={item} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">
                      <CheckCircle2 size={14} className="shrink-0 text-red-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            {/* Права колонка — фото + офер-картка поверх */}
            <div className="relative lg:ml-auto lg:w-full lg:max-w-[440px] lg:pb-20 xl:max-w-[470px]">
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
                      alt="Карате для дітей 4–7 років у Києві — усміхнений хлопчик у кімоно, Black Bear Dojo"
                      fetchPriority="high"
                      decoding="async"
                      className="h-full w-full object-cover object-[50%_10%]"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/30 to-transparent" aria-hidden />
                    <span aria-hidden className="absolute left-5 top-5 h-7 w-7 border-l-2 border-t-2 border-red-600" />
                    <span aria-hidden className="absolute right-5 top-5 h-7 w-7 border-r-2 border-t-2 border-red-600" />
                    <div className="absolute right-6 top-6 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 backdrop-blur">
                      Молодша група · Black Bear Dojo
                    </div>
                  </div>
                </div>
              </motion.div>

              <Reveal delay={0.2} y={32} className="lg:absolute lg:inset-x-5 lg:bottom-0">
                <div className="relative">
                  <div className="absolute -inset-px rounded-[32px] bg-gradient-to-b from-red-600/40 to-transparent" aria-hidden />
                  <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/85 p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl md:p-8 lg:p-6">
                    <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-600/20 blur-3xl" aria-hidden />

                    <div className="relative -mx-7 -mt-7 mb-7 aspect-[16/11] overflow-hidden md:-mx-8 md:-mt-8 lg:hidden">
                      <img
                        src={PHOTOS.hero}
                        alt="Карате для дітей 4–7 років у Києві — усміхнений хлопчик у кімоно"
                        fetchPriority="high"
                        decoding="async"
                        className="h-full w-full object-cover object-[50%_22%]"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" aria-hidden />
                      <span aria-hidden className="absolute left-5 top-5 h-6 w-6 border-l-2 border-t-2 border-red-600" />
                      <span aria-hidden className="absolute right-5 top-5 h-6 w-6 border-r-2 border-t-2 border-red-600" />
                    </div>

                    <div className="relative">
                      <div className="mb-5 flex flex-wrap items-center gap-3 lg:mb-3">
                        <span className="inline-flex rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                          4–7 років
                        </span>
                        <span className={`${EYEBROW} text-[10px]`}>Перше тренування</span>
                      </div>

                      <div className="mb-5 lg:mb-4">
                        <span className="block text-4xl font-black uppercase leading-none tracking-tight text-red-600 md:text-5xl lg:text-4xl">
                          Безкоштовно
                        </span>
                        <span className="mt-2 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-300">
                          Далі — абонемент 2500 грн/міс · без зобовʼязань
                        </span>
                      </div>

                      <p className={`${BODY} mb-7 border-b ${HAIRLINE} pb-7 text-sm lg:hidden`}>
                        Дитина пробує, ви дивитесь. Без зобовʼязань і без кімоно на перший раз — лише зручний одяг.
                      </p>

                      <Button className="w-full" onClick={() => openQuickLead('Hero CTA')}>
                        Записати на безкоштовне
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
            onClick={() => scrollTo('pains')}
            className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 text-zinc-600 transition-colors hover:text-white lg:block"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown size={26} />
          </motion.button>
        )}
      </section>

      {/* ---------------------------------------------------------------- *
       * БОЛІ БАТЬКІВ
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="pains" className={`${SECTION_Y} bg-zinc-950`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Знайомо?">
            Коли енергії багато, а <Mark>напрямку</Mark> немає
          </SectionHeading>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pains.map((pain, i) => (
              <Reveal key={pain.title} delay={i * 0.08} className="h-full">
                <article className={`${CARD} group relative flex h-full flex-col overflow-hidden p-7 transition-colors duration-500 hover:border-red-600/40`}>
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-red-600 to-transparent transition-transform duration-700 group-hover:scale-x-100"
                  />
                  <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600/10 text-red-600 transition-transform duration-500 group-hover:scale-110">
                    {pain.icon}
                  </div>
                  <h3 className={`${H3} mb-3`}>{pain.title}</h3>
                  <p className={BODY}>{pain.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
            <div className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-4 text-center">
              <Button onClick={() => openQuickLead('Mid CTA')}>Записати на безкоштовне</Button>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
                Без зобовʼязань · підберемо групу під вік і характер
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ВІДГУК
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="review" className={`${SECTION_Y} bg-black`}>
        <div className={CONTAINER}>
          <Reveal>
            <figure className={`${CARD} relative mx-auto max-w-4xl p-8 md:p-12`}>
              <Quote className="absolute right-8 top-8 h-20 w-20 text-red-600/15" aria-hidden />
              <div className="mb-6 flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={16} className="fill-red-600 text-red-600" />
                ))}
              </div>
              <blockquote className="mb-8 text-xl font-medium italic leading-relaxed text-zinc-300 md:text-2xl">
                «Ми привели сина в 4,5 роки, бо він був дуже соромʼязливим. За півроку він не тільки навчився базовим
                рухам, а й став набагато сміливішим у садочку. Тренери неймовірні!»
              </blockquote>
              <figcaption className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-lg font-black text-red-500" aria-hidden>
                  М
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-widest text-white">Марина, мама Артема</span>
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-500">Молодша група</span>
                </span>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ЧОМУ МИ
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="advantages" className={`${SECTION_Y} bg-black`}>
        <div className={CONTAINER}>
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <PhotoReveal
              src={PHOTOS.playful}
              alt="Хлопчик 5 років у кімоно на тренуванні з карате — ігрова адаптація в молодшій групі"
              className="w-full max-w-lg lg:max-w-none"
              imgClassName="aspect-[4/5]"
              position="50% 15%"
            >
              <div className="absolute bottom-6 left-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-red-500">Перші 2 місяці</span>
                <span className="block text-sm font-black uppercase tracking-tight text-white">Ігрова підготовка</span>
              </div>
            </PhotoReveal>

            <div>
              <Reveal>
                <Eyebrow>Чому Black Bear Dojo</Eyebrow>
                <h2 className={`${H2} mb-12`}>
                  Дитина йде в зал <Mark>із радістю</Mark>
                </h2>
              </Reveal>
              <ul className="space-y-7">
                {advantages.map((adv, i) => (
                  <Reveal key={adv.title} delay={0.1 + i * 0.08}>
                    <li className="group flex gap-5">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${HAIRLINE} bg-black text-red-600 transition-colors duration-300 group-hover:border-red-600/50`}>
                        {adv.icon}
                      </span>
                      <span>
                        <span className={`${H3} mb-1.5 block`}>{adv.title}</span>
                        <span className={`${BODY} block max-w-md`}>{adv.desc}</span>
                      </span>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ФОТО — три результати
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="gallery" className={`${SECTION_Y} relative overflow-hidden bg-zinc-950`}>
        <div className="pointer-events-none absolute right-0 top-1/2 h-[520px] w-[520px] -translate-y-1/2 translate-x-1/3 rounded-full bg-red-600/10 blur-[150px]" aria-hidden />
        <div className={`${CONTAINER} relative z-10`}>
          <SectionHeading eyebrow="Координація · Гнучкість · Перші перемоги">
            Так виглядає <Mark>результат</Mark>
          </SectionHeading>

          <GalleryStrip shots={gallery} />

          <Reveal delay={0.3}>
            <p className="mx-auto mt-14 max-w-2xl text-center text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 md:mt-20">
              Фото — клубна фотосесія Black Bear Dojo. Діти клубу, а не стокові моделі
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ЯК ЦЕ ПРАЦЮЄ — чотири кроки + кадр «тренер і дитина»
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="path" className={`${SECTION_Y} bg-black`}>
        <div className={CONTAINER}>
          <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div className="order-2 lg:order-1">
              <Reveal>
                <Eyebrow>Як це працює</Eyebrow>
                <h2 className={`${H2} mb-12`}>
                  Від заявки до <Mark>першого поясу</Mark>
                </h2>
              </Reveal>
              <ol className="space-y-4">
                {steps.map((step, i) => (
                  <Reveal key={step.num} delay={0.08 * i}>
                    <li className={`${CARD} relative flex gap-6 p-6 md:p-7`}>
                      <span className="text-4xl font-black leading-none text-red-600/80">{step.num}</span>
                      <span>
                        <span className={`${H3} mb-1.5 block`}>{step.title}</span>
                        <span className={`${BODY} block`}>{step.desc}</span>
                      </span>
                    </li>
                  </Reveal>
                ))}
              </ol>
              <Reveal delay={0.4}>
                <div className="mt-10">
                  <Button onClick={() => openQuickLead('Process CTA')}>Записати на безкоштовне</Button>
                </div>
              </Reveal>
            </div>

            <PhotoReveal
              src={PHOTOS.teaching}
              alt="Тренер Ігор Котляревський показує дитині 5 років стійку — перше тренування з карате"
              className="order-1 w-full max-w-lg lg:order-2 lg:max-w-none"
              imgClassName="aspect-[4/5] scale-[1.2] origin-bottom"
              position="50% 100%"
            >
              <div className="absolute bottom-6 left-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-red-500">Крок 02</span>
                <span className="block text-sm font-black uppercase tracking-tight text-white">Перше тренування</span>
              </div>
            </PhotoReveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ГРУПА — широкий кадр, паралакс
       * ---------------------------------------------------------------- */}
      <section id="group" ref={groupRef as any} className="relative overflow-hidden bg-black">
        <div className="relative min-h-[560px] md:min-h-[680px]">
          <motion.img
            src={PHOTOS.group}
            alt="Молодша група карате Black Bear Dojo — діти 4–7 років з тренером"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover object-[50%_20%] md:object-[50%_35%]"
            style={reduce ? undefined : { y: groupY }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" aria-hidden />
          <div className="absolute inset-0 hidden bg-gradient-to-r from-black/70 via-transparent to-transparent md:block" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black to-transparent" aria-hidden />

          <div className={`${CONTAINER} relative z-10 flex min-h-[560px] items-end pb-16 pt-80 md:min-h-[680px] md:pb-20`}>
            <div className="grid w-full items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <Reveal>
                  <Eyebrow>Молодша група клубу</Eyebrow>
                  <h2 className="text-3xl font-black uppercase leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
                    Приходять у 4. <br className="hidden sm:block" />
                    <span className="text-zinc-400">Лишаються</span> <Mark>на роки.</Mark>
                  </h2>
                </Reveal>
              </div>
              <div>
                <Reveal delay={0.1}>
                  <p className={`${BODY} mb-8 max-w-md text-base`}>
                    Той самий тренер, та сама школа, що й у старших групах клубу — лише темп і форма занять під вік.
                  </p>
                </Reveal>
                <Reveal delay={0.2}>
                  <dl className="grid grid-cols-3 gap-4 border-l-2 border-red-600 pl-5 sm:gap-6 sm:pl-6">
                    {[
                      ['4+', 'років — старт'],
                      ['≤12', 'дітей у групі'],
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
       * ТРЕНЕРИ
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="coach" className={`${SECTION_Y} overflow-x-clip bg-zinc-950`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Хто тренує дітей">
            Тренери, які бачать <Mark>кожного</Mark>
          </SectionHeading>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            {coachCards.map((c, i) => {
              const photo = c.photo && !failedPhotos[c.name] ? c.photo : null;
              return (
              <Reveal key={c.name} delay={i * 0.1} className="h-full">
                <article className={`${CARD} group flex h-full flex-col overflow-hidden`}>
                  <div className={`relative overflow-hidden bg-black ${photo ? 'aspect-[4/3]' : 'h-28 bg-red-600/10'}`}>
                    <div className="absolute inset-0 flex items-center justify-center text-5xl font-black text-red-600/60" aria-hidden>
                      {c.name.charAt(0)}
                    </div>
                    {photo && (
                      <img
                        src={c.photo}
                        alt={`${c.name} — тренер з карате для дітей, Black Bear Dojo`}
                        loading="lazy"
                        decoding="async"
                        className="relative h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
                        style={{ objectPosition: c.position }}
                        onError={() => setFailedPhotos(prev => ({ ...prev, [c.name]: true }))}
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-950 to-transparent" aria-hidden />
                    <span aria-hidden className="absolute left-5 top-5 h-6 w-6 border-l-2 border-t-2 border-red-600/80" />
                  </div>
                  <div className="p-7">
                    <h3 className="text-2xl font-black uppercase leading-none tracking-tight">{c.name}</h3>
                    <p className="mb-6 mt-2 text-[10px] font-black uppercase tracking-[0.28em] text-red-500">{c.role}</p>
                    <ul className="space-y-2.5">
                      {c.facts.map(fct => (
                        <li key={fct} className="flex items-start gap-3 text-[15px] font-medium text-zinc-300">
                          <Medal size={16} className="mt-0.5 shrink-0 text-red-600" />
                          {fct}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ПРИВІЛЕЇ — кадр «перший пояс»
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="perks" className={`${SECTION_Y} bg-black`}>
        <div className={CONTAINER}>
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <PhotoReveal
              src={PHOTOS.belt}
              alt="Тренер завʼязує дитині помаранчевий пояс після іспиту — перший пояс у карате"
              className="w-full max-w-lg lg:max-w-none"
              imgClassName="aspect-[4/5]"
              position="50% 40%"
            >
              <div className="absolute bottom-6 left-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-red-500">Через 4–6 місяців</span>
                <span className="block text-sm font-black uppercase tracking-tight text-white">Перший пояс</span>
              </div>
            </PhotoReveal>

            <div>
              <Reveal>
                <Eyebrow>Привілеї клубу</Eyebrow>
                <h2 className={`${H2} mb-12`}>
                  Більше ніж <Mark>тренування</Mark>
                </h2>
              </Reveal>
              <ul className="space-y-7">
                {privileges.map((priv, i) => (
                  <Reveal key={priv.title} delay={0.1 + i * 0.08}>
                    <li className="group flex gap-5">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${HAIRLINE} bg-black text-red-600 transition-colors duration-300 group-hover:border-red-600/50`}>
                        <Star size={18} />
                      </span>
                      <span>
                        <span className={`${H3} mb-1.5 block`}>{priv.title}</span>
                        <span className={`${BODY} block max-w-md`}>{priv.desc}</span>
                      </span>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * РОЗКЛАД І ЗАЛИ
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="schedule" className={`${SECTION_Y} bg-zinc-950`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Де і коли · два зали в Києві">
            Розклад <Mark>молодших груп</Mark>
          </SectionHeading>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            {allLocations.map((loc: any, i: number) => {
              const rows = kidsSchedule.filter((s: any) => String(s.location_id) === String(loc.id));
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
                          <li key={k} className="flex flex-col gap-1.5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <span>
                              <span className="block text-sm font-black uppercase tracking-tight text-white">{r.group_name}</span>
                              <span className="block text-xs font-medium text-zinc-500">
                                {/новач|нова/i.test(r.group_name) ? 'для новачків · ' : /молодш/i.test(r.group_name) ? 'для тих, хто вже займається · ' : ''}
                                {r.coach_name}
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
                      <p className={BODY}>Час молодшої групи уточнюємо після заявки.</p>
                    )}

                    <div className="mt-auto pt-6">
                      <p className="mb-5 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
                        Зал у безпечному приміщенні — тренування не зупиняється
                      </p>
                      <Button className="w-full" onClick={() => openQuickLead(`Schedule CTA ${districtOf(loc.name)}`)}>
                        Записати на безкоштовне
                      </Button>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * FAQ
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="faq" className={`${SECTION_Y} bg-zinc-950`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Часті запитання батьків">
            Питання <Mark>перед стартом</Mark>
          </SectionHeading>

          <div className="mx-auto max-w-3xl space-y-3">
            {KIDS_FAQ.map((item, i) => (
              <Reveal key={item.q} delay={i * 0.05}>
                <details
                  open={/коштує/i.test(item.q) || undefined}
                  className={`group overflow-hidden rounded-3xl border ${HAIRLINE} bg-zinc-900/40 transition-colors duration-300 hover:border-red-600/30 open:border-red-600/30`}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 p-6 [&::-webkit-details-marker]:hidden">
                    <span className="text-[15px] font-black uppercase leading-snug tracking-tight text-white">{item.q}</span>
                    <ChevronDown size={20} className="shrink-0 text-red-600 transition-transform duration-300 group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className={`${BODY} px-6 pb-6`}>{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ЗАЯВКА
       * ---------------------------------------------------------------- */}
      <QuickLeadModal
        open={quickLeadOpen}
        onClose={() => setQuickLeadOpen(false)}
        source="kids_landing"
        locations={allLocations}
        ageGroups={KIDS_GROUPS}
        title="Запис у молодшу групу 4–7 років"
        subtitle="Перше тренування безкоштовне. Залиште імʼя і номер — зателефонуємо та підберемо зручний час."
      />

      <ContactForm
        locations={allLocations}
        title="Перше тренування — безкоштовно"
        subtitle="Залиште імʼя і номер — зателефонуємо, підберемо зал і групу під вік дитини. Без зобовʼязань."
        ageGroups={KIDS_GROUPS}
        source="kids_landing"
        submitLabel="Записати безкоштовно"
        offerNote={
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600">
              <Star className="text-white" size={21} />
            </span>
            <span>
              <span className="mb-1 block text-sm font-black uppercase tracking-tight text-white">
                Перше тренування — безкоштовно
              </span>
              <span className="block text-xs font-medium leading-relaxed text-zinc-400">
                Далі — абонемент 2500 грн/міс · −20% на другу дитину з сімʼї · без зобовʼязань
              </span>
            </span>
          </div>
        }
      />

      {/* ---------------------------------------------------------------- *
       * FOOTER
       * ---------------------------------------------------------------- */}
      <footer className={`border-t ${HAIRLINE} bg-black pt-12 pb-28 md:pb-12`}>
        <div className={`${CONTAINER} flex flex-col items-center justify-between gap-7 md:flex-row`}>
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 rotate-3 items-center justify-center bg-red-600">
              <span className="text-xs font-black italic text-white">B</span>
            </span>
            <span className="text-sm font-black tracking-tight">Black Bear Dojo</span>
          </Link>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">© 2026 Black Bear Dojo. Всі права захищені.</p>
          <div className="flex gap-6">
            <a href={content?.social_instagram || 'https://instagram.com/karate_kyiv'} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-zinc-500 transition-colors hover:text-white">
              <Instagram size={19} />
            </a>
            <a href={content?.social_facebook || 'https://www.facebook.com/karatee.kyiv/'} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-zinc-500 transition-colors hover:text-white">
              <Facebook size={19} />
            </a>
          </div>
        </div>
      </footer>

      {/* Липкий CTA на мобільному — після hero */}
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
          Записати на безкоштовне
        </motion.button>
      </div>
    </div>
  );
};
