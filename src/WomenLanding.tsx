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

/** Фото з клубної фотосесії — дівчата і жінки клубу. WebP, public/women/ + спільні кадри. */
const PHOTOS = {
  hero: '/women/woman-belt.webp',
  five: '/women/women-five.webp',
  kick: '/personal/kick.webp',
  girlsKick: '/teens/girls-kick.webp',
  girlsMedals: '/women/girls-medals.webp',
  coachWomen: '/personal/group-igor-women.webp',
  threeGirls: '/juniors/three-girls.webp',
  womanMedals: '/personal/woman-medals.webp'
};

/** Дівчата тренуються у вікових групах, дорослі — у персональному форматі; тому питаємо, кого записуємо */
const WOMEN_GROUPS = [
  { value: 'Дівчата (7–12)', label: 'Дівчинка 7–12 років' },
  { value: 'Дівчата (підлітки)', label: 'Дівчина-підліток 12+' },
  { value: 'Жінка (персонально)', label: 'Доросла — персональні тренування' }
];

/** Розклад груп, де тренуються дівчата (7+), якщо /api/init не віддав свій */
const DEFAULT_WOMEN_SCHEDULE = [
  { location_id: 1, day_of_week: 'Пн, Ср, Пт', start_time: '18:30', end_time: '19:30', group_name: 'Середня група (7–12 років)', coach_name: 'Ігор Котляревський', price: '2500' },
  { location_id: 1, day_of_week: 'Пн, Ср, Пт', start_time: '19:40', end_time: '21:00', group_name: 'Старша група (12+ років)', coach_name: 'Ігор Котляревський', price: '2500' },
  { location_id: 2, day_of_week: 'Пн, Ср, Пт', start_time: '17:30', end_time: '18:30', group_name: 'Середня група (7–9 років)', coach_name: 'Олег Крамаренко', price: '2500' },
  { location_id: 2, day_of_week: 'Пн, Ср, Пт', start_time: '19:10', end_time: '20:30', group_name: 'Старша група (10+ років)', coach_name: 'Олег Крамаренко', price: '2500' }
];

const DEFAULT_LOCATIONS = [
  { id: 1, name: 'Шулявка', address: "вул. Сім'ї Бродських, 31/33\nКиїв, 03057 (м. Шулявська)" },
  { id: 2, name: 'Відрадний / Сирець', address: 'вул. Віктора Некрасова, 1-3\nКиїв, 04136' }
];

/** Назва залу для батьків — район, а не вулиця (вулиця йде підписом) */
const districtOf = (name: string) =>
  /Бродськ|Шуляв/i.test(name) ? 'Шулявка' : /Некрасов|Сирец|Відрадн/i.test(name) ? 'Відрадний / Сирець' : name;

/** Групи, де тренуються дівчата від 7: середні і старші (молодша 4–7 — на сторінці /kids-4-7) */
const isGirlsGroup = (name: string) => /середн|старш|7\s*[–-]\s*12|8\s*[–-]\s*12|12\s*\+|10\s*\+/i.test(name || '');

