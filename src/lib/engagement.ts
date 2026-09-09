import { track } from '@vercel/analytics';

/**
 * Поведінка відвідувача на лендінгу: які екрани він бачить, скільки на них
 * тримається і де йде зі сторінки. Події летять у Vercel Web Analytics
 * (кастомні події) і, для ключових точок, у Meta Pixel.
 *
 * Події:
 *  section_view   — секція вперше зайняла ≥50% вʼюпорту          {page, section, order}
 *  section_dwell  — скільки секунд секція була у вʼюпорті          {page, section, seconds}
 *  scroll_depth   — пройдено 25 / 50 / 75 / 100 % сторінки          {page, depth}
 *  page_exit      — вихід/згортання вкладки                         {page, seconds, max_depth, last_section, sections_seen}
 */

type EventData = Record<string, string | number | boolean>;

const send = (name: string, data: EventData, toMeta = false) => {
  try {
    track(name, data);
  } catch {
    /* аналітика не повинна ламати сторінку */
  }
  if (toMeta && typeof window !== 'undefined') {
    const fbq = (window as any).fbq;
    if (fbq) {
      try {
        fbq('trackCustom', name, data);
      } catch {
        /* ignore */
      }
    }
  }
};

const bucketSeconds = (ms: number) => Math.round(ms / 1000);

export const startEngagementTracking = (page: string): (() => void) => {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return () => {};
  }

  const startedAt = Date.now();
  const seen: string[] = [];
  const visibleSince = new Map<string, number>();
  const dwellTotal = new Map<string, number>();
  let lastSection = 'hero';
  let maxDepth = 0;
  const depthMilestones = [25, 50, 75, 100];
  const depthSent = new Set<number>();
  let exitSent = false;

  const sectionName = (el: Element, index: number) =>
    el.id || (el as HTMLElement).dataset.track || `section-${index + 1}`;

  const sections = Array.from(document.querySelectorAll<HTMLElement>('main section, section'))
    .filter((el, i, arr) => arr.indexOf(el) === i);

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        const el = entry.target as HTMLElement;
        const index = sections.indexOf(el);
        const name = sectionName(el, index);
        if (entry.isIntersecting) {
          if (!seen.includes(name)) {
            seen.push(name);
            send('section_view', { page, section: name, order: index + 1 }, true);
          }
          lastSection = name;
          visibleSince.set(name, Date.now());
        } else if (visibleSince.has(name)) {
          const ms = Date.now() - (visibleSince.get(name) || Date.now());
          visibleSince.delete(name);
          dwellTotal.set(name, (dwellTotal.get(name) || 0) + ms);
          if (ms >= 1000) {
            send('section_dwell', { page, section: name, seconds: bucketSeconds(ms) });
          }
        }
      });
    },
    { threshold: 0.5 }
  );
  sections.forEach(el => observer.observe(el));

  const onScroll = () => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const depth = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100));
    if (depth > maxDepth) maxDepth = depth;
    depthMilestones.forEach(m => {
      if (depth >= m && !depthSent.has(m)) {
        depthSent.add(m);
        send('scroll_depth', { page, depth: m }, true);
      }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const flushExit = () => {
    if (exitSent) return;
    exitSent = true;
    // закрити відкриті інтервали перебування
    visibleSince.forEach((since, name) => {
      const ms = Date.now() - since;
      dwellTotal.set(name, (dwellTotal.get(name) || 0) + ms);
      if (ms >= 1000) send('section_dwell', { page, section: name, seconds: bucketSeconds(ms) });
    });
    visibleSince.clear();
    send(
      'page_exit',
      {
        page,
        seconds: bucketSeconds(Date.now() - startedAt),
        max_depth: maxDepth,
        last_section: lastSection,
        sections_seen: seen.length
      },
      true
    );
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      flushExit();
    } else {
      // повернулись у вкладку — рахуємо новий відрізок
      exitSent = false;
      sections.forEach(el => {
        const r = el.getBoundingClientRect();
        const visible = r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.5;
        if (visible) visibleSince.set(sectionName(el, sections.indexOf(el)), Date.now());
      });
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flushExit);

  return () => {
    flushExit();
    observer.disconnect();
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', flushExit);
  };
};
