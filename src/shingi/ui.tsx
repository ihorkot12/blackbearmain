import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, sg } from './api';

export const BOT_USERNAME = 'shingii_bot';

/* Палітра лендингу /shin-gi: #0A0A0A, #F2F2F0, червоний #A3101A, золото #C9A227, лінії #242422. */

export const display = "font-['Oswald',_'Arial_Narrow',_sans-serif] uppercase tracking-[0.1em]";

export const inputCls =
  "w-full bg-[#111110] border border-[#242422] px-3 py-2.5 text-[15px] text-[#F2F2F0] placeholder:text-[#5a5a57] focus:border-[#C9A227] focus:outline-none disabled:opacity-50";

export const btnCls = (kind: 'primary' | 'ghost' = 'primary') =>
  `${display} inline-flex items-center justify-center gap-2 px-5 py-3 text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
    kind === 'primary'
      ? 'bg-[#8B0000] border border-[#8B0000] text-white hover:bg-[#A3101A] hover:border-[#A3101A]'
      : 'border border-[#242422] text-[#F2F2F0] hover:border-[#C9A227] hover:text-[#C9A227]'
  }`;

export const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <section
    className={`border border-[#242422] bg-[#0f0f0e] p-4 shadow-[inset_0_1px_0_rgba(201,162,39,0.22)] sm:p-6 ${className}`}
  >
    {children}
  </section>
);

/** Заголовок секції з номером, як на лендингу: золота риска + 01 + назва. */
export const H2 = ({ children, n }: { children: React.ReactNode; n?: string }) => (
  <h2 className={`${display} mb-5 flex items-center gap-3 text-[18px] font-semibold text-[#F2F2F0] sm:text-[20px]`}>
    {n ? <span className="text-[13px] font-medium tracking-[0.18em] text-[#C9A227]">{n}</span> : null}
    <span className="h-px w-6 flex-none bg-[#C9A227]" />
    <span className="min-w-0">{children}</span>
  </h2>
);

