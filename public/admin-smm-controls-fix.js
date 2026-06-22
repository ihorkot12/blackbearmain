(() => {
  if (window.__bbSmmControlsFixInstalled) return;
  window.__bbSmmControlsFixInstalled = true;

  const STYLE_ID = 'bb-smm-controls-fix-style';
  const NOTICE_ID = 'bb-smm-controls-fix-notice';
  const ADMIN_PATH_RE = /^\/admin(?:\/|$)/;

  const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const isAdminPath = () => ADMIN_PATH_RE.test(location.pathname);
  const isSmmPage = () => /Content OS|Black Bear Dojo AI SMM Agency/i.test(document.body?.innerText || '');
  const isVisible = (node) => !!(node?.offsetWidth || node?.offsetHeight || node?.getClientRects?.().length);
  const textOf = (node) => String(node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bb-admin-nav-section.is-collapsed>.bb-admin-nav-items{visibility:hidden!important;pointer-events:none!important}
      .bb-admin-nav-section.is-open>.bb-admin-nav-items{visibility:visible!important;pointer-events:auto!important}
      .bb-smm-control-active{background:#ef0008!important;color:#fff!important;border-color:rgba(239,0,8,.85)!important;box-shadow:0 14px 34px rgba(239,0,8,.18)!important}
      .bb-smm-inline-note{margin:14px 0 0;border:1px solid rgba(239,0,8,.22);background:rgba(239,0,8,.08);color:#fecdd3;border-radius:16px;padding:12px 14px;font-size:12px;line-height:1.45;font-weight:700}
      #${NOTICE_ID}{position:fixed;right:18px;bottom:18px;z-index:2147483647;width:min(420px,calc(100vw - 36px));border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(10,10,12,.96);color:#fff;box-shadow:0 24px 70px rgba(0,0,0,.45);padding:14px 16px;font-family:Inter,system-ui,sans-serif;opacity:0;transform:translateY(10px);pointer-events:none;transition:opacity .18s ease,transform .18s ease}
      #${NOTICE_ID}.is-visible{opacity:1;transform:translateY(0)}#${NOTICE_ID} strong{display:block;margin-bottom:4px;font-size:11px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}#${NOTICE_ID} p{margin:0;color:#d4d4d8;font-size:13px;line-height:1.45}
    `;
    document.head.appendChild(style);
  };

  const showNotice = (message) => {
    addStyles();
    let notice = document.getElementById(NOTICE_ID);
    if (!notice) {
      notice = document.createElement('div');
      notice.id = NOTICE_ID;
      document.body.appendChild(notice);
    }
    notice.className = 'is-visible';
    notice.innerHTML = `<strong>SMM Agency</strong><p>${escapeHtml(message)}</p>`;
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => notice.classList.remove('is-visible'), 3200);
  };

  const closestPanel = (node, pattern) => {
    let current = node;
    while (current && current !== document.body) {
      if (pattern.test(textOf(current))) return current;
      current = current.parentElement;
    }
    return null;
  };

  const smallestMatchingBlocks = (root, matcher) => {
    return [...root.querySelectorAll('div,article,section')]
      .filter((node) => matcher(textOf(node)))
      .filter((node) => ![...node.children].some((child) => matcher(textOf(child))));
  };

  const setActiveButton = (panel, activeButton, labels) => {
    [...panel.querySelectorAll('button')].forEach((button) => {
      const buttonText = norm(textOf(button) || button.getAttribute('title') || button.getAttribute('aria-label'));
      if (labels.some((label) => buttonText === norm(label))) button.classList.remove('bb-smm-control-active');
    });
    activeButton.classList.add('bb-smm-control-active');
  };

  const setPanelNote = (panel, message) => {
    let note = panel.querySelector(':scope > .bb-smm-inline-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'bb-smm-inline-note';
      const header = [...panel.children].find((child) => /контент-план|архів публікацій|audience pain miner/i.test(textOf(child)));
      if (header?.nextSibling) panel.insertBefore(note, header.nextSibling);
      else panel.prepend(note);
    }
    note.textContent = message;
  };

  const filterHistory = (button, filter) => {
    const panel = closestPanel(button, /Архів публікацій/i);
    if (!panel) return false;
    setActiveButton(panel, button, ['Всі', 'Reels']);
    const cards = smallestMatchingBlocks(panel, (text) => /\bHook\b/i.test(text) && /Goal\s*\/\s*Audience/i.test(text) && /\bScore\b/i.test(text));
    let visibleCount = 0;
    cards.forEach((card) => {
      const shouldShow = filter === 'all' || /\bREELS\b/i.test(textOf(card));
      card.style.display = shouldShow ? '' : 'none';
      if (shouldShow) visibleCount += 1;
    });
    setPanelNote(panel, filter === 'all' ? `Показано всі публікації: ${visibleCount}.` : `Показано Reels: ${visibleCount}.`);
    showNotice(filter === 'all' ? 'Фільтр історії: всі публікації.' : 'Фільтр історії: тільки Reels.');
    return true;
  };

  const filterPains = (button, filter) => {
    const panel = closestPanel(button, /Audience Pain Miner/i);
    if (!panel) return false;
    setActiveButton(panel, button, ['Всі ЦА', 'Батьки']);
    const cards = smallestMatchingBlocks(panel, (text) => /Signal Strength/i.test(text));
    let visibleCount = 0;
    cards.forEach((card) => {
      const shouldShow = filter === 'all' || /Батьки/i.test(textOf(card));
      card.style.display = shouldShow ? '' : 'none';
      if (shouldShow) visibleCount += 1;
    });
    setPanelNote(panel, filter === 'all' ? `Показано всі сегменти ЦА: ${visibleCount}.` : `Показано батьківські болі: ${visibleCount}.`);
    showNotice(filter === 'all' ? 'Показую всі сегменти аудиторії.' : 'Показую тільки болі батьків.');
    return true;
  };

  const setCalendarWeek = (button, mode) => {
    const panel = closestPanel(button, /Контент-план/i);
    if (!panel) return false;
    setActiveButton(panel, button, ['Попередній тиждень', 'Поточний тиждень']);
    const message = mode === 'previous'
      ? 'Попередній тиждень відкрито. Якщо постів за той тиждень немає, план залишиться порожнім.'
      : 'Поточний тиждень відкрито. Плюс у дні відкриває генератор ідеї.';
    setPanelNote(panel, message);
    showNotice(message);
    return true;
  };

  const clickSmmTab = (label) => {
    const target = norm(label);
    const button = [...document.querySelectorAll('button')]
      .filter(isVisible)
      .find((item) => norm(textOf(item)) === target);
    if (!button) return false;
    button.click();
    return true;
  };

  const handleCalendarAdd = (button) => {
    const panel = closestPanel(button, /Контент-план/i);
    if (!panel) return false;
    clickSmmTab('Генератор');
    setTimeout(() => {
      const generateButton = [...document.querySelectorAll('button')]
        .filter(isVisible)
        .find((item) => /згенерувати/i.test(textOf(item)));
      generateButton?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 450);
    showNotice('Відкрив генератор для нового поста в контент-плані.');
    return true;
  };

  const downloadGeneratedIdea = (button) => {
    const panel = closestPanel(button, /Hook \(0-3s\)|Script \/ Plan|Higgsfield AI Prompt/i);
    if (!panel) return false;
    const text = textOf(panel);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `black-bear-smm-idea-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
    showNotice('Ідею завантажено у текстовий файл.');
    return true;
  };

  const ensureManagementNavOpen = () => {
    if (!isAdminPath()) return;
    const group = [...document.querySelectorAll('.bb-admin-nav-section')]
      .find((item) => /УПРАВЛІННЯ/i.test(textOf(item.querySelector('h3'))));
    if (!group) return;
    group.classList.add('is-open');
    group.classList.remove('is-collapsed');
    const items = group.querySelector('.bb-admin-nav-items');
    if (items) {
      items.style.maxHeight = '900px';
      items.style.opacity = '1';
      items.style.pointerEvents = 'auto';
      items.style.visibility = 'visible';
    }
  };

  document.addEventListener('click', (event) => {
    if (!isAdminPath() || !isSmmPage()) return;
    const button = event.target?.closest?.('button');
    if (!button) return;

    const rawText = textOf(button) || button.getAttribute('title') || button.getAttribute('aria-label') || '';
    const buttonText = norm(rawText);

    let handled = false;
    if (buttonText === 'всі' && closestPanel(button, /Архів публікацій/i)) handled = filterHistory(button, 'all');
    else if (buttonText === 'reels' && closestPanel(button, /Архів публікацій/i)) handled = filterHistory(button, 'reels');
    else if (buttonText === 'всі ца' && closestPanel(button, /Audience Pain Miner/i)) handled = filterPains(button, 'all');
    else if (buttonText === 'батьки' && closestPanel(button, /Audience Pain Miner/i)) handled = filterPains(button, 'parents');
    else if (buttonText === 'попередній тиждень') handled = setCalendarWeek(button, 'previous');
    else if (buttonText === 'поточний тиждень') handled = setCalendarWeek(button, 'current');
    else if (!buttonText && closestPanel(button, /Контент-план/i)) handled = handleCalendarAdd(button);
    else if (!buttonText && closestPanel(button, /Hook \(0-3s\)|Script \/ Plan|Higgsfield AI Prompt/i)) handled = downloadGeneratedIdea(button);

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }, true);

  addStyles();
  ensureManagementNavOpen();
  window.addEventListener('pageshow', ensureManagementNavOpen);
  window.addEventListener('popstate', ensureManagementNavOpen);
  const observer = new MutationObserver(() => window.setTimeout(ensureManagementNavOpen, 120));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
