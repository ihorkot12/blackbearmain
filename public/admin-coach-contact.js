(() => {
  const PANEL_ID = 'bb-admin-coach-contact-panel';
  const STYLE_ID = 'bb-admin-coach-contact-style';
  const ADMIN_PATH = '/admin';

  const state = {
    coaches: [],
    loading: false,
    loadedAt: 0,
  };

  let renderTimer = null;

  const isAdminPage = () => window.location.pathname.replace(/\/$/, '') === ADMIN_PATH;
  const getAdminToken = () => window.localStorage.getItem('admin_token') || '';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeTelegramUsername(value) {
    let username = String(value ?? '').trim();
    username = username.replace(/^https?:\/\/t\.me\//i, '');
    username = username.replace(/^t\.me\//i, '');
    username = username.replace(/^@+/, '');
    username = username.split(/[/?#]/)[0];
    return username.trim();
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bb-admin-coach-contact-panel {
        margin: -10px 0 26px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        background: #111113;
        color: #fff;
        box-shadow: 0 18px 40px rgba(0,0,0,0.24);
        overflow: hidden;
      }
      .bb-admin-coach-contact-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .bb-admin-coach-contact-title {
        font-size: 16px;
        line-height: 1.2;
        font-weight: 900;
        letter-spacing: 0.02em;
      }
      .bb-admin-coach-contact-copy {
        margin: 6px 0 0;
        max-width: 760px;
        color: #a1a1aa;
        font-size: 13px;
        line-height: 1.5;
      }
      .bb-admin-coach-contact-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .bb-admin-coach-contact-button {
        min-height: 40px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 0 14px;
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        background: #18181b;
        cursor: pointer;
      }
      .bb-admin-coach-contact-button:hover { background: #27272a; }
      .bb-admin-coach-contact-button-primary {
        border-color: rgba(220,38,38,0.55);
        background: #dc2626;
      }
      .bb-admin-coach-contact-button-primary:hover { background: #b91c1c; }
      .bb-admin-coach-contact-status {
        display: none;
        margin: 14px 20px 0;
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 13px;
        line-height: 1.4;
      }
      .bb-admin-coach-contact-status.is-visible { display: block; }
      .bb-admin-coach-contact-status.is-ok {
        border: 1px solid rgba(34,197,94,0.32);
        background: rgba(34,197,94,0.09);
        color: #bbf7d0;
      }
      .bb-admin-coach-contact-status.is-error {
        border: 1px solid rgba(248,113,113,0.34);
        background: rgba(248,113,113,0.1);
        color: #fecaca;
      }
      .bb-admin-coach-contact-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        padding: 18px 20px 20px;
      }
      .bb-admin-coach-contact-row {
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 8px;
        background: #09090b;
        padding: 14px;
      }
      .bb-admin-coach-contact-name {
        color: #fff;
        font-size: 14px;
        font-weight: 900;
      }
      .bb-admin-coach-contact-role {
        margin-top: 3px;
        min-height: 18px;
        color: #71717a;
        font-size: 12px;
        line-height: 1.4;
      }
      .bb-admin-coach-contact-fields {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .bb-admin-coach-contact-label {
        display: block;
        color: #d4d4d8;
        font-size: 12px;
        font-weight: 800;
      }
      .bb-admin-coach-contact-input {
        display: block;
        width: 100%;
        min-height: 42px;
        margin-top: 7px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        background: #000;
        color: #fff;
        padding: 0 12px;
        outline: none;
        font-size: 14px;
      }
      .bb-admin-coach-contact-input:focus { border-color: #dc2626; }
      .bb-admin-coach-contact-empty {
        padding: 18px 20px 22px;
        color: #a1a1aa;
        font-size: 13px;
      }
      @media (max-width: 900px) {
        .bb-admin-coach-contact-head,
        .bb-admin-coach-contact-actions { display: block; }
        .bb-admin-coach-contact-actions { margin-top: 14px; }
        .bb-admin-coach-contact-button { margin: 0 8px 8px 0; }
        .bb-admin-coach-contact-grid,
        .bb-admin-coach-contact-fields { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function showStatus(panel, message, type = 'ok') {
    const status = panel.querySelector('[data-bb-coach-contact-status]');
    if (!status) return;
    status.textContent = message;
    status.className = `bb-admin-coach-contact-status is-visible is-${type}`;
  }

  async function fetchJson(path, options = {}) {
    const token = getAdminToken();
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };
    const response = await fetch(path, { ...options, headers });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json().catch(() => null);
  }

  async function loadData(force = false) {
    if (state.loading) return;
    if (!force && state.loadedAt && Date.now() - state.loadedAt < 45000) return;
    if (!getAdminToken()) return;

    state.loading = true;
    try {
      const coaches = await fetchJson('/api/coaches');
      state.coaches = Array.isArray(coaches) ? coaches : [];
      state.loadedAt = Date.now();
    } finally {
      state.loading = false;
    }
  }

  function findCoachesHeading() {
    return Array.from(document.querySelectorAll('h1,h2,h3')).find((heading) => {
      const text = (heading.textContent || '').trim().toLowerCase();
      return text === 'тренери' || text === 'тренеры';
    }) || null;
  }

  function renderCoachRow(coach) {
    const id = coach?.id;
    if (!id) return '';
    const phone = escapeHtml(coach.phone || '');
    const telegram = escapeHtml(normalizeTelegramUsername(coach.telegram_username || ''));
    const chatId = escapeHtml(coach.telegram_chat_id || '');
    return `
      <div class="bb-admin-coach-contact-row" data-bb-coach-id="${escapeHtml(id)}">
        <div class="bb-admin-coach-contact-name">${escapeHtml(coach.name || 'Тренер')}</div>
        <div class="bb-admin-coach-contact-role">${escapeHtml(coach.role || '')}</div>
        <div class="bb-admin-coach-contact-fields">
          <label class="bb-admin-coach-contact-label">
            Телефон
            <input class="bb-admin-coach-contact-input" data-bb-coach-phone inputmode="tel" autocomplete="tel" value="${phone}" placeholder="+380..." />
          </label>
          <label class="bb-admin-coach-contact-label">
            Telegram нік
            <input class="bb-admin-coach-contact-input" data-bb-coach-telegram autocomplete="off" value="${telegram}" placeholder="@username" />
          </label>
          <label class="bb-admin-coach-contact-label">
            Telegram ID
            <input class="bb-admin-coach-contact-input" data-bb-coach-chat-id autocomplete="off" value="${chatId}" placeholder="123456789" />
          </label>
        </div>
      </div>
    `;
  }

  function buildPanel() {
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'bb-admin-coach-contact-panel';
    panel.innerHTML = `
      <div class="bb-admin-coach-contact-head">
        <div>
          <div class="bb-admin-coach-contact-title">Зв’язок з тренером для ботів</div>
          <p class="bb-admin-coach-contact-copy">Телефон, Telegram нік і Telegram ID зберігаються в картці тренера. Батьківський бот показує ці контакти саме для тренера групи, а тренерський бот може отримувати персональні повідомлення.</p>
        </div>
        <div class="bb-admin-coach-contact-actions">
          <button type="button" class="bb-admin-coach-contact-button" data-bb-coach-contact-refresh>Оновити</button>
          <button type="button" class="bb-admin-coach-contact-button bb-admin-coach-contact-button-primary" data-bb-coach-contact-save>Зберегти контакти</button>
        </div>
      </div>
      <div class="bb-admin-coach-contact-status" data-bb-coach-contact-status></div>
      ${state.coaches.length
        ? `<div class="bb-admin-coach-contact-grid">${state.coaches.map(renderCoachRow).join('')}</div>`
        : '<div class="bb-admin-coach-contact-empty">Тренерів ще не знайдено. Додайте тренера вище, потім поверніться сюди для контактів.</div>'}
    `;

    panel.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest('[data-bb-coach-contact-refresh]')) {
        event.preventDefault();
        await refreshPanel(true);
      }
      if (target.closest('[data-bb-coach-contact-save]')) {
        event.preventDefault();
        await saveContacts(panel);
      }
    });

    return panel;
  }

  async function saveContacts(panel) {
    if (!getAdminToken()) {
      showStatus(panel, 'Потрібно увійти в адмінку ще раз.', 'error');
      return;
    }

    const rows = Array.from(panel.querySelectorAll('[data-bb-coach-id]'));
    const payloads = rows.map((row) => {
      const id = row.getAttribute('data-bb-coach-id');
      const phoneInput = row.querySelector('[data-bb-coach-phone]');
      const telegramInput = row.querySelector('[data-bb-coach-telegram]');
      const chatInput = row.querySelector('[data-bb-coach-chat-id]');
      const phone = phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : '';
      const telegram = telegramInput instanceof HTMLInputElement ? normalizeTelegramUsername(telegramInput.value) : '';
      const telegramChatId = chatInput instanceof HTMLInputElement ? chatInput.value.trim().replace(/\s+/g, '') : '';
      if (telegramInput instanceof HTMLInputElement) telegramInput.value = telegram;
      if (chatInput instanceof HTMLInputElement) chatInput.value = telegramChatId;
      return { id, phone, telegram_username: telegram, telegram_chat_id: telegramChatId };
    }).filter((item) => item.id);

    const buttons = panel.querySelectorAll('button');
    buttons.forEach((button) => { button.disabled = true; });
    showStatus(panel, 'Зберігаю контакти тренерів...', 'ok');

    try {
      await Promise.all(payloads.map((item) => fetchJson(`/api/coaches/${item.id}/contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: item.phone,
          telegram_username: item.telegram_username,
          telegram_chat_id: item.telegram_chat_id,
        }),
      })));
      state.loadedAt = 0;
      await loadData(true);
      showStatus(panel, 'Контакти збережено. Боти вже можуть брати їх з картки тренера.', 'ok');
    } catch (error) {
      console.error('Coach contact save failed:', error);
      showStatus(panel, 'Не вдалося зберегти контакти. Оновіть сторінку і спробуйте ще раз.', 'error');
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  async function refreshPanel(force = false) {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
    try {
      await loadData(force);
    } catch (error) {
      console.error('Coach contact load failed:', error);
    }
    scheduleRender();
  }

  async function render() {
    if (!isAdminPage()) {
      const panel = document.getElementById(PANEL_ID);
      if (panel) panel.remove();
      return;
    }

    addStyle();
    const heading = findCoachesHeading();
    if (!heading) return;

    const header = heading.parentElement?.parentElement;
    const parent = header?.parentElement;
    if (!header || !parent || parent.querySelector(`#${PANEL_ID}`)) return;

    try {
      await loadData(false);
    } catch (error) {
      console.error('Coach contact load failed:', error);
    }

    const panel = buildPanel();
    parent.insertBefore(panel, header.nextSibling);
  }

  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      render();
    }, 180);
  }

  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('storage', scheduleRender);
  window.addEventListener('popstate', scheduleRender);
  window.addEventListener('hashchange', scheduleRender);
  scheduleRender();
})();
