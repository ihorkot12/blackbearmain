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
  Zap,
  Target,
  Medal,
  Dumbbell,
  Brain,
  Trophy
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

/** Фото з клубної фотосесії — старша група 12+. WebP, public/teens/ + спільні кадри. */
const PHOTOS = {
  hero: '/main/teens-pair.webp',
  blackBelts: '/personal/pair-blackbelts.webp',
  girlsKick: '/teens/girls-kick.webp',
  championsPair: '/teens/champions-pair.webp',
  seniorsTeam: '/teens/seniors-team.webp',
  coachSeniors: '/teens/coach-seniors.webp',
  medalsTeam: '/teens/medals-team.webp',
  teensMedals: '/main/teens-medals.webp'
};

/** Одна група на сторінці — селект не потрібен, поле йде прихованим */
const TEEN_GROUPS = [{ value: '12+ років', label: 'Старша група (12+ років)' }];

/** Розклад старших груп, якщо /api/init не віддав свій */
const DEFAULT_TEEN_SCHEDULE = [
  { location_id: 1, day_of_week: 'Пн, Ср, Пт', start_time: '19:40', end_time: '21:00', group_name: 'Старша група (12+ років)', coach_name: 'Ігор Котляревський', price: '2500' },
  { location_id: 2, day_of_week: 'Пн, Ср, Пт', start_time: '19:10', end_time: '20:30', group_name: 'Старша група (10+ років)', coach_name: 'Олег Крамаренко', price: '2500' }
];

const DEFAULT_LOCATIONS = [
  { id: 1, name: 'Шулявка', address: "вул. Сім'ї Бродських, 31/33\nКиїв, 03057 (м. Шулявська)" },
  { id: 2, name: 'Відрадний / Сирець', address: 'вул. Віктора Некрасова, 1-3\nКиїв, 04136' }
];

/** Назва залу для батьків — район, а не вулиця (вулиця йде підписом) */
const districtOf = (name: string) =>
  /Бродськ|Шуляв/i.test(name) ? 'Шулявка' : /Некрасов|Сирец|Відрадн/i.test(name) ? 'Відрадний / Сирець' : name;

/** Групи для підлітків: «Старша», «12+», на Сирці — «10+» */
const isTeenGroup = (name: string) => /старш|12\s*\+|10\s*\+/i.test(name || '');

const TEEN_FAQ = [
  {
    q: 'Чи не пізно починати карате у 13–15 років?',
    a: 'Ні. Підліток швидко вчиться, має мотивацію і витривалість — за рік регулярних тренувань він наздоганяє тих, хто почав раніше. У старшій групі є ті, хто прийшов у 14–15 і вже виступає на змаганнях.'
  },
  {
    q: 'Чи є спаринги і наскільки це безпечно?',
    a: 'Кіокушинкай — контактний стиль, але контактні елементи вводяться поетапно, за рівнем готовності і лише під контролем тренера. Дисципліна в залі — обовʼязкова умова. Спочатку — техніка, координація, самоконтроль і фізична база.'
  },
  {
    q: 'Як проходять тренування під час повітряної тривоги?',
    a: 'Зал у безпечному приміщенні — тренування не зупиняється. Якщо є питання щодо конкретної локації, зателефонуйте тренеру перед записом: Ігор Котляревський — 095 475 65 00, Олег Крамаренко — 095 568 06 04.'
  },
  {
    q: 'Підліток соромʼязливий або без спортивного досвіду — чи підійде?',
    a: 'Так. Більшість приходять без підготовки. Початковий етап — адаптація, координація і впевненість; далі поступово зростає витривалість і сила. Навчання будується від простого до складного.'
  },
  {
    q: 'Чи обовʼязково брати участь у змаганнях?',
    a: 'Ні. Змагання — за бажанням і за рівнем готовності, який визначає тренер. Хто хоче — готується до чемпіонатів міста, області та України; хто ні — тренується заради техніки, форми і поясів.'
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
    a: 'Зручний спортивний одяг і воду. Кімоно (догі) на перше заняття не потрібне — з вибором допоможемо, коли підліток вирішить лишитися.'
  }
];

