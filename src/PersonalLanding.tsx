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
import SEO from './components/SEO';
import { ContactForm } from './components/ContactForm';

/* ------------------------------------------------------------------ *
 * Design tokens — одна шкала на всю сторінку.
 * Радіуси: 16px (контроли) · 32px (картки) · full (пігулки).
 * Ритм: SECTION_Y для всіх секцій. Типографіка: EYEBROW / H2 / H3 / BODY.
 * ------------------------------------------------------------------ */
const CONTAINER = 'mx-auto w-full max-w-7xl px-6 lg:px-8';
const SECTION_Y = 'py-20 md:py-28 lg:py-32';
const CARD = 'rounded-[28px] md:rounded-[32px] border border-white/10 bg-zinc-900/40';
const EYEBROW = 'text-[11px] font-black uppercase tracking-[0.35em] text-red-500';
const H2 = 'text-[32px] leading-[1.05] sm:text-5xl md:text-6xl font-black uppercase tracking-tight';
const H3 = 'text-lg md:text-xl font-black uppercase tracking-tight text-white';
const BODY = 'text-[15px] leading-relaxed text-zinc-400 font-medium';
const HAIRLINE = 'border-white/10';

// Єдиний easing і тривалість — щоб рухи сприймались як один почерк
const EASE = [0.22, 1, 0.36, 1] as const;
const DUR = 0.7;

