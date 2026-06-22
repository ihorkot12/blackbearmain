(() => {
  if (window.__bbSmmMobileFixInstalled) return;
  window.__bbSmmMobileFixInstalled = true;

  const STYLE_ID = 'bb-smm-mobile-fix-style';
  const ADMIN_PATH_RE = /^\/admin(?:\/|$)/;
  const TAB_LABELS = ['Дашборд', 'Генератор', 'Болі ЦА', 'Аналіз', 'Календар', 'Історія'];

  const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const isAdminPath = () => ADMIN_PATH_RE.test(location.pathname);
  const isSmmPage = () => /Content OS|Black Bear Dojo AI SMM Agency/i.test(document.body?.innerText || '');
  const isVisible = (node) => !!(node?.offsetWidth || node?.offsetHeight || node?.getClientRects?.().length);
  const textOf = (node) => norm(node?.innerText || node?.textContent || node?.getAttribute?.('aria-label') || node?.getAttribute?.('title') || '');

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bb-smm-mobile-tab-label{display:none}
      .bb-smm-mobile-actions{display:none}
      @media (max-width: 640px){
        .bb-smm-mobile-tabs-row{display:flex!important;gap:8px!important;overflow-x:auto!important;max-width:100%!important;padding:2px 2px 8px!important;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none}
        .bb-smm-mobile-tabs-row::-webkit-scrollbar{display:none}
        button[data-bb-smm-tab]{width:auto!important;min-width:max-content!important;min-height:38px!important;padding:10px 12px!important;gap:7px!important;border-radius:14px!important;scroll-snap-align:start}
        button[data-bb-smm-tab] svg{width:15px!important;height:15px!important;flex:0 0 auto!important}
        button[data-bb-smm-tab] .bb-smm-mobile-tab-label{display:inline!important;white-space:nowrap;font-size:9px;font-weight:950;line-height:1;letter-spacing:.08em;text-transform:uppercase}
        .bb-smm-mobile-actions{display:flex!important;align-items:center;gap:8px;width:100%;margin:12px 0 18px;padding:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);border-radius:18px;overflow-x:auto;scrollbar-width:none}
        .bb-smm-mobile-actions::-webkit-scrollbar{display:none}
        .bb-smm-mobile-actions button{min-height:40px;border:0;border-radius:14px;padding:0 12px;color:#fff;font-size:10px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
        .bb-smm-mobile-actions [data-bb-smm-mobile-analysis]{background:#ef0008;box-shadow:0 12px 28px rgba(239,0,8,.18)}
        .bb-smm-mobile-actions [data-bb-ig-connect]{background:linear-gradient(90deg,#9333ea,#db2777);box-shadow:0 12px 28px rgba(219,39,119,.2)}
      }
    `;
    document.head.appendChild(style);
  };

  const smmRoot = () => {
    const main = document.querySelector('main');
    if (main && isVisible(main) && /Content OS|Black Bear Dojo AI SMM Agency/i.test(textOf(main))) return main;

    const roots = [...document.querySelectorAll('section,div')]
      .filter((node) => isVisible(node) && /Content OS|Black Bear Dojo AI SMM Agency/i.test(textOf(node)));
    return roots.sort((a, b) => textOf(b).length - textOf(a).length)[0] || main || document.body;
  };

  const findSmmTabButtons = () => {
    const root = smmRoot();
    const candidates = [...root.querySelectorAll('button')]
      .filter(isVisible)
      .filter((button) => {
        const className = String(button.className || '');
        const text = textOf(button).toLowerCase();
        const rect = button.getBoundingClientRect();
        const isKnownTab = TAB_LABELS.some((label) => text === label.toLowerCase());
        const looksLikeTab = /shrink-0/.test(className) && /tracking-widest/.test(className) && rect.height <= 48;
        return isKnownTab || looksLikeTab;
      })
      .filter((button) => !/підписки|охоплення|продажі|лояльність|низька|середня|висока|reels|post|story/i.test(textOf(button)));

    const seen = new Set();
    return candidates
      .filter((button) => {
        if (seen.has(button)) return false;
        seen.add(button);
        return true;
      })
      .slice(0, TAB_LABELS.length);
  };

  const labelSmmTabs = () => {
    if (!isAdminPath() || !isSmmPage()) return;
    const buttons = findSmmTabButtons();
    if (buttons.length < 4) return;

    const row = buttons[0]?.parentElement;
    row?.classList.add('bb-smm-mobile-tabs-row');

    buttons.forEach((button, index) => {
      const label = TAB_LABELS[index];
      if (!label) return;
      button.dataset.bbSmmTab = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      let labelNode = button.querySelector('.bb-smm-mobile-tab-label');
      if (!labelNode) {
        labelNode = document.createElement('span');
        labelNode.className = 'bb-smm-mobile-tab-label';
        button.appendChild(labelNode);
      }
      labelNode.textContent = label;
    });
  };

  const clickTab = (label) => {
    const wanted = label.toLowerCase();
    const button = [...document.querySelectorAll('button')]
      .filter(isVisible)
      .find((item) => (item.dataset.bbSmmTab || textOf(item)).toLowerCase() === wanted);
    if (!button) return false;
    button.click();
    return true;
  };

  const ensureMobileInstagramActions = () => {
    if (!isAdminPath() || !isSmmPage()) return;
    const root = smmRoot();
    if (!root || document.getElementById('bb-smm-mobile-actions')) return;

    const actions = document.createElement('div');
    actions.id = 'bb-smm-mobile-actions';
    actions.className = 'bb-smm-mobile-actions';
    actions.innerHTML = `
      <button type="button" data-bb-smm-mobile-analysis>IG метрики</button>
      <button type="button" data-bb-ig-connect data-bb-smm-mobile-reconnect>Перепідключити IG</button>
    `;

    const firstBlock = [...root.children].find((child) => /Content OS|Black Bear Dojo AI SMM Agency/i.test(textOf(child)));
    if (firstBlock?.nextSibling) root.insertBefore(actions, firstBlock.nextSibling);
    else root.prepend(actions);
  };

  const run = () => {
    addStyles();
    labelSmmTabs();
    ensureMobileInstagramActions();
  };

  document.addEventListener('click', (event) => {
    const analysisButton = event.target?.closest?.('[data-bb-smm-mobile-analysis]');
    if (!analysisButton || !isAdminPath() || !isSmmPage()) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    labelSmmTabs();
    clickTab('Аналіз');
    window.setTimeout(() => {
      const metricsBlock = [...document.querySelectorAll('div,section')]
        .find((node) => /МЕТРИКИ|GROWTH & ENGAGEMENT|ПІДПИСНИКИ/i.test(textOf(node)));
      metricsBlock?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  }, true);

  run();
  window.addEventListener('pageshow', () => window.setTimeout(run, 150));
  window.addEventListener('resize', () => window.setTimeout(run, 150));
  const observer = new MutationObserver(() => window.setTimeout(run, 120));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
