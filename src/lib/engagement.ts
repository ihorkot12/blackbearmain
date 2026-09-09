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

  // Секції можуть зʼявитись пізніше за ефект (lazy-чанки, контент з /api/init),
  // тому список добираємо кількома проходами, а не одним запитом при старті.
  const sections: HTMLElement[] = [];

  // Секція «на екрані», якщо займає ≥50% вʼюпорту або видно ≥50% самої секції.
  // Порогу лише по ratio недостатньо: на телефоні секція у 3 екрани ніколи не досягне 50%.
  const isViewed = (entry: IntersectionObserverEntry) =>
    entry.isIntersecting &&
    (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= window.innerHeight * 0.5);

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        const el = entry.target as HTMLElement;
        const index = sections.indexOf(el);
        const name = sectionName(el, index);
        const viewed = isViewed(entry);
        const wasVisible = visibleSince.has(name);
        if (viewed && !wasVisible) {
          if (!seen.includes(name)) {
            seen.push(name);
            send('section_view', { page, section: name, order: index + 1 }, true);
          }
          lastSection = name;
          visibleSince.set(name, Date.now());
        } else if (!viewed && wasVisible) {
          const ms = Date.now() - (visibleSince.get(name) || Date.now());
          visibleSince.delete(name);
          dwellTotal.set(name, (dwellTotal.get(name) || 0) + ms);
          if (ms >= 1000) {
            send('section_dwell', { page, section: name, seconds: bucketSeconds(ms) }, true);
          }
        }
      });
    },
    { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
  );
  const scanSections = () => {
    document.querySelectorAll<HTMLElement>('section').forEach(el => {
      if (!sections.includes(el)) {
        sections.push(el);
        observer.observe(el);
      }
    });
  };
  scanSections();
  const rescans = [300, 1000, 2500, 5000].map(ms => window.setTimeout(scanSections, ms));

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
      if (ms >= 1000) send('section_dwell', { page, section: name, seconds: bucketSeconds(ms) }, true);
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
    rescans.forEach(id => window.clearTimeout(id));
    observer.disconnect();
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', flushExit);
  };
};
