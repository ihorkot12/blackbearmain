(() => {
  const ADMIN_PATH_RE = /^\/admin(?:\/|$)/;
  const STYLE_ID = 'bb-instagram-account-picker-style';
  const IG_CACHE_KEY = 'bb_admin_instagram_stats_cache_v1';

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
      @media (max-width: 640px) {
        .bb-ig-account-head,
        .bb-ig-account-item { align-items: stretch; flex-direction: column; }
        .bb-ig-account-badge { width: max-content; }
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

  const renderAccounts = (card, accounts) => {
    if (!accounts.length) {
      setPanel(card, `
        <div class="bb-ig-account-head">
          <strong>Instagram акаунти</strong>
          <span>Поки немає підключених акаунтів.</span>
        </div>
        <div class="bb-ig-account-empty">Натисни “Підключити” і пройди авторизацію Meta ще раз.</div>
      `);
      return;
    }

    setPanel(card, `
      <div class="bb-ig-account-head">
        <strong>Instagram акаунти</strong>
        <span>Обери клубний акаунт для статистики.</span>
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
      const data = await requestJson('/api/instagram/accounts');
      renderAccounts(card, Array.isArray(data?.accounts) ? data.accounts : []);
    } catch (error) {
      setPanel(card, `
        <div class="bb-ig-account-head">
          <strong>Instagram акаунти</strong>
          <span>Не вдалося завантажити.</span>
        </div>
        <div class="bb-ig-account-empty">${escapeHtml(error?.message || 'Перевір підключення Instagram і авторизацію адміна.')}</div>
      `);
    }
  };

  const selectAccount = async (button) => {
    const card = button.closest('[data-bb-admin-instagram-card]');
    const id = button.getAttribute('data-bb-ig-select-account');
    if (!card || !id || button.dataset.bbBusy === '1') return;
    button.dataset.bbBusy = '1';

    try {
      await requestJson('/api/instagram/select-account', {
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
      if (!actions || actions.querySelector('[data-bb-ig-accounts]')) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-bb-ig-accounts', 'true');
      button.textContent = 'Акаунти';

      const connect = actions.querySelector('[data-bb-ig-connect]');
      if (connect) actions.insertBefore(button, connect);
      else actions.appendChild(button);
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