/** Факт-чип: золоте значення + пояснення. */
export const Chip = ({ strong, children }: { strong: React.ReactNode; children?: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2 border border-[#242422] bg-[#0f0f0e] px-3 py-1.5 text-[13px] text-[#b9b9b4]">
    <i className="h-1.5 w-1.5 flex-none rounded-full bg-[#C9A227]" />
    <b className={`${display} text-[14px] font-semibold tracking-[0.04em] text-[#F2F2F0]`}>{strong}</b>
    {children}
  </span>
);

const BELT_COLOR: Record<string, string> = {
  white: '#F2F2F0', k10: '#E8872A', k9: '#E8872A', k8: '#2F6FDE', k7: '#2F6FDE',
  k6: '#E8C32A', k5: '#E8C32A', k4: '#2E9E4F', k3: '#2E9E4F', k2: '#8B5A2B', k1: '#8B5A2B',
};

/** Пояс як маленька смужка: колір, біла смужка для «зі смужкою», золота для дану. */
export const BeltDot = ({ belt, label }: { belt?: string | null; label?: string }) => {
  const code = belt || '';
  const dan = code.startsWith('d');
  const striped = ['k9', 'k7', 'k5', 'k3', 'k1'].includes(code);
  return (
    <span
      role="img"
      aria-label={label || code}
      title={label}
      className="relative inline-block h-[10px] w-7 flex-none align-middle"
      style={{
        background: dan ? '#0a0a0a' : BELT_COLOR[code] || '#555',
        boxShadow: dan ? 'inset 0 0 0 1px #C9A227' : 'inset 0 0 0 1px rgba(255,255,255,0.14)',
      }}
    >
      {striped && <span className="absolute inset-y-0 right-1.5 w-[3px] bg-[#F2F2F0]" />}
      {dan && <span className="absolute inset-y-0 left-1.5 w-[2px] bg-[#C9A227]" />}
    </span>
  );
};

/** Кроки реєстрації: 1 Вхід · 2 Анкета · 3 Бійці · 4 Заявка. */
export const Stepper = ({ steps, current }: { steps: string[]; current: number }) => (
  <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
    {steps.map((s, i) => (
      <li key={s} className="flex items-center gap-2">
        <span
          className={`${display} grid h-6 w-6 place-items-center border text-[12px] ${
            i < current ? 'border-[#C9A227] bg-[#C9A227] text-black' : i === current ? 'border-[#C9A227] text-[#C9A227]' : 'border-[#242422] text-[#85857f]'
          }`}
        >
          {i < current ? '✓' : i + 1}
        </span>
        <span className={`${display} text-[12px] ${i === current ? 'text-[#F2F2F0]' : 'text-[#85857f]'}`}>{s}</span>
        {i < steps.length - 1 && <span className="mx-1 h-px w-5 bg-[#242422]" />}
      </li>
    ))}
  </ol>
);

export const Label = ({ text, children, hint }: { text: string; children: React.ReactNode; hint?: string }) => (
  <label className="block">
    <span className={`${display} mb-1 block text-[11px] text-[#8a8a86]`}>{text}</span>
    {children}
    {hint && <span className="mt-1 block text-[12px] text-[#85857f]">{hint}</span>}
  </label>
);

export const Badge = ({ tone, children }: { tone: 'gold' | 'red' | 'green' | 'grey'; children: React.ReactNode }) => {
  const map = {
    gold: 'border-[#C9A227]/50 text-[#C9A227]',
    red: 'border-[#A3101A]/60 text-[#ff6b6b]',
    green: 'border-emerald-500/40 text-emerald-300',
    grey: 'border-[#242422] text-[#8a8a86]',
  };
  return <span className={`${display} inline-block whitespace-nowrap border px-2 py-0.5 text-[11px] ${map[tone]}`}>{children}</span>;
};

export const Spinner = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#A3101A] border-t-transparent" />
  </div>
);

/** Шрифти лендингу, noindex і назва вкладки — сторінки приватні. */
export function usePageSetup(title: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${title} · SHIN GI`;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    if (!document.getElementById('shingi-fonts')) {
      const font = document.createElement('link');
      font.id = 'shingi-fonts';
      font.rel = 'stylesheet';
      font.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Golos+Text:wght@400;500;600&display=swap';
      document.head.appendChild(font);
    }
    return () => {
      document.title = prevTitle;
      robots.remove();
    };
  }, [title]);
}

export const Shell = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <div
    className="relative min-h-screen overflow-x-hidden bg-[#0A0A0A] text-[#F2F2F0] [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-[#C9A227]"
    style={{ fontFamily: "'Golos Text','Segoe UI',system-ui,sans-serif" }}
  >
    <div
      aria-hidden
      className="pointer-events-none absolute right-[-2vw] top-6 select-none whitespace-nowrap font-bold leading-none text-white/[0.035]"
      style={{ fontFamily: "'Noto Serif JP','Yu Mincho','Hiragino Mincho ProN',serif", fontSize: 'clamp(150px,34vw,400px)' }}
    >
      心技
    </div>
    <header className="relative z-10 border-b border-[#242422] bg-[#0A0A0A]/85 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
        <a href="/shin-gi" className={`${display} flex items-center gap-3 text-[14px] font-semibold`}>
          <span
            className="grid h-6 w-6 place-items-center bg-[#C10000] text-[15px] font-black italic text-white"
            style={{ clipPath: 'polygon(15% 0,100% 0,85% 100%,0 100%)' }}
          >
            B
          </span>
          <span>
            SHIN <b className="text-[#A3101A]">GI</b>
          </span>
        </a>
        {right}
      </div>
    </header>
    <main className="relative z-10 mx-auto max-w-4xl space-y-5 px-4 py-6 pb-32">{children}</main>
  </div>
);

/* ───────────── сесія ───────────── */

export type Me = { authenticated: boolean; profile: any | null; is_admin: boolean; needs_profile?: boolean };

declare global {
  interface Window {
    Telegram?: { WebApp?: any };
    onShinGiTelegramAuth?: (user: any) => void;
  }
}

const loadTelegramWebApp = () =>
  new Promise<void>((resolve) => {
    if (window.Telegram?.WebApp) return resolve();
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

/**
 * Поточний користувач. Усередині Telegram Mini App (initData у #tgWebAppData) входить автоматично.
 * Поза Telegram — через віджет входу (loginWithWidget).
 */
export function useSession() {
  const [me, setMe] = useState<Me | null>(null);
  const [inTelegram, setInTelegram] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setMe(await sg<Me>('me'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка');
      setMe({ authenticated: false, profile: null, is_admin: false });
    }
  }, []);

  useEffect(() => {
    (async () => {
      const initData = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('tgWebAppData');
      if (initData) {
        setInTelegram(true);
        await loadTelegramWebApp();
        window.Telegram?.WebApp?.ready?.();
        window.Telegram?.WebApp?.expand?.();
        try {
          await sg('auth/webapp', { method: 'POST', body: { initData } });
        } catch (e) {
          setError(e instanceof ApiError ? e.message : 'Не вдалося увійти через Telegram');
        }
      }
      await reload();
    })();
  }, [reload]);

  const loginWithWidget = useCallback(
    async (user: any) => {
      try {
        await sg('auth/telegram', { method: 'POST', body: user });
        setError('');
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не вдалося увійти');
      }
    },
    [reload],
  );

  const logout = useCallback(async () => {
    await sg('auth/logout', { method: 'POST' }).catch(() => undefined);
    await reload();
  }, [reload]);

  return { me, error, inTelegram, reload, loginWithWidget, logout };
}

/** Кнопка «Увійти через Telegram» (Login Widget). Працює лише на домені, прив'язаному до бота в BotFather. */
export const TelegramLogin = ({ onAuth }: { onAuth: (user: any) => void }) => {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.onShinGiTelegramAuth = onAuth;
    const host = box.current;
    if (!host) return;
    host.innerHTML = '';
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '0');
    script.setAttribute('data-lang', 'uk');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onShinGiTelegramAuth(user)');
    host.appendChild(script);
    return () => {
      delete window.onShinGiTelegramAuth;
    };
  }, [onAuth]);
  return <div ref={box} className="flex min-h-[48px] items-center" />;
};