const WOMEN_FAQ = [
  {
    q: 'Чи не надто жорстко карате для дівчини?',
    a: 'Кіокушинкай у клубі — з акцентом на техніку й контроль. Контактні елементи вводяться поетапно, за рівнем готовності і лише під контролем тренера. Атмосфера в групах — підтримка, а не агресія.'
  },
  {
    q: 'Чи безпечна робота в парах?',
    a: 'Так. Тренер поступово вводить парні вправи, стежить за дистанцією, технікою та рівнем контакту. Спочатку — реакція, дистанція і контроль, потім — усе інше.'
  },
  {
    q: 'У мене (у доньки) немає спортивної підготовки — чи підійде?',
    a: 'Так. Більшість приходять без досвіду. Стартуємо з базової розминки, простих рухів і поступово нарощуємо навантаження. Техніка кіокушинкай не залежить від маси й сили.'
  },
  {
    q: 'Дівчата тренуються разом з хлопцями?',
    a: 'Дівчата 7–17 років тренуються у вікових групах разом із хлопцями — та сама техніка, ті самі пояси, ті самі змагання. Дорослі жінки — у персональному форматі з Ігорем Котляревським на Шулявці.'
  },
  {
    q: 'Як проходять тренування під час повітряної тривоги?',
    a: 'Зал у безпечному приміщенні — тренування не зупиняється. Якщо є питання щодо конкретної локації, зателефонуйте тренеру перед записом: Ігор Котляревський — 095 475 65 00, Олег Крамаренко — 095 568 06 04.'
  },
  {
    q: 'Скільки коштує і що входить в абонемент?',
    a: 'Перше тренування — безкоштовне. Абонемент у віковій групі — 2500 грн на місяць: регулярні тренування, системна фізична підготовка, технічна база кіокушинкай, підготовка до змагань за рівнем готовності. Персональні тренування для дорослих — 900 грн за заняття, перше — 450 грн.'
  },
  {
    q: 'Що взяти на перше тренування?',
    a: 'Зручний спортивний одяг і воду. Кімоно (догі) на перше заняття не потрібне — з вибором допоможемо, коли рішення лишитися буде.'
  }
];

