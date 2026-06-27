(() => {
  const PANEL_ID = 'bb-admin-coach-telegram-panel';
  const STYLE_ID = 'bb-admin-coach-telegram-style';
  const ADMIN_PATH_RE = /^\/admin(?:\/|$)/;

  const state = {
    data: null,
    loading: false,
    loadedAt: 0,
  };

  let renderTimer = null;

  const isAdminPath = () => ADMIN_PATH_RE.test(location.pathname);
  const authToken = () => localStorage.getItem('admin_token') || '';
  const currentRole = () => localStorage.getItem('admin_role') || 'admin';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bb-admin-coach-telegram-panel {
        margin: 0 0 18px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        background: #101012;
        color: #fff;
        overflow: hidden;
      }
      .bb-admin-coach-telegram-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 18px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .bb-admin-coach-telegram-title {
        font-size: 15px;
        line-height: 1.25;
        font-weight: 900;
      }
      .bb-admin-coach-telegram-copy {
        margin: 5px 0 0;
        max-width: 820px;
        color: #a1a1aa;
        font-size: 12px;
        line-height: 1.45;
      }
      .bb-admin-coach-telegram-actions,
      .bb-admin-coach-telegram-row-actions,
      .bb-admin-coach-telegram-links {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .bb-admin-coach-telegram-button,
      .bb-admin-coach-telegram-link {
        min-height: 36px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 0 12px;
        background: #18181b;
        color: #fff;
        font-size: 12px;
        font-weight: 850;
        text-decoration: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .bb-admin-coach-telegram-button:hover,
      .bb-admin-coach-telegram-link:hover { background: #27272a; }
      .bb-admin-coach-telegram-primary {
        background: #2563eb;
        border-color: rgba(59,130,246,0.48);
      }
      .bb-admin-coach-telegram-primary:hover { background: #1d4ed8; }
      .bb-admin-coach-telegram-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 10px;
        padding: 14px 18px 18px;
      }
      .bb-admin-coach-telegram-row {
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 8px;
        background: #09090b;
        padding: 13px;
      }
      .bb-admin-coach-telegram-name {
        font-size: 13px;
        font-weight: 900;
        color: #fff;
      }
      .bb-admin-coach-telegram-meta {
        margin-top: 4px;
        color: #71717a;
        font-size: 11px;
        line-height: 1.45;
      }
      .bb-admin-coach-telegram-status {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        margin-top: 10px;
        border-radius: 999px;
        padding: 0 9px;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .08em;
      }
      .bb-admin-coach-telegram-status.is-ok {
        background: rgba(34,197,94,0.13);
        color: #86efac;
      }
      .bb-admin-coach-telegram-status.is-warn {
        background: rgba(245,158,11,0.13);
        color: #fcd34d;
      }
      .bb-admin-coach-telegram-row-actions { margin-top: 12px; }
      .bb-admin-coach-telegram-links {
        padding: 0 18px 16px;
      }
      .bb-admin-coach-telegram-note {
        padding: 14px 18px 18px;
        color: #a1a1aa;
        font-size: 12px;
        line-height: 1.5;
      }
      @media (max-width: 720px) {
        .bb-admin-coach-telegram-head { display: block; }
        .bb-admin-coach-telegram-actions { margin-top: 12px; }
        .bb-admin-coach-telegram-button,
        .bb-admin-coach-telegram-link { width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  async function fetchData(force = false) {
    if (state.loading) return state.data;
    if (!force && state.data && Date.now() - state.loadedAt < 45000) return state.data;
    if (!authToken()) return null;

    state.loading = true;
    try {
      const response = await fetch('/api/admin/coach-telegram', {
        headers: { Authorization: `Bearer ${authToken()}` },
      });
      if (!response.ok) throw new Error(`coach telegram ${response.status}`);
      state.data = await response.json();
      state.loadedAt = Date.now();
      return state.data;
    } finally {
      state.loading = false;
    }
  }

  function portalUrl(tab, action) {
    const base = state.data?.portalUrl || `${location.origin}/admin`;
    const url = new URL(base, location.origin);
    if (tab) url.searchParams.set('tab', tab);
    if (action) url.searchParams.set('action', action);
    return url.toString();
  }

  function rowHtml(coach) {
    const connected = Boolean(coach.connected);
    const botName = state.data?.botUsername ? `@${state.data.botUsername}` : 'Telegram bot';
    return `
      <div class="bb-admin-coach-telegram-row">
        <div class="bb-admin-coach-telegram-name">${escapeHtml(coach.name || 'Тренер')}</div>
        <div class="bb-admin-coach-telegram-meta">${escapeHtml(coach.role || 'тренер')} · ${escapeHtml(botName)}</div>
        <div class="bb-admin-coach-telegram-status ${connected ? 'is-ok' : 'is-warn'}">
          ${connected ? 'Підключено' : 'Треба підключити'}
        </div>
        <div class="bb-admin-coach-telegram-row-actions">
          <button class="bb-admin-coach-telegram-button bb-admin-coach-telegram-primary" type="button" data-bb-open-telegram="${escapeHtml(coach.connectUrl)}">
            ${connected ? 'Перепідключити' : 'Підключити'}
          </button>
          <button class="bb-admin-coach-telegram-button" type="button" data-bb-copy-link="${escapeHtml(coach.connectUrl)}">Копія лінку</button>
        </div>
      </div>
    `;
  }

  function buildPanel() {
    const panel = document.createElement('section');
    const role = currentRole();
    const coaches = Array.isArray(state.data?.coaches) ? state.data.coaches : [];
    const title = role === 'coach' ? 'Telegram тренера' : 'Telegram тренерів';
    const copy = role === 'coach'
      ? 'Підключіть Telegram один раз, після цього бот відкриватиме потрібні розділи порталу для швидкої роботи на тренуванні.'
      : 'Тут можна підключити тренерів до Telegram без ручного введення Telegram ID. Посилання прив’язує тренера до порталу автоматично.';

    panel.id = PANEL_ID;
    panel.className = 'bb-admin-coach-telegram-panel';
    panel.innerHTML = `
      <div class="bb-admin-coach-telegram-head">
        <div>
          <div class="bb-admin-coach-telegram-title">${escapeHtml(title)}</div>
          <p class="bb-admin-coach-telegram-copy">${escapeHtml(copy)}</p>
        </div>
        <div class="bb-admin-coach-telegram-actions">
          <button class="bb-admin-coach-telegram-button" type="button" data-bb-refresh-telegram>Оновити</button>
          <a class="bb-admin-coach-telegram-link" href="${escapeHtml(portalUrl('today'))}">Сьогодні</a>
          <a class="bb-admin-coach-telegram-link" href="${escapeHtml(portalUrl('attendance', 'mark_attendance'))}">Журнал</a>
        </div>
      </div>
      ${state.data?.needsCoachLink
        ? '<div class="bb-admin-coach-telegram-note">Цей акаунт має роль тренера, але не прив’язаний до картки тренера. Зайдіть адміном у “Акаунти” і виберіть тренера для цього логіна.</div>'
        : coaches.length
          ? `<div class="bb-admin-coach-telegram-grid">${coaches.map(rowHtml).join('')}</div>`
          : '<div class="bb-admin-coach-telegram-note">Тренерів ще не знайдено або немає доступу до картки тренера.</div>'}
      <div class="bb-admin-coach-telegram-links">
        <a class="bb-admin-coach-telegram-link" href="${escapeHtml(portalUrl('crm', 'add_payment'))}">Оплати</a>
        <a class="bb-admin-coach-telegram-link" href="${escapeHtml(portalUrl('dashboard'))}">Дні народження</a>
        <a class="bb-admin-coach-telegram-link" href="${escapeHtml(portalUrl('participants', 'add'))}">Додати учасника</a>
      </div>
    `;

    panel.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const openButton = target.closest('[data-bb-open-telegram]');
      if (openButton) {
        event.preventDefault();
        const url = openButton.getAttribute('data-bb-open-telegram');
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      const copyButton = target.closest('[data-bb-copy-link]');
      if (copyButton) {
        event.preventDefault();
        const url = copyButton.getAttribute('data-bb-copy-link') || '';
        try {
          await navigator.clipboard.writeText(url);
          copyButton.textContent = 'Скопійовано';
          window.setTimeout(() => { copyButton.textContent = 'Копія лінку'; }, 1400);
        } catch (_) {
          window.prompt('Скопіюйте посилання', url);
        }
        return;
      }

      if (target.closest('[data-bb-refresh-telegram]')) {
        event.preventDefault();
        await refresh(true);
      }
    });

    return panel;
  }

  function findMount() {
    return document.querySelector('main');
  }

  async function render() {
    if (!isAdminPath()) {
      document.getElementById(PANEL_ID)?.remove();
      return;
    }
    if (!authToken()) return;

    addStyle();
    try {
      await fetchData(false);
    } catch (error) {
      console.error('Coach Telegram panel failed:', error);
      return;
    }

    const mount = findMount();
    if (!mount) return;
    if (document.getElementById(PANEL_ID)) return;

    mount.insertBefore(buildPanel(), mount.firstChild);
  }

  async function refresh(force = false) {
    document.getElementById(PANEL_ID)?.remove();
    state.loadedAt = force ? 0 : state.loadedAt;
    await render();
  }

  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      render();
    }, 220);
  }

  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('storage', scheduleRender);
  window.addEventListener('popstate', scheduleRender);
  window.addEventListener('hashchange', scheduleRender);
  scheduleRender();
})();
