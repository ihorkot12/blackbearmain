(() => {
  if (window.__bbAdminDashboardOrganizerInstalled) return;
  window.__bbAdminDashboardOrganizerInstalled = true;

  const STYLE_ID = 'bb-admin-dashboard-organizer-style';
  const CARD_STORAGE_PREFIX = 'bb:admin:accordion:v2:';
  const NAV_STORAGE_PREFIX = 'bb:admin:nav:v2:';

  const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const isAdminPath = () => /^\/admin(?:\/|$)/.test(location.pathname);
  const bodyText = () => document.body?.innerText || '';
  const isDashboard = () => {
    const text = bodyText();
    return isAdminPath()
      && /ГОЛОВНА/i.test(text)
      && /Огляд активності|Ваші групи/i.test(text)
      && !/Content OS|Black Bear Dojo AI SMM Agency/i.test(text);
  };

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bb-admin-accordion-card{position:relative;transition:max-height .28s ease,border-color .2s ease,background-color .2s ease,box-shadow .2s ease;will-change:max-height;overflow:hidden}.bb-admin-accordion-card.is-collapsed{max-height:112px!important}.bb-admin-accordion-card.is-expanded{max-height:1600px!important}.bb-admin-accordion-card.is-collapsed:after{content:"";position:absolute;left:0;right:0;bottom:0;height:42px;background:linear-gradient(to bottom,rgba(9,9,11,0),rgba(9,9,11,.94));pointer-events:none}.bb-admin-accordion-card.is-collapsed:hover{border-color:rgba(255,255,255,.14)!important;background:rgba(24,24,27,.42)!important}.bb-admin-accordion-toggle{position:absolute;right:14px;top:14px;z-index:8;width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.07);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:950;line-height:1;box-shadow:0 14px 34px rgba(0,0,0,.28);transition:transform .18s ease,background-color .18s ease,border-color .18s ease}.bb-admin-accordion-toggle:hover{transform:scale(1.05);background:rgba(239,0,8,.9);border-color:rgba(239,0,8,.55)}.bb-admin-accordion-toggle:focus-visible{outline:2px solid rgba(239,0,8,.6);outline-offset:2px}.bb-admin-accordion-card.is-expanded .bb-admin-accordion-toggle{background:rgba(239,0,8,.18);border-color:rgba(239,0,8,.35);color:#ff4d55}.bb-admin-nav-section{transition:opacity .18s ease}.bb-admin-nav-heading{display:flex!important;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;border-radius:14px;padding-top:10px!important;padding-bottom:10px!important;user-select:none;transition:background-color .18s ease,color .18s ease}.bb-admin-nav-heading:hover{background:rgba(255,255,255,.04);color:#fff!important}.bb-admin-nav-heading:after{content:"+";width:22px;height:22px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#71717a;font-size:14px;line-height:1}.bb-admin-nav-section.is-open>.bb-admin-nav-heading:after{content:"-";color:#fff;background:rgba(239,0,8,.18);border-color:rgba(239,0,8,.25)}.bb-admin-nav-items{overflow:hidden;transition:max-height .24s ease,opacity .18s ease,transform .2s ease}.bb-admin-nav-section.is-collapsed>.bb-admin-nav-items{max-height:0!important;opacity:0;transform:translateY(-4px);pointer-events:none}.bb-admin-nav-section.is-open>.bb-admin-nav-items{max-height:900px;opacity:1;transform:translateY(0)}@media(max-width:768px){.bb-admin-accordion-card.is-collapsed{max-height:104px!important}.bb-admin-accordion-toggle{right:10px;top:10px;width:34px;height:34px}.bb-admin-accordion-card h3{padding-right:42px}}
    `;
    document.head.appendChild(style);
  };

  const findNearestCard = (node, title) => {
    let current = node;
    const titleNorm = norm(title);
    const compactChart = titleNorm === 'динаміка заявок' || titleNorm === 'розподіл по групах';
    while (current && current !== document.body) {
      const className = String(current.className || '');
      const text = norm(current.innerText || current.textContent || '');
      const looksLikeCard = current.classList?.contains('bb-admin-instagram-top') || (className.includes('rounded') && className.includes('border'));
      const tooBroad = text.includes('операційка') || text.includes('control panel');
      const hasEnoughText = text.length > titleNorm.length + 20 || compactChart;
      if (looksLikeCard && text.includes(titleNorm) && hasEnoughText && !tooBroad) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  const headingsForTitle = (title) => {
    const titleNorm = norm(title);
    return [...document.querySelectorAll('main h3, main [class*="bb-kicker"], main [class*="tracking"]')]
      .filter((node) => norm(node.textContent).includes(titleNorm));
  };

  const updateToggle = (card) => {
    const button = card.querySelector(':scope > .bb-admin-accordion-toggle');
    if (!button) return;
    const isCollapsed = card.classList.contains('is-collapsed');
    button.textContent = isCollapsed ? '+' : '-';
    button.setAttribute('aria-label', isCollapsed ? 'Розгорнути блок' : 'Згорнути блок');
    button.setAttribute('title', isCollapsed ? 'Розгорнути' : 'Згорнути');
    button.setAttribute('aria-expanded', String(!isCollapsed));
  };

  const applyCardState = (card, title, collapsed) => {
    card.classList.add('bb-admin-accordion-card');
    card.classList.toggle('is-collapsed', collapsed);
    card.classList.toggle('is-expanded', !collapsed);
    try { localStorage.setItem(CARD_STORAGE_PREFIX + title, collapsed ? 'collapsed' : 'expanded'); } catch (_) {}
    updateToggle(card);
  };

  const organizeCards = () => {
    if (!isDashboard()) return;
    document.body.classList.add('bb-admin-organized');

    const titles = [
      'Динаміка заявок',
      'Розподіл по групах',
      'Ризик відтоку',
      'Боржники',
      'Останні заявки',
      'Повідомлення від батьків',
      'Найближчі дні народження',
      'Instagram API'
    ];

    const seen = new Set();
    titles.forEach((title) => {
      headingsForTitle(title).forEach((heading) => {
        const card = findNearestCard(heading, title);
        if (!card || seen.has(card)) return;
        seen.add(card);
        if (card.dataset.bbAdminAccordionReady === '1') return;
        card.dataset.bbAdminAccordionReady = '1';
        card.dataset.bbAdminAccordionTitle = title;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'bb-admin-accordion-toggle';
        toggle.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation?.();
          applyCardState(card, title, !card.classList.contains('is-collapsed'));
        }, true);
        card.appendChild(toggle);

        let stored = null;
        try { stored = localStorage.getItem(CARD_STORAGE_PREFIX + title); } catch (_) {}
        const collapsed = stored ? stored === 'collapsed' : true;
        applyCardState(card, title, collapsed);
      });
    });
  };

  const organizeSidebar = () => {
    if (!isAdminPath()) return;
    const nav = document.querySelector('nav');
    if (!nav) return;

    [...nav.querySelectorAll('h3')].forEach((heading, index) => {
      const group = heading.parentElement;
      const items = heading.nextElementSibling;
      if (!group || !items || group.dataset.bbAdminNavReady === '1') return;
      group.dataset.bbAdminNavReady = '1';
      group.classList.add('bb-admin-nav-section');
      heading.classList.add('bb-admin-nav-heading');
      items.classList.add('bb-admin-nav-items');

      const key = NAV_STORAGE_PREFIX + norm(heading.textContent || `group-${index}`);
      const hasActive = !!group.querySelector('button[class*="bg-red-600"]');
      let stored = null;
      try { stored = localStorage.getItem(key); } catch (_) {}
      const isOpen = stored ? stored === 'open' : (hasActive || index === 0);
      group.classList.toggle('is-open', isOpen);
      group.classList.toggle('is-collapsed', !isOpen);

      heading.setAttribute('role', 'button');
      heading.setAttribute('tabindex', '0');
      heading.addEventListener('click', () => {
        const nextOpen = !group.classList.contains('is-open');
        group.classList.toggle('is-open', nextOpen);
        group.classList.toggle('is-collapsed', !nextOpen);
        try { localStorage.setItem(key, nextOpen ? 'open' : 'closed'); } catch (_) {}
      });
      heading.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          heading.click();
        }
      });
    });
  };

  let scheduled = 0;
  const run = () => {
    window.clearTimeout(scheduled);
    scheduled = window.setTimeout(() => {
      addStyles();
      organizeSidebar();
      organizeCards();
    }, 160);
  };

  const patchHistory = (method) => {
    const original = history[method];
    if (typeof original !== 'function' || original.__bbAdminOrganizerPatched) return;
    const patched = function (...args) {
      const result = original.apply(this, args);
      run();
      return result;
    };
    patched.__bbAdminOrganizerPatched = true;
    history[method] = patched;
  };

  patchHistory('pushState');
  patchHistory('replaceState');
  window.addEventListener('popstate', run);
  window.addEventListener('pageshow', run);

  const observer = new MutationObserver(run);
  const startObserver = () => {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();

  run();
})();
