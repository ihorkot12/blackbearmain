(() => {
  const ADMIN_PATH_RE = /^\/admin(?:\/|$)/;
  const STYLE_ID = 'bb-instagram-account-picker-style';
  const IG_CACHE_KEY = 'bb_admin_instagram_stats_cache_v1';
  const IG_ACCOUNTS_URL = '/api/social/ig/accounts';
  const IG_SELECT_ACCOUNT_URL = '/api/social/ig/select-account';

  const isAdminPath = () => ADMIN_PATH_RE.test(window.location.pathname);
  const isAdmin = () => window.localStorage.getItem('admin_role') === 'admin';
  const authToken = () => window.localStorage.getItem('admin_token') || '';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  const authHeaders = () => {
    const token = authToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {})
      },
      cache: 'no-store'
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch (_) { data = { raw: text }; }
    }
    if (!response.ok) throw new Error(data?.error || `Request failed: ${response.status}`);
    return data;
  };

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bb-admin-instagram-actions [data-bb-ig-accounts] {
        border: 1px solid rgba(59,130,246,.30) !important;
        background: rgba(59,130,246,.14) !important;
        color: #bfdbfe !important;
      }
      .bb-admin-instagram-actions [data-bb-ig-connect] {
        border: 1px solid rgba(236,72,153,.36) !important;
        background: linear-gradient(90deg, rgba(147,51,234,.94), rgba(219,39,119,.94)) !important;
        color: #fff !important;
      }
      .bb-ig-account-panel {
        display: none;
        margin-top: 14px;
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(0,0,0,.22);
        padding: 14px;
      }
      .bb-ig-account-panel.is-open { display: block; }
      .bb-ig-account-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .bb-ig-account-head strong {
        color: #fff;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .14em;
        text-transform: uppercase;
      }
      .bb-ig-account-head span,
      .bb-ig-account-empty {
        color: #a1a1aa;
        font-size: 12px;
        line-height: 1.45;
      }
      .bb-ig-account-list {
        display: grid;
        gap: 10px;
      }
      .bb-ig-account-item {
        width: 100%;
        min-height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 18px;
        background: rgba(24,24,27,.58);
        color: #fff;
        padding: 12px 14px;
        text-align: left;
        cursor: pointer;
        transition: transform .18s ease, border-color .18s ease, background .18s ease;
      }
      .bb-ig-account-item:hover {
        transform: translateY(-1px);
        border-color: rgba(239,68,68,.42);
        background: rgba(39,39,42,.82);
      }
      .bb-ig-account-item.is-active {
        border-color: rgba(34,197,94,.42);
        background: rgba(22,101,52,.16);
      }
      .bb-ig-account-name {
        display: block;
        color: #fff;
        font-size: 14px;
        font-weight: 900;
        line-height: 1.15;
      }
      .bb-ig-account-meta {
        display: block;
        margin-top: 4px;
        color: #71717a;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .06em;
        text-transform: uppercase;
      }
      .bb-ig-account-badge {
        flex: none;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.06);
        color: #d4d4d8;
        padding: 7px 10px;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .bb-ig-account-item.is-active .bb-ig-account-badge {
        border-color: rgba(34,197,94,.35);
        background: rgba(34,197,94,.16);
        color: #86efac;
      }
      .bb-ig-reconnect-card {
        width: 100%;
        min-height: 50px;
        margin-top: 12px;
        border: 1px solid rgba(236,72,153,.34);
        border-radius: 16px;
        background: linear-gradient(90deg, rgba(147,51,234,.90), rgba(219,39,119,.92));
        color: #fff;
        padding: 0 14px;
        font-size: 10px;
        font-weight: 950;
        letter-spacing: .12em;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: 0 16px 34px rgba(219,39,119,.16);
      }
      .bb-ig-reconnect-note {
        display: block;
        margin-top: 8px;
        color: #a1a1aa;
        font-size: 11px;
        line-height: 1.45;
      }
      @media (max-width: 640px) {
        [data-bb-admin-instagram-card] {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          padding: 18px !important;
          border-radius: 24px !important;
          overflow: visible !important;
        }
        [data-bb-admin-instagram-card] * { min-width: 0; }
        .bb-admin-instagram-actions {
          width: 100% !important;
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
          overflow: visible !important;
        }
        .bb-admin-instagram-actions button {
          width: 100% !important;
          min-height: 44px !important;
          padding: 0 8px !important;
          border-radius: 14px !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          line-height: 1.12 !important;
          font-size: 9px !important;
          letter-spacing: .08em !important;
        }
        .bb-admin-instagram-actions [data-bb-ig-connect] {
          grid-column: 1 / -1 !important;
          min-height: 50px !important;
          font-size: 10px !important;
        }
        .bb-ig-account-panel {
          margin-top: 12px;
          padding: 12px;
          border-radius: 20px;
        }
        .bb-ig-account-head,
        .bb-ig-account-item { align-items: stretch; flex-direction: column; }
        .bb-ig-account-head { gap: 6px; }
        .bb-ig-account-head strong { font-size: 10px; letter-spacing: .11em; }
        .bb-ig-account-item {
          gap: 10px;
          min-height: 78px;
          padding: 13px;
          border-radius: 16px;
        }
        .bb-ig-account-name { font-size: 15px; overflow-wrap: anywhere; }
        .bb-ig-account-meta { font-size: 9px; overflow-wrap: anywhere; }
        .bb-ig-account-badge { width: max-content; }
        .bb-ig-reconnect-card { min-height: 52px; font-size: 10px; letter-spacing: .08em; }
      }
    `;
    document.head.appendChild(style);
  };

  const getPanel = (card) => {
    let panel = card.querySelector('[data-bb-ig-account-panel]');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'bb-ig-account-panel';
      panel.setAttribute('data-bb-ig-account-panel', 'true');
      card.appendChild(panel);
    }
    return panel;
  };

  const setPanel = (card, html, open = true) => {
    const panel = getPanel(card);
    panel.innerHTML = html;
    panel.classList.toggle('is-open', open);
  };

  const renderReconnect = (label = 'Перепідключити Instagram') => `
    <button type="button" class="bb-ig-reconnect-card" data-bb-ig-connect="true">${escapeHtml(label)}</button>
    <span class="bb-ig-reconnect-note">Якщо Meta показує не той акаунт або змінились права доступу, натисни цю кнопку і дай доступ клубній сторінці ще раз.</span>
  `;

  const renderAccounts = (card, accounts) => {
    if (!accounts.length) {
      setPanel(card, `
        <div class="bb-ig-account-head">
          <strong>Instagram акаунти</strong>
          <span>Поки немає підключених акаунтів.</span>
        </div>
        <div class="bb-ig-account-empty">Натисни “Перепідключити Instagram” і пройди авторизацію Meta ще раз.</div>
        ${renderReconnect('Підключити Instagram')}
      `);
      return;
    }

    setPanel(card, `
      <div class="bb-ig-account-head">
        <strong>Instagram акаунти</strong>
        <span>Обери клубний акаунт або перепідключи Meta.</span>
      </div>
      <div class="bb-ig-account-list">
        ${accounts.map((account) => {
          const username = account.username || 'Instagram';
          const id = account.instagram_business_account_id || account.id;
          const page = account.facebook_page_id ? `Page ${account.facebook_page_id}` : 'Direct Instagram';
          return `
            <button type="button" class="bb-ig-account-item ${account.is_active ? 'is-active' : ''}" data-bb-ig-select-account="${escapeHtml(id)}">
              <span>
                <span class="bb-ig-account-name">@${escapeHtml(username)}</span>
                <span class="bb-ig-account-meta">${escapeHtml(page)}</span>
              </span>
              <span class="bb-ig-account-badge">${account.is_active ? 'Активний' : 'Обрати'}</span>
            </button>
          `;
        }).join('')}
      </div>
      ${renderReconnect()}
    `);
  };

  const loadAccounts = async (card) => {
    if (!card) return;
    setPanel(card, `
      <div class="bb-ig-account-head">
        <strong>Instagram акаунти</strong>
        <span>Завантажую список...</span>
      </div>
    `);

    try {
      const data = await requestJson(IG_ACCOUNTS_URL);
      renderAccounts(card, Array.isArray(data?.accounts) ? data.accounts : []);
    } catch (error) {
      setPanel(card, `
        <div class="bb-ig-account-head">
          <strong>Instagram акаунти</strong>
          <span>Не вдалося завантажити.</span>
        </div>
        <div class="bb-ig-account-empty">${escapeHtml(error?.message || 'Перевір підключення Instagram і авторизацію адміна.')}</div>
        ${renderReconnect()}
      `);
    }
  };

  const selectAccount = async (button) => {
    const card = button.closest('[data-bb-admin-instagram-card]');
    const id = button.getAttribute('data-bb-ig-select-account');
    if (!card || !id || button.dataset.bbBusy === '1') return;
    button.dataset.bbBusy = '1';

    try {
      await requestJson(IG_SELECT_ACCOUNT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagram_business_account_id: id })
      });
      sessionStorage.removeItem(IG_CACHE_KEY);
      await loadAccounts(card);
      const refresh = card.querySelector('[data-bb-ig-refresh]');
      if (refresh) window.setTimeout(() => refresh.click(), 120);
    } catch (error) {
      setPanel(card, `
        <div class="bb-ig-account-head">
          <strong>Instagram акаунти</strong>
          <span>Не перемкнулось.</span>
        </div>
        <div class="bb-ig-account-empty">${escapeHtml(error?.message || 'Не вдалося обрати акаунт.')}</div>
        ${renderReconnect()}
      `);
    } finally {
      button.dataset.bbBusy = '0';
    }
  };

  const mountPicker = () => {
    if (!isAdminPath() || !isAdmin()) return;
    addStyles();

    document.querySelectorAll('[data-bb-admin-instagram-card]').forEach((card) => {
      const actions = card.querySelector('.bb-admin-instagram-actions');
      if (!actions) return;

      if (!actions.querySelector('[data-bb-ig-accounts]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('data-bb-ig-accounts', 'true');
        button.textContent = 'Акаунти';

        const connect = actions.querySelector('[data-bb-ig-connect]');
        if (connect) actions.insertBefore(button, connect);
        else actions.appendChild(button);
      }

      const connect = actions.querySelector('[data-bb-ig-connect]');
      if (connect && !connect.dataset.bbIgReconnectReady) {
        connect.dataset.bbIgReconnectReady = 'true';
        connect.textContent = 'Перепідключити Instagram';
        connect.setAttribute('aria-label', 'Перепідключити Instagram');
        connect.setAttribute('title', 'Перепідключити Instagram');
      }
    });
  };

  document.addEventListener('click', (event) => {
    const accountButton = event.target?.closest?.('[data-bb-ig-accounts]');
    if (accountButton) {
      event.preventDefault();
      loadAccounts(accountButton.closest('[data-bb-admin-instagram-card]'));
      return;
    }

    const selectButton = event.target?.closest?.('[data-bb-ig-select-account]');
    if (selectButton) {
      event.preventDefault();
      selectAccount(selectButton);
    }
  });

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (event.data === 'instagram_connected' || data?.type === 'instagram_connected') {
      sessionStorage.removeItem(IG_CACHE_KEY);
    }
  });

  const observer = new MutationObserver(() => window.setTimeout(mountPicker, 80));
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('storage', mountPicker);
  window.addEventListener('focus', mountPicker);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPicker, { once: true });
  else mountPicker();

  let ticks = 0;
  const warmup = window.setInterval(() => {
    ticks += 1;
    mountPicker();
    if (ticks > 8) window.clearInterval(warmup);
  }, 700);
})();
