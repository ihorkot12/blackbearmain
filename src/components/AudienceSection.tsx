import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ShieldCheck, Trophy, UserPlus, Users } from 'lucide-react';

/**
 * Розділи сайту за аудиторіями. Кабінети клубу (батьки, тренери, учні) і SHIN GI —
 * це різні модулі з різними даними, тому вони подані окремо й не змішуються.
 */
const CLUB_SECTIONS = [
  { title: 'Батькам', text: 'Кабінет: розклад, оплати, домашні завдання дитини', to: '/auth?role=parent', action: 'Увійти', icon: Users },
  { title: 'Тренерам клубу', text: 'Журнал, відвідуваність, CRM та аналітика', to: '/auth?role=admin', action: 'Управління', icon: ShieldCheck },
  { title: 'Спортсменам клубу', text: 'Анкета нового учасника клубу Black Bear', to: '/register-member', action: 'Записатись', icon: UserPlus },
];

export const AudienceSection = () => {
  const reduce = useReducedMotion();

  return (
    <section id="sections" className="relative bg-black py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.3em] text-red-500">Оберіть свій розділ</p>
        <h2 className="mb-10 text-3xl font-black uppercase tracking-tighter text-white md:text-5xl">Кожному — своє</h2>

        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-500">Клуб Black Bear Dojo</p>
        <div className="grid gap-4 md:grid-cols-3">
          {CLUB_SECTIONS.map((s) => (
            <Link
              key={s.title}
              to={s.to}
              className="group flex flex-col rounded-3xl border border-white/10 bg-zinc-950 p-6 transition-colors hover:border-red-600/60"
            >
              <s.icon size={26} className="mb-5 text-red-500" />
              <h3 className="text-xl font-black uppercase tracking-tight text-white">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm text-zinc-400">{s.text}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-300 group-hover:text-red-400">
                {s.action} <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>

        <p className="mb-4 mt-12 text-[11px] font-bold uppercase tracking-[0.25em] text-[#C9A227]">Окремий розділ · відкритий для всіх клубів</p>
        <motion.div
          className="relative overflow-hidden rounded-[32px] border border-[#C9A227]/50 bg-gradient-to-br from-[#14100a] via-black to-[#1a0507] p-7 md:p-10"
          animate={
            reduce
              ? undefined
              : {
                  boxShadow: [
                    '0 0 0 0 rgba(201,162,39,0.0), 0 0 40px -12px rgba(163,16,26,0.35)',
                    '0 0 0 6px rgba(201,162,39,0.14), 0 0 70px -8px rgba(163,16,26,0.6)',
                    '0 0 0 0 rgba(201,162,39,0.0), 0 0 40px -12px rgba(163,16,26,0.35)',
                  ],
                }
          }
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-[#C9A227]/15 to-transparent"
            animate={reduce ? undefined : { x: ['0%', '420%'] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
          />
          <span aria-hidden className="pointer-events-none absolute -right-4 top-2 select-none text-[160px] font-bold leading-none text-white/[0.04] md:text-[240px]">
            心技
          </span>

          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <Trophy size={22} className="text-[#C9A227]" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[#C9A227]">Kyokushin Open · Київ</span>
            </div>
            <h3 className="text-5xl font-black uppercase leading-[0.95] tracking-tighter text-white md:text-7xl">
              SHIN <span className="text-red-600">GI</span>
            </h3>
            <p className="mt-4 max-w-2xl text-base text-zinc-300 md:text-lg">
              Спаринг-день у залі-сховищі на Шулявці для тренерів і бійців із будь-яких клубів. Діти до 18 і дорослі 14+/18+, групи за статтю,
              віком, вагою і поясом. Внесок 400 грн за бійця, медаль і грамота кожному.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="https://t.me/shingii_bot?start=team"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-full bg-red-700 px-6 py-3 text-[12px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:bg-red-600"
              >
                Зареєструвати команду <ArrowRight size={14} />
              </a>
              <a
                href="https://t.me/shingii_bot?start=solo"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-full border border-[#C9A227]/60 px-6 py-3 text-[12px] font-black uppercase tracking-[0.15em] text-[#C9A227] transition-colors hover:bg-[#C9A227] hover:text-black"
              >
                Я боєць
              </a>
              <a
                href="/shin-gi"
                className="inline-flex items-center gap-2 px-3 py-3 text-[12px] font-bold uppercase tracking-[0.15em] text-zinc-400 underline-offset-4 hover:text-white hover:underline"
              >
                Детальніше про SHIN GI
              </a>
            </div>
            <p className="mt-5 text-xs text-zinc-500">
              SHIN GI — окремий модуль зі своїм входом через Telegram. Кабінети батьків, тренерів і учнів клубу вище з ним не пов’язані.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