export const WomenLanding = () => {
  // Поведінка відвідувача: секції, час, глибина скролу, точка виходу
  React.useEffect(() => startEngagementTracking('women'), []);
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const openQuickLead = React.useCallback((ctaName: string) => {
    trackLeadIntent(ctaName, 'women');
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
  const girlsSchedule = React.useMemo(() => {
    const own = schedule.filter((s: any) => isGirlsGroup(s?.group_name));
    return own.length ? own : DEFAULT_WOMEN_SCHEDULE;
  }, [schedule]);

  const pains = [
    {
      icon: <Shield size={22} />,
      title: 'Хочеться вміти постояти за себе',
      desc: 'Не бійка, а дистанція, реакція і спокій, коли хтось хапає за руку. Техніка кіокушинкай не залежить від маси й сили.'
    },
    {
      icon: <Zap size={22} />,
      title: 'Фітнес набрид',
      desc: 'Бігова доріжка і тренажери дають мʼязи, але не дають навички. Карате — кардіо, сила й гнучкість через техніку, а не через рутину.'
    },
    {
      icon: <Target size={22} />,
      title: 'Невпевненість',
      desc: 'У школі, в компанії, на вулиці. Стійка, удар, який має вагу, і тіло, яке слухається, — впевненість, яку видно.'
    },
    {
      icon: <Dumbbell size={22} />,
      title: 'Постава й форма',
      desc: 'Удари руками й ногами, корпус, розтяжка. Навантаження зростає поступово — без ривків і без травм.'
    }
  ];

  const advantages = [
    {
      title: 'Активне кардіо',
      desc: 'Розминка, переміщення, серії ударів і витривалість — живе тренування без нудної рутини.',
      icon: <Zap size={22} />
    },
    {
      title: 'Руки й ноги',
      desc: 'Удари руками, ногами, стійки, захист і комбінації — тіло працює різноманітно, а не на одному тренажері.',
      icon: <Target size={22} />
    },
    {
      title: 'Робота в парах під контролем',
      desc: 'Реакція, дистанція, сміливість і контроль. Тренер стежить за рівнем контакту — без хаосу і зайвої агресії.',
      icon: <Shield size={22} />
    },
    {
      title: 'Дівчата нарівні',
      desc: 'Та сама техніка, ті самі пояси, ті самі змагання. Вихованки клубу — призерки України та Європи.',
      icon: <Medal size={22} />
    }
  ];

  const gallery: GalleryShot[] = [
    {
      src: PHOTOS.kick,
      alt: 'Дівчина виконує високий удар ногою — карате для дівчат у Києві, Black Bear Dojo',
      position: '50% 20%',
      zoom: 'scale-[1.25] origin-[55%_40%] group-hover:scale-[1.3]',
      tag: 'Форма',
      title: 'Тіло, яке слухається',
      desc: 'Гнучкість, корпус, витривалість — через удари, а не через тренажери.'
    },
    {
      src: PHOTOS.girlsKick,
      alt: 'Дівчата-підлітки у бойовій стійці й удар ногою — робота в парах на карате',
      position: '50% 40%',
      zoom: 'scale-[1.35] origin-[50%_45%] group-hover:scale-[1.4]',
      tag: 'Техніка',
      title: 'Удар, який має вагу',
      desc: 'Стійка, дистанція, реакція. Робота в парах — з контролем, а не з агресією.'
    },
    {
      src: PHOTOS.girlsMedals,
      alt: 'Три дівчинки клубу з медалями змагань з карате кіокушинкай',
      position: '50% 30%',
      zoom: 'scale-[1.35] origin-[50%_40%] group-hover:scale-[1.4]',
      tag: 'Результат',
      title: 'Медалі — за бажанням',
      desc: 'Хто хоче — виступає на чемпіонатах. Хто ні — росте в техніці й впевненості.'
    }
  ];

  const steps = [
    { num: '01', title: 'Заявка і дзвінок', desc: 'Залишаєте імʼя та номер. Уточнюємо вік і ціль: група за віком для дівчат або персональний формат для дорослих.' },
    { num: '02', title: 'Безкоштовне перше тренування', desc: 'Розминка, базові рухи, знайомство з групою і тренером. Без зобовʼязань — рішення після.' },
    { num: '03', title: 'Системні тренування', desc: 'Три рази на тиждень: кардіо, техніка, робота в парах. Навантаження зростає поступово.' },
    { num: '04', title: 'Пояси і змагання', desc: 'Атестації за програмою WKO — за бажанням і за готовністю. Турніри — для тих, хто хоче.' }
  ];

  const privileges = [
    { title: 'Персональний формат', desc: 'Для дорослих — один на один із засновником клубу на Шулявці.' },
    { title: 'Сімейна знижка', desc: '−20% на другу дитину з однієї сімʼї.' },
    { title: 'Семінари і збори', desc: 'Виїзди на семінари та збори до майстрів кіокушинкай.' },
    { title: 'Спільнота клубу', desc: 'Дівчата й жінки клубу — на тренуваннях, змаганнях і фотосесіях разом.' }
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

  const heroTitle = content?.women_hero_title as string | undefined;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-red-600 selection:text-white">
      <SEO
        title={content?.women_seo_title || 'Карате для дівчат і жінок у Києві — Шулявка, Сирець | Black Bear Dojo'}
        description={
          content?.women_seo_description ||
          'Карате для дівчат і жінок у Києві: кардіо, техніка руками й ногами, робота в парах під контролем, базова самооборона. Дівчата — у вікових групах, дорослі — персонально. Перше тренування безкоштовне.'
        }
        keywords={
          content?.women_seo_keywords ||
          'карате для дівчат київ, самооборона для дівчат київ, самооборона для жінок київ, фітнес карате київ, карате для жінок київ, секція карате шулявка, карате сирець дівчата'
        }
        url={`${SITE_URL}/women-karate`}
        jsonLd={clubGraph([
          courseOffer({
            name: 'Карате для дівчат і жінок',
            description: 'Кіокушинкай карате для дівчат і жінок: кардіо, координація, робота в парах, базова самооборона.',
            url: `${SITE_URL}/women-karate`,
            ageRange: '7-45'
          }),
          faqPage(WOMEN_FAQ)
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
                    Кардіо · техніка · впевненість<span className="hidden sm:inline"> · перше тренування безкоштовно</span>
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
                    Карате
                    <br />
                    <span className="text-red-600">для дівчат</span>
                    <br />
                    і жінок
                    <span className="mt-3 block text-[0.36em] font-black leading-tight tracking-[0.02em] text-zinc-400">
                      у Києві · Шулявка · Сирець
                    </span>
                  </h1>
                )}
              </Reveal>

              <Reveal delay={0.16}>
                <p className="mb-10 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg md:text-xl">
                  Сильне тіло, базова самооборона і впевненість — через техніку, а не через рутину. Дівчата — у
                  вікових групах, дорослі — персонально. <span className="text-white">Перше тренування — безкоштовно.</span>
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
                  {['Дівчата від 7 років', 'Жінки — персонально', 'Групи до 12 осіб', 'Два зали в Києві', 'Тренер — 3 дан'].map(item => (
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
                      alt="Карате для дівчат і жінок у Києві — учениця клубу з медалями, Black Bear Dojo"
                      fetchPriority="high"
                      decoding="async"
                      className="h-full w-full object-cover object-[50%_5%]"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/30 to-transparent" aria-hidden />
                    <span aria-hidden className="absolute left-5 top-5 h-7 w-7 border-l-2 border-t-2 border-red-600" />
                    <span aria-hidden className="absolute right-5 top-5 h-7 w-7 border-r-2 border-t-2 border-red-600" />
                    <div className="absolute right-6 top-6 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 backdrop-blur">
                      Дівчата клубу · Black Bear Dojo
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
                        alt="Карате для дівчат і жінок у Києві — учениця клубу з медалями"
                        fetchPriority="high"
                        decoding="async"
                        className="h-full w-full object-cover object-[50%_15%]"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" aria-hidden />
                      <span aria-hidden className="absolute left-5 top-5 h-6 w-6 border-l-2 border-t-2 border-red-600" />
                      <span aria-hidden className="absolute right-5 top-5 h-6 w-6 border-r-2 border-t-2 border-red-600" />
                    </div>

                    <div className="relative">
                      <div className="mb-5 flex flex-wrap items-center gap-3 lg:mb-3">
                        <span className="inline-flex rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                          Дівчата · жінки
                        </span>
                        <span className={`${EYEBROW} text-[10px]`}>Перше тренування</span>
                      </div>

                      <div className="mb-5 lg:mb-4">
                        <span className="block text-4xl font-black uppercase leading-none tracking-tight text-red-600 md:text-5xl lg:text-4xl">
                          Безкоштовно
                        </span>
                        <span className="mt-2 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-300">
                          Далі — 2500 грн/міс · дорослим — персонально
                        </span>
                      </div>

                      <p className={`${BODY} mb-7 border-b ${HAIRLINE} pb-7 text-sm lg:hidden`}>
                        Розминка, базові рухи, знайомство. Без зобовʼязань і без кімоно на перший раз.
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
            Чому дівчата обирають <Mark>карате</Mark>
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
                Без зобовʼязань · підберемо групу або персональний формат
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
                «Мені сподобалось, що тренування не одноманітні: кардіо, техніка, робота в парах і постійний рух.»
              </blockquote>
              <figcaption className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-lg font-black text-red-500" aria-hidden>
                  Є
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-widest text-white">Єва, 17 років</span>
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-500">Учениця клубу</span>
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
              src={PHOTOS.five}
              alt="Пʼять дівчат і жінок клубу Black Bear Dojo у бойовій стійці — карате для дівчат у Києві"
              className="w-full max-w-lg lg:max-w-none"
              imgClassName="aspect-[4/3]"
              position="50% 30%"
            >
              <div className="absolute bottom-6 left-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-red-500">Клубна фотосесія</span>
                <span className="block text-sm font-black uppercase tracking-tight text-white">Дівчата й жінки клубу</span>
              </div>
            </PhotoReveal>

            <div>
              <Reveal>
                <Eyebrow>Чому Black Bear Dojo</Eyebrow>
                <h2 className={`${H2} mb-12`}>
                  Тренування, на які <Mark>хочеться йти</Mark>
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
          <SectionHeading eyebrow="Форма · Техніка · Результат">
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
              src={PHOTOS.coachWomen}
              alt="Тренер Ігор Котляревський з ученицями клубу — карате для дівчат і жінок"
              className="order-1 w-full max-w-lg lg:order-2 lg:max-w-none"
              imgClassName="aspect-[4/5] scale-[1.2] origin-[50%_35%]"
              position="50% 30%"
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
        <div className="relative min-h-[600px] md:min-h-[700px]">
          <motion.img
            src={PHOTOS.threeGirls}
            alt="Три дівчинки клубу у бойовій стійці — карате для дівчат у Києві, Black Bear Dojo"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover object-[50%_15%] md:object-[50%_20%]"
            style={reduce ? undefined : { y: groupY }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" aria-hidden />
          <div className="absolute inset-0 hidden bg-gradient-to-r from-black/70 via-transparent to-transparent md:block" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black to-transparent" aria-hidden />

          <div className={`${CONTAINER} relative z-10 flex min-h-[600px] items-end pb-16 pt-72 md:min-h-[700px] md:pb-20 md:pt-80`}>
            <div className="grid w-full items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <Reveal>
                  <Eyebrow>Дівчата в клубі</Eyebrow>
                  <h2 className="text-3xl font-black uppercase leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
                    Тренуються нарівні. <br className="hidden sm:block" />
                    <span className="text-zinc-400">Виграють</span> <Mark>нарівні.</Mark>
                  </h2>
                </Reveal>
              </div>
              <div>
                <Reveal delay={0.1}>
                  <p className={`${BODY} mb-8 max-w-md text-base`}>
                    Кіокушинкай не ділить групу на хлопців і дівчат: та сама техніка, ті самі пояси, ті самі змагання. Дорослі жінки — у персональному форматі.
                  </p>
                </Reveal>
                <Reveal delay={0.2}>
                  <dl className="grid grid-cols-3 gap-4 border-l-2 border-red-600 pl-5 sm:gap-6 sm:pl-6">
                    {[
                      ['7+', 'років — старт'],
                      ['≤12', 'осіб у групі'],
                      ['1:1', 'для дорослих']
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
          <SectionHeading eyebrow="Хто тренує">
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
              src={PHOTOS.womanMedals}
              alt="Учениця клубу з медалями змагань з карате — результат тренувань"
              className="w-full max-w-lg lg:max-w-none"
              imgClassName="aspect-[4/5]"
              position="50% 10%"
            >
              <div className="absolute right-6 top-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-red-500">За бажанням</span>
                <span className="block text-sm font-black uppercase tracking-tight text-white">Змагання і пояси</span>
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
          <SectionHeading eyebrow="Де і коли · дівчата тренуються у вікових групах">
            Розклад <Mark>груп для дівчат</Mark>
          </SectionHeading>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            {allLocations.map((loc: any, i: number) => {
              const rows = girlsSchedule.filter((s: any) => String(s.location_id) === String(loc.id));
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
                      <p className={BODY}>Час групи уточнюємо після заявки.</p>
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
          <SectionHeading eyebrow="Часті запитання">
            Питання <Mark>перед стартом</Mark>
          </SectionHeading>

          <div className="mx-auto max-w-3xl space-y-3">
            {WOMEN_FAQ.map((item, i) => (
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
        source="women_landing"
        locations={allLocations}
        ageGroups={WOMEN_GROUPS}
        title="Запис на карате для дівчат"
        subtitle="Перше тренування безкоштовне. Залиште імʼя і номер — зателефонуємо та підберемо зручний час."
      />

      <ContactForm
        locations={allLocations}
        title="Перше тренування — безкоштовно"
        subtitle="Залиште імʼя і номер — уточнимо вік і ціль, підберемо групу або персональний формат. Без зобовʼязань."
        ageGroups={WOMEN_GROUPS}
        source="women_landing"
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
                Далі — 2500 грн/міс у групі · персонально для дорослих 900 грн/заняття · без зобовʼязань
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