/** Scroll-reveal з повагою до prefers-reduced-motion */
const Reveal = ({
  children,
  delay = 0,
  y = 24,
  className = ''
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) => {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: DUR, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className={`${EYEBROW} block mb-5`}>{children}</span>
);

/** Заголовок секції — однакова структура і однакові відступи скрізь */
const SectionHeading = ({
  eyebrow,
  children,
  align = 'center',
  className = ''
}: {
  eyebrow: string;
  children: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) => (
  <Reveal className={`${align === 'center' ? 'text-center mx-auto max-w-3xl' : 'max-w-3xl'} mb-14 md:mb-20 ${className}`}>
    <Eyebrow>{eyebrow}</Eyebrow>
    <h2 className={H2}>{children}</h2>
  </Reveal>
);

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
  const isLocal = typeof src === 'string' && src.startsWith('/');
  const optimized = isLocal
    ? `/_vercel/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`
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

const Button = ({
  children,
  variant = 'primary',
  className = '',
  showIcon = true,
  ...props
}: any) => {
  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-b from-[#D10000] to-[#A80000] text-white shadow-[0_10px_30px_-8px_rgba(209,0,0,0.6)] hover:shadow-[0_16px_40px_-8px_rgba(209,0,0,0.75)] hover:-translate-y-0.5',
    secondary:
      'bg-white/[0.03] border border-white/15 text-white hover:bg-white/[0.08] hover:border-white/35 hover:-translate-y-0.5'
  };
  return (
    <button
      className={`h-14 px-8 rounded-2xl text-[13px] font-black uppercase tracking-[0.12em] transition-all duration-300 inline-flex items-center justify-center gap-2.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${variants[variant]} ${className}`}
      {...props}
    >
      <span>{children}</span>
      {variant === 'primary' && showIcon && <ChevronRight size={16} className="shrink-0" />}
    </button>
  );
};

export const PersonalLanding = () => {
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
      'Призер чемпіонатів Європи'
    ];
  })();

  // Оффер діє один раз: тільки на перше відвідане заняття, не на перезапис
  const offerTerms = `Ціна ${priceFirst} грн діє один раз — на перше тренування, якщо ви записались і прийшли в узгоджений час. При перенесенні чи повторному записі заняття коштує ${priceSingle} грн.`;

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });

  const advantages = [
    {
      title: 'Увага до техніки',
      desc: 'Тренер бачить помилки одразу, пояснює простіше і допомагає відпрацювати рух у вашому темпі.',
      icon: <Target size={22} />
    },
    {
      title: 'Зручний темп',
      desc: 'Навантаження підбирається під вік, рівень підготовки та ціль: форма, самооборона, пояс або впевненість.',
      icon: <Clock size={22} />
    },
    {
      title: 'Чітка ціль',
      desc: 'Перед стартом визначаємо, над чим працюємо: база карате, координація, удари руками й ногами, витривалість.',
      icon: <Brain size={22} />
    },
    {
      title: 'Зрозумілий прогрес',
      desc: 'Після занять зрозуміло, що вже виходить, що потрібно підтягнути і який наступний крок у тренуваннях.',
      icon: <TrendingUp size={22} />
    }
  ];

  const privileges = [
    {
      title: 'Старт з розбору цілі',
      desc: 'Узгоджуємо вік, досвід, стан підготовки та бажаний результат без зайвих обіцянок.'
    },
    {
      title: 'Робота над помилками',
      desc: 'Більше повторень, детальніші пояснення і корекція техніки під час заняття.'
    },
    {
      title: 'Підготовка до іспитів',
      desc: 'Відпрацювання ката, кіхону та базових вимог для складання на пояс.'
    },
    {
      title: 'Практична самооборона',
      desc: "Дистанція, реакція, стійка, прості зв'язки руками й ногами для впевненішої поведінки."
    }
  ];

  const faq = [
    {
      q: 'Скільки коштує персональне тренування?',
      a: `Персональне тренування — ${priceSingle} грн. Перше тренування — ${priceFirst} грн: це знайомство, розбір рівня підготовки та постановка цілі. ${offerTerms}`
    },
    {
      q: 'Чому знижка діє лише на перше тренування?',
      a: `Це не акція заради знижки, а спосіб познайомитись: ви приходите, ми розбираємо ваш рівень і вирішуємо, чи є сенс працювати далі. Тому ${priceFirst} грн діє рівно один раз — на перше заняття, на яке ви записались і прийшли. Якщо запис переноситься або оформлюється заново, тренування коштує ${priceSingle} грн.`
    },
    {
      q: 'Чи потрібна попередня підготовка?',
      a: 'Ні. Персональний формат і створений для того, щоб починати з будь-якого рівня: навантаження підбирається під ваш вік, стан і ціль. Більшість приходить без досвіду в карате.'
    },
    {
      q: 'Хто проводить персональні тренування?',
      a: 'Ігор Котляревський — засновник клубу Black Bear Dojo, 3 дан карате Кіокушинкай, майстер спорту України, чемпіон України, призер чемпіонатів Європи. Персональні заняття він проводить особисто.'
    },
    {
      q: 'Для кого підходить персональний формат?',
      a: 'Для дітей, підлітків і дорослих. Найчастіше його беруть, коли треба підтягнути техніку перед іспитом на пояс, наздогнати групу, розібратися з базою з нуля або займатися в спокійному темпі без групи.'
    },
    {
      q: 'Де проходять заняття?',
      a: "Основний зал — Шулявка, вул. Сім'ї Бродських, 31/33 (м. Шулявська). Також доступний зал на Сирці, вул. Віктора Некрасова, 1-3. Локацію і час узгоджуємо після заявки."
    }
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-red-600 selection:text-white">
      <SEO
        title={content?.personal_seo_title || 'Персональні тренування з карате у Києві | Ігор Котляревський, 3 дан'}
        description={
          content?.personal_seo_description ||
          `Персональні тренування з карате у Києві з Ігорем Котляревським — 3 дан кіокушинкай, майстер спорту України. Перше тренування — ${priceFirst} грн замість ${priceSingle}. Розбір техніки, підготовка до іспитів, самооборона. Зал на Шулявці.`
        }
        keywords={
          content?.personal_seo_keywords ||
          'персональні тренування карате київ, індивідуальні заняття карате київ, тренер з карате київ, ігор котляревський карате, приватні уроки карате київ, карате шулявка індивідуально'
        }
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
      <section
        ref={heroRef as any}
        className="relative flex min-h-[100svh] items-center overflow-hidden pt-28 pb-20"
      >
        <motion.div style={reduce ? undefined : { y: heroY, opacity: heroFade }} className="absolute inset-0 z-0">
          <img
            src={
              content?.personal_hero_bg ||
              'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=2000&auto=format&fit=crop'
            }
            alt=""
            aria-hidden
            className="h-full w-full scale-110 object-cover opacity-40 grayscale"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/40" />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black to-transparent" />
        </motion.div>

        <div className={`${CONTAINER} relative z-10`}>
          <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            {/* Ліва колонка */}
            <div>
              <Reveal y={16}>
                <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-red-600/25 bg-red-600/10 px-4 py-2">
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400">
                    Тренує особисто Ігор Котляревський · 3 дан
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
                </h1>
              </Reveal>

              <Reveal delay={0.16}>
                <p className="mb-10 max-w-xl text-lg leading-relaxed text-zinc-300 md:text-xl">
                  Один на один із засновником клубу: точний розбір техніки, темп під вас і повна увага
                  все заняття. Починаємо зі знайомства — визначаємо рівень, ціль і план роботи.
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Button onClick={() => scrollTo('contact')}>Записатись за {priceFirst} грн</Button>
                  <Button variant="secondary" showIcon={false} onClick={() => scrollTo('pricing')}>
                    Вартість і формат
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={0.32}>
                <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  {['3 дан кіокушинкай', 'Майстер спорту України', 'Зал на Шулявці'].map(item => (
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

            {/* Права колонка — офер-картка */}
            <Reveal delay={0.2} y={32}>
              <div className="relative">
                <div className="absolute -inset-px rounded-[32px] bg-gradient-to-b from-red-600/40 to-transparent" aria-hidden />
                <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/80 p-8 backdrop-blur-xl md:p-10">
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-600/20 blur-3xl" aria-hidden />

                  <div className="relative">
                    <div className="mb-6 inline-flex rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                      Знижка 50%
                    </div>

                    <p className={`${EYEBROW} mb-4`}>Перше тренування</p>

                    <div className="mb-5 flex items-end gap-3">
                      <span className="text-6xl font-black leading-none text-red-600 md:text-7xl">
                        {priceFirst}
                      </span>
                      <span className="mb-1.5 text-xl font-black leading-none text-zinc-400">грн</span>
                      <span className="mb-1.5 text-2xl font-black leading-none text-zinc-600 line-through">
                        {priceSingle}
                      </span>
                    </div>

                    <p className={`${BODY} mb-8 border-b ${HAIRLINE} pb-8`}>
                      Діє один раз — якщо записались і прийшли в узгоджений час. При перенесенні чи
                      повторному записі — {priceSingle} грн.
                    </p>

                    <Button className="w-full" onClick={() => scrollTo('contact')}>
                      Забронювати слот
                    </Button>

                    <p className="mt-5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                      Вільних слотів на тиждень небагато
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Підказка прокрутки */}
        {!reduce && (
          <motion.button
            type="button"
            aria-label="Прокрутити далі"
            onClick={() => scrollTo('coach')}
            className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 text-zinc-600 transition-colors hover:text-white lg:block"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown size={26} />
          </motion.button>
        )}
      </section>

      {/* ---------------------------------------------------------------- *
       * ТРЕНЕР — на персональній сторінці довіра має йти одразу за офером
       * ---------------------------------------------------------------- */}
      <section id="coach" className={`${SECTION_Y} border-t ${HAIRLINE} bg-zinc-950`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Хто тренує">
            Тренує <span className="text-red-600">особисто</span>
          </SectionHeading>

          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal y={32}>
              <div className="relative">
                <div
                  className="absolute -inset-4 rounded-[48px] border border-red-600/20"
                  aria-hidden
                />
                <OptimizedImg
                  src={coach?.photo || '/api/images/coaches/1'}
                  width={1080}
                  alt="Ігор Котляревський — тренер з карате, Black Bear Dojo"
                  className="relative aspect-[4/5] w-full rounded-[32px] bg-zinc-900 object-cover grayscale transition-all duration-700 hover:grayscale-0"
                  loading="lazy"
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
                    {coach?.bio ||
                      'Моя мета — не просто навчити битися, а сформувати характер, який допоможе дитині перемагати в житті.'}
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
       * ЧОМУ ПЕРСОНАЛЬНО
       * ---------------------------------------------------------------- */}
      <section id="advantages" className={`${SECTION_Y} border-t ${HAIRLINE} bg-black`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Чому персонально?">
            Менше хаосу. <span className="text-zinc-600">Більше техніки</span>
          </SectionHeading>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((adv, i) => (
              <Reveal key={adv.title} delay={i * 0.08} className="h-full">
                <article className={`${CARD} group flex h-full flex-col p-7 transition-colors duration-500 hover:border-red-600/40`}>
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
       * ФОРМАТ ЗАНЯТТЯ
       * ---------------------------------------------------------------- */}
      <section className={`${SECTION_Y} border-t ${HAIRLINE} bg-zinc-950`}>
        <div className={CONTAINER}>
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <Reveal y={32}>
              <div className="relative">
                <div className="absolute -inset-4 rounded-[48px] border border-red-600/20" aria-hidden />
                <img
                  src={
                    content?.personal_advantages_image ||
                    'https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1000&auto=format&fit=crop'
                  }
                  alt="Персональне тренування з карате"
                  className="relative aspect-[4/3] w-full rounded-[32px] object-cover grayscale transition-all duration-700 hover:grayscale-0"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
            </Reveal>

            <div>
              <Reveal>
                <Eyebrow>Формат заняття</Eyebrow>
                <h2 className={`${H2} mb-12`}>
                  Тренування під вашу <span className="text-red-600">ціль</span>
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
       * ВАРТІСТЬ — офер
       * ---------------------------------------------------------------- */}
      <section id="pricing" className={`${SECTION_Y} relative overflow-hidden border-t ${HAIRLINE} bg-black`}>
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-red-600/[0.07] blur-[130px]"
          aria-hidden
        />
        <div className={`${CONTAINER} relative z-10`}>
          <SectionHeading eyebrow="Вартість">
            Чесна ціна. <span className="text-zinc-600">Без абонемента</span>
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
                  Знайомство, розбір рівня підготовки, постановка цілі та плану.
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

                <Button className="mt-auto w-full" onClick={() => scrollTo('contact')}>
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

                <p className={`${BODY} mb-8 border-b ${HAIRLINE} pb-8 text-sm`}>
                  Стандартна ціна персонального тренування. Кількість занять і графік — на ваш
                  розсуд.
                </p>

                <Button variant="secondary" showIcon={false} className="mt-auto w-full" onClick={() => scrollTo('contact')}>
                  Підібрати час
                </Button>
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
       * FAQ
       * ---------------------------------------------------------------- */}
      <section className={`${SECTION_Y} border-t ${HAIRLINE} bg-zinc-950`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Часті запитання">
            Коротко про <span className="text-zinc-600">головне</span>
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
       * ЗАЛИ
       * ---------------------------------------------------------------- */}
      <section className={`${SECTION_Y} border-t ${HAIRLINE} bg-black`}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow="Де ми тренуємо">
            Наші зали у <span className="text-zinc-600">Києві</span>
          </SectionHeading>

          <div className="grid items-stretch gap-5 md:grid-cols-2">
            {[
              {
                name: 'Шулявка',
                address:
                  "вул. Сім'ї Бродських, 31/33 (м. Шулявська). Зручна локація для мешканців КПІ, Шулявки та Лук'янівки.",
                time: 'Пн, Ср, Пт: 17:00 – 20:30'
              },
              {
                name: 'Відрадний / Сирець',
                address:
                  'вул. Віктора Некрасова, 1-3. Секція карате для мешканців Відрадного, Сирця та Нивок.',
                time: 'Пн, Ср, Пт: 17:00 – 19:00'
              }
            ].map((loc, i) => (
              <Reveal key={loc.name} delay={i * 0.1} className="h-full">
                <article className={`${CARD} group flex h-full flex-col p-8 transition-colors duration-500 hover:border-red-600/40`}>
                  <div className="mb-6 flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600/10 text-red-600 transition-colors duration-300 group-hover:bg-red-600 group-hover:text-white">
                      <MapPin size={20} />
                    </span>
                    <h3 className="text-xl font-black uppercase tracking-tight md:text-2xl">
                      {loc.name}
                    </h3>
                  </div>
                  <p className={`${BODY} mb-7`}>{loc.address}</p>
                  <p className="mt-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-500">
                    <Clock size={13} className="shrink-0" />
                    {loc.time}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * ЗАЯВКА
       * ---------------------------------------------------------------- */}
      <ContactForm
        locations={locations}
        title="Запис на персональне тренування"
        subtitle="Залиште номер — Ігор особисто зателефонує, уточнить ціль, рівень підготовки та підбере вільний слот."
        ageGroups={[
          { value: 'Дорослий', label: 'Дорослий' },
          { value: 'Підліток', label: 'Підліток' },
          { value: 'Дитина', label: 'Дитина' }
        ]}
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
            <a href="#" aria-label="Instagram" className="text-zinc-500 transition-colors hover:text-white">
              <Instagram size={19} />
            </a>
            <a href="#" aria-label="Facebook" className="text-zinc-500 transition-colors hover:text-white">
              <Facebook size={19} />
            </a>
          </div>
        </div>
      </footer>

      {/* Липкий CTA на мобільному */}
      <div className="fixed inset-x-4 bottom-4 z-50 md:hidden">
        <motion.button
          type="button"
          initial={reduce ? false : { y: 100 }}
          animate={{ y: 0 }}
          transition={{ duration: DUR, ease: EASE, delay: 0.6 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => scrollTo('contact')}
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-[#D10000] to-[#A80000] text-[13px] font-black uppercase tracking-[0.12em] text-white shadow-[0_16px_40px_-10px_rgba(209,0,0,0.8)]"
        >
          <Send size={17} />
          Перше тренування — {priceFirst} грн
        </motion.button>
      </div>
    </div>
  );
};