export const TeenLanding = () => {
  // Поведінка відвідувача: секції, час, глибина скролу, точка виходу
  React.useEffect(() => startEngagementTracking('teens'), []);
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const openQuickLead = React.useCallback((ctaName: string) => {
    trackLeadIntent(ctaName, 'teens');
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

  // Шулявка — першою: там веде засновник
  const allLocations = React.useMemo(() => {
    const list = locations.length ? [...locations] : [...DEFAULT_LOCATIONS];
    return list.sort((a: any, b: any) => Number(districtOf(b.name) === 'Шулявка') - Number(districtOf(a.name) === 'Шулявка'));
  }, [locations]);
  const teenSchedule = React.useMemo(() => {
    const own = schedule.filter((s: any) => isTeenGroup(s?.group_name));
    return own.length ? own : DEFAULT_TEEN_SCHEDULE;
  }, [schedule]);

  const pains = [
    {
      icon: <Shield size={22} />,
      title: 'Невпевненість і булінг',
      desc: 'Школа, двір, компанія. Карате дає не бійку, а спокійну впевненість, яка зупиняє агресію без слів — і техніку, якщо слів не вистачило.'
    },
    {
      icon: <Brain size={22} />,
      title: 'Стрес і навчання',
      desc: 'Домашка, тести, ЗНО на горизонті. Дві години в залі — перезавантаження для голови і вихід для емоцій. Після тренування вчиться легше.'
    },
    {
      icon: <Dumbbell size={22} />,
      title: 'Тіло, за яке не соромно',
      desc: 'Постава, витривалість, сила ударів. Атлетична форма без залу з тренажерами — через техніку і роботу в парах.'
    },
    {
      icon: <Users size={22} />,
      title: 'Своє коло',
      desc: 'Друзі, які обирають зал замість екрана. Старші учні і тренер — приклад, на який хочеться рівнятися.'
    }
  ];

  const advantages = [
    {
      title: 'Реальна самооборона',
      desc: 'Кіокушинкай — контактний стиль: дистанція, удар, захист працюють у житті, а не лише в залі. Контакт вводиться поступово, під контролем тренера.',
      icon: <Shield size={22} />
    },
    {
      title: 'Шлях до чорного поясу',
      desc: 'Атестації за програмою WKO Shinkyokushinkai — кожен пояс має вимоги, кожен іспит — сертифікат.',
      icon: <Medal size={22} />
    },
    {
      title: 'Змагання — за готовністю',
      desc: 'Чемпіонати міста, області, України. Вихованці клубу — чемпіони і призери України та Європи.',
      icon: <Trophy size={22} />
    },
    {
      title: 'Старші учні поруч',
      desc: 'У групі — підлітки й молоді чорні пояси клубу. Хлопці й дівчата тренуються разом, групи до 12 осіб.',
      icon: <Users size={22} />
    }
  ];

  const gallery: GalleryShot[] = [
    {
      src: PHOTOS.seniorsTeam,
      alt: 'Чорні пояси клубу Black Bear Dojo з кубками — старша група карате кіокушинкай',
      position: '50% 25%',
      zoom: 'scale-[1.15] origin-[50%_35%] group-hover:scale-[1.2]',
      tag: 'Чорні пояси',
      title: 'Ті, до кого рівняються',
      desc: 'Молоді чорні пояси клубу тренуються в тій самій групі і показують, куди веде шлях.'
    },
    {
      src: PHOTOS.girlsKick,
      alt: 'Дівчата-підлітки у бойовій стійці й удар ногою — карате для підлітків у Києві',
      position: '50% 40%',
      zoom: 'scale-[1.35] origin-[50%_45%] group-hover:scale-[1.4]',
      tag: 'Дівчата теж',
      title: 'Техніка, не сила',
      desc: 'Дівчата тренуються нарівні: та сама техніка, ті самі пояси, ті самі змагання.'
    },
    {
      src: PHOTOS.championsPair,
      alt: 'Учні клубу з медалями і кубками змагань з карате кіокушинкай',
      position: '50% 20%',
      zoom: 'scale-[1.1] origin-[50%_30%] group-hover:scale-[1.15]',
      tag: 'Результат',
      title: 'Медалі за роботу',
      desc: 'Хто готовий — виступає на чемпіонатах міста, області та України. Хто ні — росте в техніці.'
    }
  ];

  const steps = [
    { num: '01', title: 'Заявка і дзвінок', desc: 'Залишаєте імʼя та номер. Підбираємо зал і час старшої групи, відповідаємо на питання.' },
    { num: '02', title: 'Безкоштовне перше тренування', desc: 'Підліток тренується з групою, тренер оцінює рівень. Без зобовʼязань — рішення після.' },
    { num: '03', title: 'Системні тренування', desc: 'Три рази на тиждень: техніка, фізична підготовка, робота в парах, контроль. Перше догі, перший план.' },
    { num: '04', title: 'Атестації і змагання', desc: 'Пояс за поясом за програмою WKO. Далі — турніри, семінари і збори за бажанням.' }
  ];

  const privileges = [
    { title: 'Спецпідготовка', desc: 'Додаткові тренування для тих, хто готується до чемпіонатів.' },
    { title: 'Школа інструкторів', desc: 'Старші учні стають асистентами тренера і ростуть професійно.' },
    { title: 'Семінари і збори', desc: 'Виїзди на семінари та збори до майстрів кіокушинкай.' },
    { title: 'Спільнота клубу', desc: 'Друзі з правильними цінностями — у залі та поза ним.' }
  ];

  const coachCards = React.useMemo(() => {
    const byName = (re: RegExp) => coaches.find((c: any) => re.test(c?.name || ''));
    const ihor = byName(/Котляревськ/i);
    const oleh = byName(/Крамаренк/i);
    return [
      {
        name: ihor?.name || 'Ігор Котляревський',
        role: 'Шулявка · засновник клубу',
        photo: typeof ihor?.photo === 'string' && ihor.photo ? resizedImage(ihor.photo.split('?')[0], 800) : '/coach-igor-personal.jpg',
        position: '50% 15%',
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

  const heroTitle = content?.teen_hero_title as string | undefined;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-red-600 selection:text-white">
      <SEO
        title={content?.teen_seo_title || PAGE_SEO['/teens-12-plus'].title}
        description={content?.teen_seo_description || PAGE_SEO['/teens-12-plus'].description}
        keywords={content?.teen_seo_keywords || PAGE_SEO['/teens-12-plus'].keywords}
        image={PAGE_SEO['/teens-12-plus'].image}
        imageAlt={PAGE_SEO['/teens-12-plus'].imageAlt}
        url={`${SITE_URL}/teens-12-plus`}
        jsonLd={clubGraph([
          courseOffer({
            name: 'Карате для підлітків 12+',
            description: 'Старша група Кіокушинкай карате: самооборона, техніка, спаринги за готовністю, атестації на пояси, турніри.',
            url: `${SITE_URL}/teens-12-plus`,
            ageRange: '12-17'
          }),
          faqPage(TEEN_FAQ)
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
                    Набір у групу 12+<span className="hidden sm:inline"> · перше тренування безкоштовно</span>
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
                  <h1 className="mb-7 text-[clamp(2.4rem,6vw,4.6rem)] font-black uppercase leading-[0.98] tracking-tight md:leading-[0.92]">
                    Карате 12+
                    <br />
                    <span className="text-red-600">для підлітків</span>
                    <span className="mt-3 block text-[0.36em] font-black leading-tight tracking-[0.02em] text-zinc-400">
                      у Києві · Шулявка · Сирець
                    </span>
                  </h1>
                )}
              </Reveal>

              <Reveal delay={0.16}>
                <p className="mb-10 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg md:text-xl">
                  Самооборона, яка працює, і характер, який видно. Кіокушинкай для підлітків: техніка, спаринги за
                  готовністю, пояси за програмою WKO, старші учні поруч. <span className="text-white">Перше тренування — безкоштовно.</span>
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
                  {['12+ років', 'Хлопці й дівчата', 'Групи до 12 осіб', 'Два зали в Києві', 'Тренер — 3 дан'].map(item => (
                    <li key={item} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">
                      <CheckCircle2 size={14} className="shrink-0 text-red-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            {/* Права колонка — фото + офер-картка поверх */}
            <div className="relative lg:ml-auto lg:w-full lg:max-w-[440px] lg:pb-32 xl:max-w-[470px]">
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
                      alt="Карате для підлітків 12+ у Києві — двоє учнів старшої групи, Black Bear Dojo"
                      fetchPriority="high"
                      decoding="async"
                      className="h-full w-full object-cover object-[50%_20%]"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/30 to-transparent" aria-hidden />
                    <span aria-hidden className="absolute left-5 top-5 h-7 w-7 border-l-2 border-t-2 border-red-600" />
                    <span aria-hidden className="absolute right-5 top-5 h-7 w-7 border-r-2 border-t-2 border-red-600" />
                    <div className="absolute right-6 top-6 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 backdrop-blur">
                      Старша група · Black Bear Dojo
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
                        alt="Карате для підлітків 12+ у Києві — двоє учнів старшої групи"
                        fetchPriority="high"
                        decoding="async"
                        className="h-full w-full object-cover object-[50%_30%]"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" aria-hidden />
                      <span aria-hidden className="absolute left-5 top-5 h-6 w-6 border-l-2 border-t-2 border-red-600" />
                      <span aria-hidden className="absolute right-5 top-5 h-6 w-6 border-r-2 border-t-2 border-red-600" />
                    </div>

                    <div className="relative">
                      <div className="mb-5 flex flex-wrap items-center gap-3 lg:mb-3">
                        <span className="inline-flex rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                          12+ років
                        </span>
                        <span className={`${EYEBROW} text-[10px]`}>Перше тренування</span>
                      </div>

                      <div className="mb-5 lg:mb-4">
                        <span className="block text-4xl font-black uppercase leading-none tracking-tight text-red-600 md:text-5xl lg:text-4xl">
                          Безкоштовно
                        </span>
                        <span className="mt-2 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-300">
                          Далі — 2500 грн/міс · −20% на другу дитину
                        </span>
                      </div>

                      <p className={`${BODY} mb-7 border-b ${HAIRLINE} pb-7 text-sm lg:hidden`}>
                        Підліток тренується з групою. Без зобовʼязань і без кімоно на перший раз.
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
            Виклики <Mark>підліткового віку</Mark>
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
                Без зобовʼязань · підберемо зал і час старшої групи
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
                «Я прийшов у 14 років, бо хотів навчитися захищатися. Зараз мені 17, у мене вже коричневий пояс і я
                виступаю на змаганнях. Карате змінило моє ставлення до життя та навчання.»
              </blockquote>
              <figcaption className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-lg font-black text-red-500" aria-hidden>
                  Д
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-widest text-white">Дмитро, 17 років</span>
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-500">Старша група</span>
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
              src={PHOTOS.blackBelts}
              alt="Молоді чорні пояси клубу Black Bear Dojo з кубками — шлях до чорного поясу"
              className="w-full max-w-lg lg:max-w-none"
              imgClassName="aspect-[4/5]"
              position="50% 15%"
            >
              <div className="absolute bottom-6 left-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-red-500">Ціль</span>
                <span className="block text-sm font-black uppercase tracking-tight text-white">Чорний пояс</span>
              </div>
            </PhotoReveal>

            <div>
              <Reveal>
                <Eyebrow>Чому Black Bear Dojo</Eyebrow>
                <h2 className={`${H2} mb-12`}>
                  Школа, де сила — <Mark>це характер</Mark>
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
          <SectionHeading eyebrow="Приклад · Техніка · Результат">
            Так виглядає <Mark>результат</Mark>
          </SectionHeading>

          <GalleryStrip shots={gallery} />

          <Reveal delay={0.3}>
            <p className="mx-auto mt-14 max-w-2xl text-center text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 md:mt-20">
              Фото — клубна фотосесія Black Bear Dojo. Учні клубу, а не стокові моделі
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
              src={PHOTOS.coachSeniors}
              alt="Тренер Ігор Котляревський зі старшими учнями клубу і кубками — старша група карате"
              className="order-1 w-full max-w-lg lg:order-2 lg:max-w-none"
              imgClassName="aspect-[4/5] scale-[1.1] origin-[50%_30%]"
              position="50% 20%"
            >
              <div className="absolute bottom-6 left-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-red-500">Крок 04</span>
                <span className="block text-sm font-black uppercase tracking-tight text-white">Атестації і змагання</span>
              </div>
            </PhotoReveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ГРУПА — широкий кадр, паралакс
       * ---------------------------------------------------------------- */}
      <section id="group" ref={groupRef as any} className="relative overflow-hidden bg-black">
        <div className="relative min-h-[600px] md:min-h-[700px]">
          <motion.img
            src={PHOTOS.medalsTeam}
            alt="Учні старшої групи Black Bear Dojo з медалями і кубками змагань з карате"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover object-[50%_20%] md:object-[50%_25%]"
            style={reduce ? undefined : { y: groupY }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" aria-hidden />
          <div className="absolute inset-0 hidden bg-gradient-to-r from-black/70 via-transparent to-transparent md:block" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black to-transparent" aria-hidden />

          <div className={`${CONTAINER} relative z-10 flex min-h-[600px] items-end pb-16 pt-72 md:min-h-[700px] md:pb-20 md:pt-80`}>
            <div className="grid w-full items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <Reveal>
                  <Eyebrow>Старша група клубу</Eyebrow>
                  <h2 className="text-3xl font-black uppercase leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
                    Команда, <br className="hidden sm:block" />
                    <span className="text-zinc-400">яка</span> <Mark>виграє.</Mark>
                  </h2>
                </Reveal>
              </div>
              <div>
                <Reveal delay={0.1}>
                  <p className={`${BODY} mb-8 max-w-md text-base`}>
                    Медалі й кубки на фото — з чемпіонатів міста, області та України. Виступають ті, хто готовий; решта тренуються поруч і ростуть у техніці.
                  </p>
                </Reveal>
                <Reveal delay={0.2}>
                  <dl className="grid grid-cols-3 gap-4 border-l-2 border-red-600 pl-5 sm:gap-6 sm:pl-6">
                    {[
                      ['12+', 'років'],
                      ['≤12', 'осіб у групі'],
                      ['3', 'тренування на тиждень']
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
          <SectionHeading eyebrow="Хто тренує підлітків">
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
              src={PHOTOS.teensMedals}
              alt="Троє підлітків клубу з медалями змагань з карате кіокушинкай"
              className="w-full max-w-lg lg:max-w-none"
              imgClassName="aspect-[4/5] scale-[1.05]"
              position="50% 30%"
            >
              <div className="absolute right-6 top-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-red-500">За готовністю</span>
                <span className="block text-sm font-black uppercase tracking-tight text-white">Турніри і збори</span>
              </div>
            </PhotoReveal>

            <div>
              <Reveal>
                <Eyebrow>Привілеї клубу</Eyebrow>
                <h2 className={`${H2} mb-12`}>
                  Більше ніж <Mark>секція</Mark>
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
            Розклад <Mark>старших груп</Mark>
          </SectionHeading>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            {allLocations.map((loc: any, i: number) => {
              const rows = teenSchedule.filter((s: any) => String(s.location_id) === String(loc.id));
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
                      <p className={BODY}>Час старшої групи уточнюємо після заявки.</p>
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
            {TEEN_FAQ.map((item, i) => (
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
        source="teen_landing"
        locations={allLocations}
        ageGroups={TEEN_GROUPS}
        title="Запис у старшу групу 12+"
        subtitle="Перше тренування безкоштовне. Залиште імʼя і номер — зателефонуємо та підберемо зручний час."
      />

      <ContactForm
        locations={allLocations}
        title="Перше тренування — безкоштовно"
        subtitle="Залиште імʼя і номер — зателефонуємо, підберемо зал і час старшої групи. Без зобовʼязань."
        ageGroups={TEEN_GROUPS}
        source="teen_landing"
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
