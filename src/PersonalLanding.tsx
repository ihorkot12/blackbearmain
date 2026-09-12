import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useSpring, useReducedMotion, useTransform } from 'motion/react';
import { Navbar } from './components/Navbar';
import {
  MapPin,
  ChevronRight,
  ChevronDown,
  Quote,
  Target,
  Medal,
  Brain,
  Flame,
  Clock,
  CheckCircle2,
  TrendingUp,
  Send,
  Instagram,
  Facebook
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO, { SITE_URL } from './components/SEO';
import { PAGE_SEO } from './lib/seoPages';
import { shuliavkaGraph } from './lib/structuredData';
import { QuickLeadModal } from './components/QuickLeadModal';
import { trackLeadIntent } from './lib/leadTracking';
import { startEngagementTracking } from './lib/engagement';
import { ContactForm } from './components/ContactForm';
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
  DUR,
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

/** Замість віку: на дорослому лендінгу питаємо ціль */
const PERSONAL_GOALS = [
  { value: 'Самооборона', label: 'Самооборона' },
  { value: 'Фізична форма', label: 'Фізична форма' },
  { value: 'Техніка карате / пояс', label: 'Техніка карате / пояс' },
  { value: 'Ще не вирішив(ла)', label: 'Ще не вирішив(ла) — підкажіть' }
];

/**
 * Зображення через оптимізатор Vercel (/_vercel/image) — фото тренера в базі
 * важить ~2.7 МБ, у слот 536px це надлишок. Працює тільки для same-origin
 * шляхів; якщо оптимізатор недоступний, onError повертає оригінальний src.
 */
const OptimizedImg = ({
  src,
  width = 1080,
  quality = 75,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; width?: number; quality?: number }) => {
  // /api/init повертає фото з міткою ?v=<timestamp>, яка змінюється щозапиту.
  // Для оптимізатора це щоразу новий URL → кеш ніколи не спрацьовує. Тому
  // мітку відкидаємо: URL стабільний, картинка кешується (див. minimumCacheTTL).
  const isLocal = typeof src === 'string' && src.startsWith('/');
  const stableSrc = isLocal ? src.split('?')[0] : src;
  const optimized = isLocal
    ? `/_vercel/image?url=${encodeURIComponent(stableSrc)}&w=${width}&q=${quality}`
    : src;

  return (
    <img
      src={optimized}
      onError={e => {
        const el = e.currentTarget;
        if (el.src !== src) el.src = src; // фолбек на оригінал
      }}
      {...props}
    />
  );
};

/**
 * Фото з клубної фотосесії (студія, чорний фон) — зливаються з темною темою
 * без масок. WebP ≤105 КБ кожне, лежать у public/personal/.
 */
const PHOTOS = {
  hero: '/personal/hero-woman-blackbelt.webp',
  kick: '/personal/kick.webp',
  pair: '/personal/pair-blackbelts.webp',
  medals: '/personal/woman-medals.webp',
  student: '/personal/igor-student.webp',
  group: '/personal/group-igor-women.webp'
};

/** Фото першого екрана (десктоп): портрет з чорним поясом, світло за спиною, рамка кадру */
const HeroPhoto = () => (
  <div className="relative aspect-[3/4] w-full">
    <div className="pointer-events-none absolute -inset-10 rounded-full bg-red-600/20 blur-[90px]" aria-hidden />
    <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950">
      <img
        src={PHOTOS.hero}
        alt="Персональні тренування з карате для дорослих у Києві — учениця з чорним поясом, Black Bear Dojo"
        fetchPriority="high"
        decoding="async"
        className="h-full w-full object-cover object-[50%_0%]"
      />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/30 to-transparent" aria-hidden />
      <span aria-hidden className="absolute left-5 top-5 h-7 w-7 border-l-2 border-t-2 border-red-600" />
      <span aria-hidden className="absolute right-5 top-5 h-7 w-7 border-r-2 border-t-2 border-red-600" />
      <div className="absolute right-6 top-6 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 backdrop-blur">
        Чорний пояс · Black Bear Dojo
      </div>
    </div>
  </div>
);

export const PersonalLanding = () => {
  // Поведінка відвідувача: секції, час, глибина скролу, точка виходу
  React.useEffect(() => startEngagementTracking('personal'), []);
  const [locations, setLocations] = useState<any[]>([]);
  const [content, setContent] = useState<any>(null);
  const [coaches, setCoaches] = useState<any[]>([]);
  const reduce = useReducedMotion();

  // Прогрес-бар прокрутки
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  // М'який паралакс тла hero
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  });
  const heroY = useTransform(heroProgress, [0, 1], ['0%', '18%']);
  const heroFade = useTransform(heroProgress, [0, 1], [1, 0.15]);

  // Паралакс широкого кадру з ученицями
  const groupRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: groupProgress } = useScroll({
    target: groupRef,
    offset: ['start end', 'end start']
  });
  const groupY = useTransform(groupProgress, [0, 1], ['-8%', '8%']);

  useEffect(() => {
    const cached = sessionStorage.getItem('site_init_data');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (Array.isArray(data.locations)) setLocations(data.locations);
        if (Array.isArray(data.coaches)) setCoaches(data.coaches);
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
          if (Array.isArray(data.coaches)) setCoaches(data.coaches);
          if (data.content) setContent(data.content);
          sessionStorage.setItem('site_init_data', JSON.stringify(data));
        }
      })
      .catch(err => console.error('Error fetching init data:', err));
  }, []);

  const priceSingle = content?.personal_price_single || '900';
  const priceFirst = content?.personal_price_first || '450';

  // Персональну сторінку веде Ігор Котляревський — беремо його картку з бази тренерів
  const coach = coaches.find((c: any) => /Котляревськ/i.test(c?.name || '')) || null;
  const coachAchievements: string[] = (() => {
    const raw = coach?.achievements;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* fallthrough */
      }
    }
    return [
      '3 дан карате Кіокушинкай',
      'Майстер спорту України',
      'Чемпіон України',
      'Призер чемпіонатів Європи',
      '27 років у карате, засновник Black Bear Dojo'
    ];
  })();

  // Оффер діє один раз: тільки на перше відвідане заняття, не на перезапис
  const offerTerms = `Ціна ${priceFirst} грн діє один раз — на перше тренування, якщо ви записались і прийшли в узгоджений час. При перенесенні чи повторному записі заняття коштує ${priceSingle} грн.`;

  // Тренує особисто Ігор — лише зал на Шулявці
  const personalLocations = React.useMemo(() => {
    const found = (locations || []).filter((l: any) => /Бродськ/i.test(l?.name || ''));
    return found.length ? found : [{ id: 1, name: "Сім'ї Бродських", address: "вул. Сім'ї Бродських, 31/33\nКиїв, 03057 (м. Шулявська)" }];
  }, [locations]);

  const [quickLeadOpen, setQuickLeadOpen] = useState(false);

  // Липкий CTA на мобільному показуємо лише після першого екрана —
  // у hero вже дві кнопки і картка з ціною, третя кнопка лише перекриває їх.
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = heroRef.current;
      if (!el) return;
      // hero прокручено, коли його низ (там офер-картка з кнопкою) вийшов з екрана
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
  const openQuickLead = React.useCallback((ctaName: string) => {
    trackLeadIntent(ctaName, 'personal');
    setQuickLeadOpen(true);
  }, []);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });

  // PAS: біль → загострення → рішення. Чотири ситуації, з якими приходять дорослі.
  const pains = [
    {
      title: 'Ввечері додому — з ключами в кулаку',
      desc: 'Ви хочете не боятися, а знати, що робити. Поради з інтернету не працюють, коли хтось хапає за руку.'
    },
    {
      title: 'Спортзал набрид, а результату не видно',
      desc: 'Тренажери дають мʼязи, але не дають навички. Через місяць мотивація зникає, абонемент горить.'
    },
    {
      title: 'У групі — не ваш темп',
      desc: 'Двадцять людей, одна програма. Ваші помилки ніхто не бачить, техніка не ставиться.'
    },
    {
      title: 'Ніколи не займались — і соромно починати',
      desc: 'Здається, що карате — для тих, хто з дитинства. Насправді більшість дорослих приходять з нуля.'
    }
  ];

  // Шлях клієнта від заявки до плану — знімає невизначеність перед першим заняттям
  const process = [
    {
      step: '01',
      title: 'Заявка і дзвінок',
      desc: 'Залишаєте імʼя та номер. Ігор телефонує особисто: уточнює ціль, рівень і підбирає слот на Шулявці.'
    },
    {
      step: '02',
      title: 'Перше тренування — знайомство',
      desc: 'Розминка, тест базових рухів, розмова про ціль. Ви бачите, як працює формат, і вирішуєте, чи йти далі.'
    },
    {
      step: '03',
      title: 'План і перший результат',
      desc: 'Наприкінці — чіткий план: що тренуємо, як часто, чого чекати через місяць. Далі — разові заняття, без абонемента.'
    }
  ];

  const advantages = [
    {
      title: 'Безпека',
      desc: 'Дистанція, реакція, вихід із захвату, прості удари, що працюють у реальній ситуації, а не на показ. Мета — не потрапити в конфлікт, а якщо потрапили — вийти з нього цілим.',
      icon: <Target size={22} />
    },
    {
      title: 'Практичність',
      desc: 'Нічого заради ритуалу. Тільки те, що дає результат: техніка, реакція, дихання, контроль. Кожен рух — з поясненням, навіщо він і коли спрацює.',
      icon: <Brain size={22} />
    },
    {
      title: 'Фізична форма',
      desc: 'Удари руками й ногами, корпус, витривалість, гнучкість. Навантаження зростає поступово — без ривків і без травм.',
      icon: <TrendingUp size={22} />
    },
    {
      title: 'Ваш темп, ваша ціль',
      desc: 'Один на один: помилки видно одразу, темп під вас, план під вашу ціль. Після кожного заняття зрозуміло, що вже виходить і що далі.',
      icon: <Clock size={22} />
    }
  ];

  // Три кадри з фотосесії = три результати, за якими приходять дорослі
  const gallery: GalleryShot[] = [
    {
      src: PHOTOS.kick,
      alt: 'Удар ногою — фізична форма і гнучкість на тренуваннях з карате для дорослих',
      position: '50% 20%',
      zoom: 'scale-[1.3] group-hover:scale-[1.36]',
      tag: 'Форма',
      title: 'Тіло, яке слухається',
      desc: 'Гнучкість, корпус, витривалість — через удари, а не через тренажери.'
    },
    {
      src: PHOTOS.pair,
      alt: 'Чорні пояси клубу Black Bear Dojo — техніка карате кіокушинкай',
      position: '50% 15%',
      tag: 'Техніка',
      title: 'Від нуля до чорного поясу',
      desc: 'Кіхон, ката, робота в парах — крок за кроком, у вашому темпі.'
    },
    {
      src: PHOTOS.medals,
      alt: 'Учениця клубу з медалями змагань з карате',
      position: '50% 12%',
      tag: 'Впевненість',
      title: 'Спокій, який дає навичка',
      desc: 'Медалі — за бажанням. Впевненість у собі — у кожного, хто тренується.'
    }
  ];

  const privileges = [
    {
      title: 'Самооборона для міста',
      desc: 'Як не опинитися в небезпечній ситуації, а якщо опинилися — дистанція, реакція, вихід із захвату, перші дії. Техніка кіокушинкай не залежить від маси й сили.'
    },
    {
      title: 'Форма без спортзалу',
      desc: 'Кардіо, сила, гнучкість через карате. Регулярні заняття — і результат видно на тілі, а не лише на тренажері.'
    },
    {
      title: 'Впевненість у тілі',
      desc: 'Стійка, рівновага, удар, який має вагу. Тіло, яке слухається, і спокій, який це дає.'
    },
    {
      title: 'База карате з нуля',
      desc: 'Кіхон, ката, робота в парах — від першого кроку до іспиту на пояс, якщо є така ціль.'
    }
  ];

  const faq = [
    {
      q: 'Скільки коштує персональне тренування з карате в Києві?',
      a: `Разове персональне тренування — ${priceSingle} грн, без абонемента і без зобовʼязань. Перше тренування — ${priceFirst} грн: знайомство, розбір рівня підготовки, постановка цілі та плану. ${offerTerms}`
    },
    {
      q: 'Чому знижка 50% діє лише на перше тренування?',
      a: `Це не акція заради знижки, а спосіб познайомитись: ви приходите, ми розбираємо ваш рівень і вирішуємо, чи є сенс працювати далі. Тому ${priceFirst} грн діє рівно один раз — на перше заняття, на яке ви записались і прийшли. Якщо запис переноситься або оформлюється заново, тренування коштує ${priceSingle} грн.`
    },
    {
      q: 'Чи можна почати з нуля, без спортивного минулого?',
      a: 'Так. Персональний формат і створений для старту з нуля: навантаження підбирається під ваш стан і ціль, темп — ваш. Більшість дорослих приходять без досвіду в карате і без спортивного минулого.'
    },
    {
      q: 'Чи підходить карате для самооборони дівчатам і жінкам?',
      a: 'Так. У кіокушинкай техніка не залежить від маси й сили: дистанція, реакція, точка удару, вихід із захвату. Програма будується під ваш рівень і ціль, попередня підготовка не потрібна.'
    },
    {
      q: 'Хто проводить персональні тренування?',
      a: 'Ігор Котляревський — засновник клубу Black Bear Dojo, 3 дан карате Кіокушинкай, майстер спорту України, чемпіон України, призер чемпіонатів Європи, 27 років у карате. Персональні заняття він проводить особисто.'
    },
    {
      q: 'Де і коли проходять заняття?',
      a: "Зал на Шулявці, вул. Сім'ї Бродських, 31/33 (м. Шулявська). Персональні слоти — окремо від групових тренувань; час узгоджуємо після заявки."
    },
    {
      q: 'Чи безпечно тренуватися під час тривог?',
      a: 'Зал у безпечному приміщенні — тренування не зупиняється.'
    },
    {
      q: 'Що взяти на перше тренування?',
      a: 'Зручний спортивний одяг і воду. Кімоно на перше заняття не потрібне. Решту Ігор скаже під час дзвінка.'
    }
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-red-600 selection:text-white">
      <SEO
        title={content?.personal_seo_title || PAGE_SEO['/personal-training'].title}
        description={
          content?.personal_seo_description ||
          `${PAGE_SEO['/personal-training'].description} Перше тренування — ${priceFirst} грн замість ${priceSingle}.`
        }
        keywords={content?.personal_seo_keywords || PAGE_SEO['/personal-training'].keywords}
        image={PAGE_SEO['/personal-training'].image}
        imageAlt={PAGE_SEO['/personal-training'].imageAlt}
        url={`${SITE_URL}/personal-training`}
        jsonLd={shuliavkaGraph()}
      />

      {/* Прогрес прокрутки */}
      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="fixed top-0 left-0 right-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-red-700 via-red-500 to-red-700"
      />

      <Navbar />

      {/* ---------------------------------------------------------------- *
       * HERO — офер одразу, у першому екрані
       * ---------------------------------------------------------------- */}
      <section id="hero"
        ref={heroRef as any}
        className="relative flex min-h-[100svh] items-center overflow-hidden pt-28 pb-20"
      >
        {/* Тло: світло і тонка сітка ліній. Фото — у правій колонці (десктоп)
            або в шапці офер-картки (мобільний), а не за текстом */}
        <motion.div style={reduce ? undefined : { y: heroY, opacity: heroFade }} className="absolute inset-0 z-0">
          {/* червоне світло і тонка сітка ліній — «зал», а не плоский чорний */}
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

        {/* Вертикальна червона лінія-акцент по лівому краю (десктоп) */}
        <motion.span
          aria-hidden
          className="absolute left-6 top-32 hidden w-px origin-top bg-gradient-to-b from-red-600 via-red-600/60 to-transparent lg:left-8 xl:block"
          initial={reduce ? { height: 260 } : { height: 0 }}
          animate={{ height: 260 }}
          transition={{ duration: 1.2, delay: 0.4, ease: EASE }}
        />

        <div className={`${CONTAINER} relative z-10`}>
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 xl:gap-16">
            {/* Ліва колонка */}
            <div>
              <Reveal y={16}>
                <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-red-600/25 bg-red-600/10 px-4 py-2">
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400">
                    Ігор Котляревський · 3 дан<span className="hidden sm:inline"> · тренує особисто · Шулявка</span>
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <h1 className="mb-7 text-[clamp(2.5rem,7vw,5.5rem)] font-black uppercase leading-[0.98] tracking-tight md:leading-[0.92]">
                  Персональні
                  <br />
                  <span className="text-red-600">тренування</span>
                  <br />
                  з карате
                  <span className="mt-3 block text-[0.42em] font-black leading-tight tracking-[0.02em] text-zinc-400">
                    для дорослих у Києві
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={0.16}>
                <p className="mb-10 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg md:text-xl">
                  Один на один із засновником клубу. З нуля. Три речі, які відчуєте вже за перші тижні:
                  вмієте постояти за себе, тіло стає сильним і слухняним, форма зʼявляється без абонемента
                  у спортзал.
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Button className="whitespace-nowrap" onClick={() => openQuickLead('Personal CTA')}>
                    Записатись — {priceFirst} грн
                  </Button>
                  <Button variant="secondary" showIcon={false} className="max-sm:hidden" onClick={() => scrollTo('process')}>
                    Як проходить перше тренування
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={0.32}>
                <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  {['Для дорослих · з нуля', '3 дан кіокушинкай', 'Майстер спорту України', '27 років у карате', 'Зал на Шулявці'].map(item => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500"
                    >
                      <CheckCircle2 size={14} className="shrink-0 text-red-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            {/* Права колонка — фото учениці (чорний пояс) і офер-картка поверх нього */}
            <div className="relative lg:ml-auto lg:w-full lg:max-w-[500px] lg:pb-24 xl:max-w-[540px]">
              {!reduce ? (
                <motion.div
                  className="relative hidden lg:block"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 1, delay: 0.25, ease: EASE }}
                >
                  <HeroPhoto />
                </motion.div>
              ) : (
                <div className="relative hidden lg:block">
                  <HeroPhoto />
                </div>
              )}

            <Reveal delay={0.2} y={32} className="lg:absolute lg:inset-x-5 lg:bottom-0">
              <div className="relative">
                <div className="absolute -inset-px rounded-[32px] bg-gradient-to-b from-red-600/40 to-transparent" aria-hidden />
                <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/85 p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl md:p-8 lg:p-6">
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-600/20 blur-3xl" aria-hidden />

                  {/* Мобільний: фото — шапка картки, десктоп: фото поруч, тому тут ховаємо */}
                  <div className="relative -mx-7 -mt-7 mb-7 aspect-[16/11] overflow-hidden md:-mx-8 md:-mt-8 lg:hidden">
                    <img
                      src={PHOTOS.hero}
                      alt="Персональні тренування з карате для дорослих у Києві — учениця з чорним поясом"
                      fetchPriority="high"
                      decoding="async"
                      className="h-full w-full object-cover object-[50%_18%]"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" aria-hidden />
                    <span aria-hidden className="absolute left-5 top-5 h-6 w-6 border-l-2 border-t-2 border-red-600" />
                    <span aria-hidden className="absolute right-5 top-5 h-6 w-6 border-r-2 border-t-2 border-red-600" />
                  </div>

                  <div className="relative">
                    <div className="mb-5 flex flex-wrap items-center gap-3 lg:mb-3">
                      <span className="inline-flex rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                        Знижка 50%
                      </span>
                      <span className={`${EYEBROW} text-[10px]`}>Перше тренування</span>
                    </div>

                    <div className="mb-5 flex items-end gap-3 lg:mb-4">
                      <span className="text-6xl font-black leading-none text-red-600">
                        {priceFirst}
                      </span>
                      <span className="mb-1.5 text-xl font-black leading-none text-zinc-400">грн</span>
                      <span className="mb-1.5 text-2xl font-black leading-none text-zinc-600 line-through">
                        {priceSingle}
                      </span>
                    </div>

                    <p className={`${BODY} mb-7 border-b ${HAIRLINE} pb-7 text-sm lg:hidden`}>
                      Розминка, тест базових рухів, план під вашу ціль. Без зобовʼязань далі. Ціна діє один раз —
                      на перше заняття.
                    </p>

                    <Button className="w-full" onClick={() => openQuickLead('Personal CTA')}>
                      Забронювати слот
                    </Button>

                    <p className="mt-5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 lg:mt-3 lg:text-[10px]">
                      Вільних слотів на тиждень небагато
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
            </div>
          </div>
        </div>

        {/* Підказка прокрутки */}
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
       * БОЛІ — PAS: ситуації, з якими приходять
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="pains" className={`${SECTION_Y} bg-zinc-950`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Знайомо?">
            Коли спортзал і група <span className="text-zinc-600">не працюють</span>
          </SectionHeading>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pains.map((pain, i) => (
              <Reveal key={pain.title} delay={i * 0.08} className="h-full">
                <article className={`${CARD} flex h-full flex-col p-7`}>
                  <span className="mb-6 block h-1 w-10 rounded-full bg-red-600" aria-hidden />
                  <h3 className={`${H3} mb-3`}>{pain.title}</h3>
                  <p className={BODY}>{pain.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
            <p className="mx-auto mt-12 max-w-2xl text-center text-lg font-bold text-white md:text-xl">
              Персональний формат закриває всі чотири: навичка, а не абонемент; ваш темп, а не темп групи;
              старт з нуля без сорому.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ЧОМУ ПЕРСОНАЛЬНО
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="advantages" className={`${SECTION_Y} bg-black`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Що дає персональне тренування з карате">
            Безпека. Практичність. <Mark>Форма.</Mark>
          </SectionHeading>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((adv, i) => (
              <Reveal key={adv.title} delay={i * 0.08} className="h-full">
                <article className={`${CARD} group relative flex h-full flex-col overflow-hidden p-7 transition-colors duration-500 hover:border-red-600/40`}>
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-red-600 to-transparent transition-transform duration-700 group-hover:scale-x-100"
                  />
                  <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600/10 text-red-600 transition-transform duration-500 group-hover:scale-110">
                    {adv.icon}
                  </div>
                  <h3 className={`${H3} mb-3`}>{adv.title}</h3>
                  <p className={BODY}>{adv.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ФОТО — три результати, які видно: форма, техніка, результат
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="gallery" className={`${SECTION_Y} relative overflow-hidden bg-zinc-950`}>
        <div
          className="pointer-events-none absolute right-0 top-1/2 h-[520px] w-[520px] -translate-y-1/2 translate-x-1/3 rounded-full bg-red-600/10 blur-[150px]"
          aria-hidden
        />
        <div className={`${CONTAINER} relative z-10`}>
          <SectionHeading eyebrow="Форма · Техніка · Впевненість">
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
       * ЯК ЦЕ ПРАЦЮЄ — шлях від заявки до плану
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="process" className={`${SECTION_Y} bg-zinc-950`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Як це працює">
            Перше тренування — <Mark>три кроки</Mark>
          </SectionHeading>

          <ol className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
            {process.map((item, i) => (
              <Reveal key={item.step} delay={i * 0.1} className="h-full">
                <li className={`${CARD} relative flex h-full flex-col p-8`}>
                  <span className="mb-6 text-5xl font-black leading-none text-red-600/80">{item.step}</span>
                  <h3 className={`${H3} mb-3`}>{item.title}</h3>
                  <p className={BODY}>{item.desc}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={0.3}>
            <div className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-4 text-center">
              <Button onClick={() => openQuickLead('Process CTA')}>Записатись за {priceFirst} грн</Button>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
                Без абонемента · без зобовʼязань · відповідь на заявку — особисто від Ігоря
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ТРЕНЕР — на персональній сторінці довіра має йти одразу за офером
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="coach" className={`${SECTION_Y} overflow-x-clip bg-black`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Тренер з карате">
            Хто буде вашим <Mark>тренером</Mark>
          </SectionHeading>

          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal y={32}>
              <div className="relative">
                <div className="absolute -inset-4 rounded-[48px] border border-red-600/20" aria-hidden />
                <div className="pointer-events-none absolute -inset-8 rounded-full bg-red-600/15 blur-3xl" aria-hidden />
                <span aria-hidden className="absolute -left-2 -top-2 z-10 h-8 w-8 border-l-2 border-t-2 border-red-600" />
                <span aria-hidden className="absolute -bottom-2 -right-2 z-10 h-8 w-8 border-b-2 border-r-2 border-red-600" />
                {/* Фото тренера — головний елемент довіри. Після оптимізації це
                    73 КБ webp, тож вантажимо одразу (без lazy), щоб воно точно
                    було на місці, коли користувач дійде до секції. */}
                <OptimizedImg
                  src={content?.personal_coach_photo || '/coach-igor-personal.jpg'}
                  width={1080}
                  alt="Ігор Котляревський — тренер з карате, Black Bear Dojo"
                  className="relative aspect-[4/5] w-full rounded-[32px] bg-zinc-900 object-cover grayscale-[35%] transition-all duration-700 hover:grayscale-0"
                  decoding="async"
                />
              </div>
            </Reveal>

            <div>
              <Reveal delay={0.1}>
                <h3 className="mb-2 text-4xl font-black uppercase leading-none tracking-tight md:text-5xl">
                  {coach?.name || 'Ігор Котляревський'}
                </h3>
                <p className="mb-9 text-[11px] font-black uppercase tracking-[0.28em] text-red-500">
                  {coach?.role || 'Засновник клубу'}
                </p>
              </Reveal>

              <ul className="mb-9 space-y-3.5">
                {coachAchievements.map((item, i) => (
                  <Reveal key={item} delay={0.16 + i * 0.06}>
                    <li className="flex items-start gap-3.5 text-[15px] font-medium text-zinc-300">
                      <Medal size={18} className="mt-0.5 shrink-0 text-red-600" />
                      {item}
                    </li>
                  </Reveal>
                ))}
              </ul>

              <Reveal delay={0.4}>
                <figure className={`${CARD} mb-8 p-7 md:p-8`}>
                  <Quote size={26} className="mb-4 text-red-600" aria-hidden />
                  <blockquote className="mb-4 text-[15px] italic leading-relaxed text-zinc-300">
                    Персональне тренування — не про красиві рухи. Це про те, щоб ви вміли постояти за себе
                    і почувалися сильними у власному тілі. Решта — техніка, і її я поставлю.
                  </blockquote>
                  <figcaption className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                    — {coach?.name || 'Ігор Котляревський'}
                  </figcaption>
                </figure>
              </Reveal>

              <Reveal delay={0.48}>
                <p className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">
                  <MapPin size={15} className="shrink-0 text-red-600" />
                  Зал на Шулявці — вул. Сім&apos;ї Бродських, 31/33
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * СОЦІАЛЬНИЙ ДОКАЗ — Ігор з дорослими ученицями, широкий кадр
       * ---------------------------------------------------------------- */}
      <section id="students" ref={groupRef as any} className="relative overflow-hidden bg-black">
        <div className="relative min-h-[520px] md:min-h-[600px]">
          <motion.img
            src={PHOTOS.group}
            alt="Ігор Котляревський з дорослими ученицями клубу Black Bear Dojo"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover object-[42%_25%] md:object-[50%_25%]"
            style={reduce ? undefined : { y: groupY }}
          />
          {/* Обличчя — у верхній половині кадру, текст — унизу, тому затемнення знизу, а не збоку */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent" aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black to-transparent" aria-hidden />

          <div className={`${CONTAINER} relative z-10 flex min-h-[560px] items-end pb-16 pt-64 md:min-h-[680px] md:pb-20`}>
            <div className="grid w-full items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <Reveal>
                  <Eyebrow>Дорослі учні клубу</Eyebrow>
                  <h2 className="text-3xl font-black uppercase leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
                    Приходять з нуля. <br className="hidden sm:block" />
                    <span className="text-zinc-400">Лишаються за</span> <Mark>результат.</Mark>
                  </h2>
                </Reveal>
              </div>
              <div>
                <Reveal delay={0.1}>
                  <p className={`${BODY} mb-8 max-w-md text-base`}>
                    Попередній досвід не потрібен. Персональний формат — це той самий тренер і та сама школа,
                    що в групах клубу, але вся увага на тренуванні — вам.
                  </p>
                </Reveal>
                <Reveal delay={0.2}>
                  <dl className="grid grid-cols-3 gap-4 border-l-2 border-red-600 pl-5 sm:gap-6 sm:pl-6">
                  {[
                    ['27', 'років у карате'],
                    ['3 дан', 'кіокушинкай'],
                    ['1 на 1', 'з засновником']
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
       * ВАРТІСТЬ — офер
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="pricing" className={`${SECTION_Y} relative overflow-hidden bg-zinc-950`}>
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-red-600/[0.07] blur-[130px]"
          aria-hidden
        />
        <div className={`${CONTAINER} relative z-10`}>
          <SectionHeading eyebrow="Вартість персонального тренування з карате">
            Чесна ціна. <br className="hidden sm:block" />
            <Mark>Без абонемента</Mark>
          </SectionHeading>

          <div className="mx-auto grid max-w-4xl items-stretch gap-5 md:grid-cols-2">
            {/* Перше тренування */}
            <Reveal className="h-full">
              <article className="relative flex h-full flex-col rounded-[28px] border-2 border-red-600 bg-zinc-900 p-8 shadow-[0_24px_70px_-20px_rgba(209,0,0,0.35)] md:rounded-[32px] md:p-10">
                <span className="absolute -top-3 left-8 rounded-full bg-red-600 px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  Знижка 50%
                </span>

                <h3 className={`${H3} mb-2.5`}>Перше тренування</h3>
                <p className={`${BODY} mb-8`}>
                  Знайомство, розбір рівня підготовки, постановка цілі та плану. Далі вирішуєте ви.
                </p>

                <div className="mb-6 flex items-end gap-3">
                  <span className="text-6xl font-black leading-none text-red-600">{priceFirst}</span>
                  <span className="mb-1.5 text-lg font-black leading-none text-zinc-400">грн</span>
                  <span className="mb-1.5 text-2xl font-black leading-none text-zinc-600 line-through">
                    {priceSingle}
                  </span>
                </div>

                <p className={`${BODY} mb-8 border-b ${HAIRLINE} pb-8 text-sm`}>
                  Ціна діє один раз — на перше тренування, якщо ви записались і прийшли в узгоджений
                  час. При перенесенні чи повторному записі — {priceSingle} грн.
                </p>

                <Button className="mt-auto w-full" onClick={() => openQuickLead('Personal CTA')}>
                  Записатись
                </Button>
              </article>
            </Reveal>

            {/* Разове */}
            <Reveal delay={0.1} className="h-full">
              <article className={`${CARD} flex h-full flex-col p-8 md:p-10`}>
                <h3 className={`${H3} mb-2.5`}>Разове тренування</h3>
                <p className={`${BODY} mb-8`}>
                  Далі — за фактом заняття. Без абонемента і без зобов&apos;язань.
                </p>

                <div className="mb-6 flex items-end gap-3">
                  <span className="text-6xl font-black leading-none text-white">{priceSingle}</span>
                  <span className="mb-1.5 text-lg font-black leading-none text-zinc-400">грн</span>
                </div>

                <div className="mt-auto">
                  <p className={`${BODY} mb-8 border-b ${HAIRLINE} pb-8 text-sm`}>
                    Стандартна ціна персонального тренування. Кількість занять і графік — на ваш
                    розсуд.
                  </p>

                  <Button variant="secondary" showIcon={false} className="w-full" onClick={() => openQuickLead('Personal CTA')}>
                    Підібрати час
                  </Button>
                </div>
              </article>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <p className="mx-auto mt-12 max-w-2xl text-center text-[11px] font-black uppercase leading-relaxed tracking-[0.14em] text-zinc-500">
              Персональні тренування веду особисто — вільних слотів на тиждень небагато
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ФОРМАТ ЗАНЯТТЯ
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="goals" className={`${SECTION_Y} bg-black`}>
        <div className={CONTAINER}>
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <PhotoReveal
              src={PHOTOS.student}
              alt="Ігор Котляревський з ученицею — персональне тренування з карате один на один"
              className="w-full max-w-lg lg:max-w-none"
              imgClassName="aspect-[4/5]"
              position="50% 20%"
            >
              <div className="absolute bottom-6 left-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-red-500">Формат</span>
                <span className="block text-sm font-black uppercase tracking-tight text-white">Один на один з тренером</span>
              </div>
            </PhotoReveal>

            <div>
              <Reveal>
                <Eyebrow>Для кого</Eyebrow>
                <h2 className="mb-12 text-[32px] font-black uppercase leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
                  Самооборона, форма, техніка — одна програма <Mark>під вас</Mark>
                </h2>
              </Reveal>

              <ul className="space-y-7">
                {privileges.map((priv, i) => (
                  <Reveal key={priv.title} delay={0.1 + i * 0.08}>
                    <li className="group flex gap-5">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${HAIRLINE} bg-black text-red-600 transition-colors duration-300 group-hover:border-red-600/50`}>
                        <CheckCircle2 size={18} />
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
       * FAQ
       * ---------------------------------------------------------------- */}
      <Divider />
      <section id="faq" className={`${SECTION_Y} bg-zinc-950`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Часті запитання">
            Питання перед <span className="text-zinc-600">першим тренуванням</span>
          </SectionHeading>

          <div className="mx-auto max-w-3xl space-y-3">
            {faq.map((item, i) => (
              <Reveal key={item.q} delay={i * 0.05}>
                <details className={`group overflow-hidden rounded-3xl border ${HAIRLINE} bg-zinc-900/40 transition-colors duration-300 hover:border-red-600/30 open:border-red-600/30`}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 p-6 [&::-webkit-details-marker]:hidden">
                    <span className="text-[15px] font-black uppercase leading-snug tracking-tight text-white">
                      {item.q}
                    </span>
                    <ChevronDown
                      size={20}
                      className="shrink-0 text-red-600 transition-transform duration-300 group-open:rotate-180"
                      aria-hidden
                    />
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
        source="personal_landing"
        locations={personalLocations}
        ageGroups={PERSONAL_GOALS}
        ageLabel="Ціль"
        namePlaceholder="Імʼя"
        title="Запис на персональне тренування"
        subtitle={`Перше тренування — ${priceFirst} грн замість ${priceSingle}. Залиште номер — Ігор особисто зателефонує і підбере слот.`}
      />

      <ContactForm
        locations={personalLocations}
        contacts={[{ name: 'Ігор Котляревський', phone: '+380954756500' }]}
        title={`Перше тренування — ${priceFirst} грн замість ${priceSingle}`}
        subtitle="Залиште імʼя і номер — Ігор особисто зателефонує, уточнить ціль і підбере слот на Шулявці. Без абонемента, без зобовʼязань."
        ageGroups={PERSONAL_GOALS}
        ageLabel="Ціль"
        namePlaceholder="Імʼя"
        source="personal_landing"
        submitLabel={`Записатись за ${priceFirst} грн`}
        offerNote={
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600">
              <Flame className="text-white" size={21} />
            </span>
            <span>
              <span className="mb-1 block text-sm font-black uppercase tracking-tight text-white">
                Перше тренування — {priceFirst} грн замість {priceSingle}
              </span>
              <span className="block text-xs font-medium leading-relaxed text-zinc-400">
                {offerTerms}
              </span>
            </span>
          </div>
        }
      />

      {/* ---------------------------------------------------------------- *
       * FOOTER
       * ---------------------------------------------------------------- */}
      {/* pb-28 на мобільному — щоб липкий CTA не перекривав підвал */}
      <footer className={`border-t ${HAIRLINE} bg-black pt-12 pb-28 md:pb-12`}>
        <div className={`${CONTAINER} flex flex-col items-center justify-between gap-7 md:flex-row`}>
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 rotate-3 items-center justify-center bg-red-600">
              <span className="text-xs font-black italic text-white">B</span>
            </span>
            <span className="text-sm font-black tracking-tight">Black Bear Dojo</span>
          </Link>

          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            © 2026 Black Bear Dojo. Всі права захищені.
          </p>

          <div className="flex gap-6">
            <a
              href={content?.social_instagram || 'https://instagram.com/karate_kyiv'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-zinc-500 transition-colors hover:text-white"
            >
              <Instagram size={19} />
            </a>
            <a
              href={content?.social_facebook || 'https://www.facebook.com/karatee.kyiv/'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-zinc-500 transition-colors hover:text-white"
            >
              <Facebook size={19} />
            </a>
          </div>
        </div>
      </footer>

      {/* Липкий CTA на мобільному */}
      <div className="fixed inset-x-4 bottom-4 z-50 md:hidden">
        <motion.button
          type="button"
          initial={false}
          animate={{ y: pastHero ? 0 : 120, opacity: pastHero ? 1 : 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          whileTap={{ scale: 0.97 }}
          aria-hidden={!pastHero}
          tabIndex={pastHero ? 0 : -1}
          onClick={() => openQuickLead('Personal CTA')}
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-[#D10000] to-[#A80000] text-[13px] font-black uppercase tracking-[0.12em] text-white shadow-[0_16px_40px_-10px_rgba(209,0,0,0.8)]"
        >
          <Send size={17} />
          Перше тренування — {priceFirst} грн
        </motion.button>
      </div>
    </div>
  );
};
