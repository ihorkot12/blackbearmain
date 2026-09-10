import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronRight } from 'lucide-react';

/* ------------------------------------------------------------------ *
 * Design tokens — одна шкала на всю сторінку.
 * Радіуси: 16px (контроли) · 32px (картки) · full (пігулки).
 * Ритм: SECTION_Y для всіх секцій. Типографіка: EYEBROW / H2 / H3 / BODY.
 * ------------------------------------------------------------------ */
export const CONTAINER = 'mx-auto w-full max-w-7xl px-6 lg:px-8';
export const SECTION_Y = 'py-20 md:py-28 lg:py-32';
export const CARD = 'rounded-[28px] md:rounded-[32px] border border-white/10 bg-zinc-900/40';
export const EYEBROW = 'text-[11px] font-black uppercase tracking-[0.35em] text-red-500';
export const H2 = 'text-[32px] leading-[1.05] sm:text-5xl md:text-6xl font-black uppercase tracking-tight';
export const H3 = 'text-lg md:text-xl font-black uppercase tracking-tight text-white';
export const BODY = 'text-[15px] leading-relaxed text-zinc-400 font-medium';
export const HAIRLINE = 'border-white/10';

// Єдиний easing і тривалість — щоб рухи сприймались як один почерк
export const EASE = [0.22, 1, 0.36, 1] as const;
export const DUR = 0.7;

/** Scroll-reveal з повагою до prefers-reduced-motion */
export const Reveal = ({
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

export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className={`${EYEBROW} block mb-5`}>{children}</span>
);

/** Заголовок секції — однакова структура і однакові відступи скрізь */
export const SectionHeading = ({
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

export const Button = ({
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

/** Роздільник секцій: тонка лінія з червоним акцентом по центру замість плоского border-t */
export const Divider = () => (
  <div aria-hidden className="relative h-px w-full bg-white/10">
    <span className="absolute left-1/2 top-0 h-px w-40 -translate-x-1/2 bg-gradient-to-r from-transparent via-red-600 to-transparent md:w-72" />
  </div>
);

/** Ключове слово з червоним підкресленням, що «промальовується» при появі.
 *  Реалізовано фоном, а не абсолютним елементом — тому працює і на фразі
 *  в кілька рядків (кожен рядок отримує свою лінію). */
export const Mark = ({ children }: { children: React.ReactNode }) => {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="[-webkit-box-decoration-break:clone] [box-decoration-break:clone]"
      style={{
        backgroundImage: 'linear-gradient(rgba(220,38,38,0.85), rgba(220,38,38,0.85))',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: '0 92%'
      }}
      initial={reduce ? { backgroundSize: '100% 0.14em' } : { backgroundSize: '0% 0.14em' }}
      whileInView={{ backgroundSize: '100% 0.14em' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
    >
      {children}
    </motion.span>
  );
};

/**
 * Фото з ефектом «шторки»: відкривається зліва направо, знизу — червона лінія,
 * що промальовується разом. Кутові дужки — як рамка кадру.
 */
export const PhotoReveal = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  position = 'center',
  eager = false,
  children
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  position?: string;
  eager?: boolean;
  children?: React.ReactNode;
}) => {
  const reduce = useReducedMotion();
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute -inset-6 rounded-[48px] bg-red-600/15 blur-3xl" aria-hidden />
      <motion.div
        className="relative overflow-hidden rounded-[28px] md:rounded-[32px] border border-white/10 bg-zinc-950"
        initial={reduce ? false : { clipPath: 'inset(0 100% 0 0 round 32px)' }}
        whileInView={{ clipPath: 'inset(0 0% 0 0 round 32px)' }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 1.1, ease: EASE }}
      >
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className={`h-full w-full object-cover ${imgClassName}`}
          style={{ objectPosition: position }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
        {/* кутові дужки кадру */}
        <span aria-hidden className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-red-600/80" />
        <span aria-hidden className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-red-600/80" />
        {children}
      </motion.div>
      <motion.span
        aria-hidden
        className="absolute -bottom-3 left-8 right-8 h-[3px] origin-left bg-gradient-to-r from-red-600 via-red-500 to-transparent"
        initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 1, delay: 0.3, ease: EASE }}
      />
    </div>
  );
};

export type GalleryShot = {
  src: string;
  alt: string;
  position: string;
  tag: string;
  title: string;
  desc: string;
  zoom?: string;
};

/**
 * Три кадри з фотосесії = три результати. На мобільному — горизонтальна
 * стрічка зі snap, на md+ — сітка. Підпис завжди видимий (hover на телефоні немає).
 */
export const GalleryStrip = ({ shots }: { shots: GalleryShot[] }) => (
  <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
    {shots.map((shot, i) => (
      <Reveal
        key={shot.title}
        delay={i * 0.12}
        className="w-[78vw] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none"
      >
        <figure className="group relative aspect-[3/4] overflow-hidden rounded-[28px] border border-white/10 bg-black md:rounded-[32px]">
          <img
            src={shot.src}
            alt={shot.alt}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover transition-transform duration-[1200ms] ease-out ${shot.zoom || 'group-hover:scale-105'}`}
            style={{ objectPosition: shot.position }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" aria-hidden />
          <span aria-hidden className="absolute left-5 top-5 text-[11px] font-black tracking-[0.3em] text-red-500">
            0{i + 1}
          </span>
          <span aria-hidden className="absolute left-5 top-11 h-10 w-px origin-top bg-gradient-to-b from-red-600 to-transparent" />
          <figcaption className="absolute inset-x-0 bottom-0 p-6 md:p-7">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-red-500">{shot.tag}</span>
            <span className="block text-xl font-black uppercase leading-tight tracking-tight text-white md:text-2xl">
              {shot.title}
            </span>
            <span className="mt-2 block max-w-xs text-sm font-medium leading-relaxed text-zinc-400">{shot.desc}</span>
          </figcaption>
        </figure>
      </Reveal>
    ))}
  </div>
);
