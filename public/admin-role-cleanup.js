(() => {
  const ADMIN_PATH_RE = /^\/admin(?:\/|$)/;
  const HIDDEN_ATTR = 'data-bb-role-hidden';
  const ROLE_CLASS = 'bb-coach-admin-mode';
  const IG_CACHE_KEY = 'bb_admin_instagram_stats_cache_v1';
  const IG_CACHE_TTL = 10 * 60 * 1000;

  const isAdminPath = () => ADMIN_PATH_RE.test(window.location.pathname);
  const role = () => window.localStorage.getItem('admin_role') || '';
  const token = () => window.localStorage.getItem('admin_token') || '';
  const isCoach = () => isAdminPath() && role() === 'coach';
  const isAdmin = () => isAdminPath() && role() === 'admin';

  const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const money = (value) => `${Math.round(Number(value || 0)).toLocaleString('uk-UA')} грн`;
  const compactNumber = (value) => Number(value || 0).toLocaleString('uk-UA');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  const authHeaders = () => {
    const adminToken = token();
    return adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
  };

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch (_) { data = { raw: text }; }
    }
    if (!response.ok) {
      throw new Error(data?.error || `Request failed: ${response.status}`);
    }
    return data;
  };

  const addStyles = () => {
    if (document.getElementById('bb-admin-role-cleanup-style')) return;
    const style = document.createElement('style');
    style.id = 'bb-admin-role-cleanup-style';
    style.textContent = `
      .bb-role-scope-banner,
      .bb-coach-finance-card,
      .bb-admin-instagram-card {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(24,24,27,.42);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      }
      .bb-role-scope-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
        padding: 16px 18px;
        border-radius: 24px;
      }
      .bb-role-scope-banner strong,
      .bb-admin-instagram-card strong {
        color: #fff;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .16em;
        text-transform: uppercase;
      }
      .bb-role-scope-banner span,
      .bb-admin-instagram-card span {
        color: rgba(161,161,170,.95);
        font-size: 12px;
        line-height: 1.45;
      }
      .bb-role-pill {
        flex: none;
        border-radius: 999px;
        border: 1px solid rgba(239,68,68,.35);
        background: rgba(239,68,68,.10);
        color: #f87171;
        padding: 9px 12px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .14em;
        text-transform: uppercase;
      }
      .bb-coach-finance-card {
        min-height: 190px;
        border-radius: 32px;
        padding: 28px;
        text-align: left;
        transition: transform .22s ease, border-color .22s ease, background .22s ease;
      }
      .bb-coach-finance-card:hover {
        transform: translateY(-4px);
        border-color: rgba(16,185,129,.36);
        background: rgba(24,24,27,.68);
      }
      .bb-coach-finance-card .bb-kicker,
      .bb-admin-instagram-card .bb-kicker {
        color: #71717a;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .22em;
        text-transform: uppercase;
      }
      .bb-coach-finance-card .bb-value {
        margin-top: 14px;
        color: #fff;
        font-size: clamp(30px, 4vw, 44px);
        font-weight: 1000;
        letter-spacing: -.02em;
        line-height: .95;
      }
      .bb-coach-finance-card .bb-copy {
        margin-top: 14px;
        max-width: 280px;
        color: #a1a1aa;
        font-size: 13px;
        line-height: 1.45;
      }
      .bb-coach-finance-card .bb-arrow {
        position: absolute;
        right: 22px;
        top: 22px;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(16,185,129,.10);
        color: #34d399;
      }
      .bb-admin-instagram-card {
        border-radius: 32px;
        padding: 24px;
        margin: 0 0 24px;
      }
      .bb-admin-instagram-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 18px;
      }
      .bb-admin-instagram-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: flex-end;
      }
      .bb-admin-instagram-actions button {
        min-height: 40px;
        border: 0;
        border-radius: 14px;
        padding: 0 14px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .12em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .bb-admin-instagram-actions [data-bb-ig-refresh] {
        background: rgba(255,255,255,.08);
        color: #fff;
      }
      .bb-admin-instagram-actions [data-bb-ig-connect] {
        background: linear-gradient(90deg, #9333ea, #db2777);
        color: #fff;
      }
      .bb-admin-instagram-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .bb-admin-instagram-metric {
        min-height: 104px;
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,.06);
        background: rgba(0,0,0,.25);
        padding: 16px;
      }
      .bb-admin-instagram-metric p:first-child {
        margin: 0 0 10px;
        color: #71717a;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .18em;
        text-transform: uppercase;
      }
      .bb-admin-instagram-metric p:last-child {
        margin: 0;
        color: #fff;
        font-size: 26px;
        font-weight: 1000;
        letter-spacing: -.02em;
      }
      .bb-admin-instagram-note {
        margin-top: 12px;
        color: #71717a;
        font-size: 11px;
        line-height: 1.45;
      }
      @media (max-width: 900px) {
        .bb-admin-instagram-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .bb-role-scope-banner,
        .bb-admin-instagram-top { flex-direction: column; align-items: stretch; }
        .bb-role-pill { width: max-content; }
        .bb-admin-instagram-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  };

  const restoreCoachHidden = () => {
    document.querySelectorAll(`[${HIDDEN_ATTR}="coach"]`).forEach((element) => {
      element.style.display = '';
      element.removeAttribute(HIDDEN_ATTR);
    });
  };

  const hideElement = (element) => {
    if (!element || element.getAttribute(HIDDEN_ATTR) === 'coach') return;
    element.setAttribute(HIDDEN_ATTR, 'coach');
    element.style.display = 'none';
  };

  const hideCoachMenuNoise = () => {
    const blockedTexts = [
      'заявки',
      'реєстрації',
      'локації',
      'smm agency',
      'конструктор',
      'тренери',
      'акаунти',
      'налаштування',
      'журнал подій',
      'сповіщення',
      'експорт',
      'імпорт',
      'імпортувати'
    ];

    document.querySelectorAll('nav button, header button, main button, main a').forEach((element) => {
      const text = norm(element.textContent);
      if (!text || text.length > 80) return;
      if (blockedTexts.some((blocked) => text === blocked || text.includes(blocked))) {
        hideElement(element);
      }
    });

    document.querySelectorAll('header button').forEach((button) => {
      const text = norm(button.textContent);
      if (!text && button.querySelector('span.absolute') && button.querySelector('svg')) {
        hideElement(button);
      }
      if (text.includes('instagram')) hideElement(button.closest('div') || button);
    });

    const crmButton = document.getElementById('nav-crm');
    const crmLabel = crmButton?.querySelector('span');
    if (crmLabel && norm(crmLabel.textContent).includes('crm')) crmLabel.textContent = 'Мої фінанси';
  };

  const hideCoachDashboardLeadBlocks = () => {
    document.querySelectorAll('h2,h3').forEach((heading) => {
      const text = norm(heading.textContent);
      if (!text.includes('динаміка заявок') && !text.includes('останні заявки')) return;
      const card = heading.closest('[class*="rounded"]') || heading.parentElement;
      hideElement(card);
    });
  };

  const mountCoachScopeBanner = () => {
    const page = document.querySelector('.bb-motion-page');
    if (!page || page.querySelector('[data-bb-coach-scope-banner]')) return;

    const banner = document.createElement('div');
    banner.className = 'bb-role-scope-banner';
    banner.setAttribute('data-bb-coach-scope-banner', 'true');
    banner.innerHTML = `
      <div>
        <strong>Режим тренера</strong><br>
        <span>Показані тільки ваші групи, учасники, відмітки, платежі і домашні завдання. У рейтингу можна дивитись свої групи або загальний клубний список.</span>
      </div>
      <div class="bb-role-pill">Без зайвого</div>
    `;
    page.prepend(banner);
  };

  const mountHomeworkScopeNote = () => {
    const page = document.querySelector('.bb-motion-page');
    if (!page || page.querySelector('[data-bb-homework-scope-note]')) return;
    const text = norm(page.textContent);
    if (!text.includes('домаш') && !text.includes('дз')) return;

    const note = document.createElement('div');
    note.className = 'bb-role-scope-banner';
    note.setAttribute('data-bb-homework-scope-note', 'true');
    note.innerHTML = `
      <div>
        <strong>Домашні завдання</strong><br>
        <span>Тренер розсилає ДЗ тільки своїм групам і своїм учасникам. Адмін бачить всю картину по клубу.</span>
      </div>
      <div class="bb-role-pill">Своя група</div>
    `;
    page.prepend(note);
  };

  const updateCoachFinanceCard = async (card) => {
    const valueNode = card.querySelector('[data-bb-coach-finance-value]');
    const copyNode = card.querySelector('[data-bb-coach-finance-copy]');
    try {
      const data = await requestJson('/api/dashboard/stats');
      const totals = data?.totals || {};
      valueNode.textContent = money(totals.monthly_revenue || 0);
      copyNode.textContent = `Боржників: ${compactNumber(totals.unpaid_participants || 0)}. Натисни, щоб відкрити свої платежі.`;
    } catch (_) {
      valueNode.textContent = '0 грн';
      copyNode.textContent = 'Не вдалося оновити фінанси. Натисни, щоб відкрити CRM.';
    }
  };

  const mountCoachFinanceCard = () => {
    const page = document.querySelector('.bb-motion-page');
    if (!page || !norm(page.textContent).includes('головна')) return;
    if (page.querySelector('[data-bb-coach-finance-card]')) return;

    const statsGrid = Array.from(page.querySelectorAll('.grid')).find((grid) => {
      const text = norm(grid.textContent);
      return text.includes('всього учнів') && text.includes('боржники');
    });
    if (!statsGrid) return;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bb-coach-finance-card';
    card.setAttribute('data-bb-coach-finance-card', 'true');
    card.innerHTML = `
      <div class="bb-arrow">›</div>
      <div class="bb-kicker">Мої фінанси</div>
      <div class="bb-value" data-bb-coach-finance-value>...</div>
      <div class="bb-copy" data-bb-coach-finance-copy>Завантажую ваші платежі...</div>
    `;
    card.addEventListener('click', () => document.getElementById('nav-crm')?.click());
    statsGrid.prepend(card);
    updateCoachFinanceCard(card);
  };

  const insightValue = (payload, names) => {
    const allInsights = [
      ...(Array.isArray(payload?.account_insights) ? payload.account_insights : []),
      ...(Array.isArray(payload?.insights) ? payload.insights : []),
      ...(Array.isArray(payload?.data) ? payload.data : [])
    ];

    const item = allInsights.find((entry) => names.includes(String(entry?.name || entry?.metric || '').toLowerCase()));
    if (!item) return 0;
    const raw = Array.isArray(item.values) ? item.values[item.values.length - 1]?.value : (item.value ?? item.total_value?.value);
    const numberValue = Number(raw);
    return Number.isFinite(numberValue) ? numberValue : 0;
  };

  const mediaStats = (payload) => {
    const media = Array.isArray(payload?.media)
      ? payload.media
      : Array.isArray(payload?.media?.data)
        ? payload.media.data
        : [];
    return media.reduce((acc, item) => {
      acc.posts += 1;
      acc.likes += Number(item?.like_count || 0);
      acc.comments += Number(item?.comments_count || 0);
      return acc;
    }, { posts: 0, likes: 0, comments: 0 });
  };

  const renderInstagramLoading = (widget) => {
    widget.querySelector('[data-bb-ig-body]').innerHTML = `
      <div class="bb-admin-instagram-grid">
        ${['Підключення', 'Охоплення', 'Контент', 'Реакції'].map((label) => `
          <div class="bb-admin-instagram-metric">
            <p>${label}</p>
            <p>...</p>
          </div>
        `).join('')}
      </div>
      <div class="bb-admin-instagram-note">Завантажую Instagram-статистику для адміна.</div>
    `;
  };

  const renderInstagramDisconnected = (widget) => {
    widget.querySelector('[data-bb-ig-body]').innerHTML = `
      <div class="bb-admin-instagram-grid">
        <div class="bb-admin-instagram-metric"><p>Статус</p><p>OFF</p></div>
        <div class="bb-admin-instagram-metric"><p>Охоплення</p><p>0</p></div>
        <div class="bb-admin-instagram-metric"><p>Пости</p><p>0</p></div>
        <div class="bb-admin-instagram-metric"><p>Реакції</p><p>0</p></div>
      </div>
      <div class="bb-admin-instagram-note">Instagram ще не підключений. Підключення доступне тільки адміну клубу.</div>
    `;
  };

  const renderInstagramStats = (widget, status, syncPayload) => {
    const media = mediaStats(syncPayload);
    const reach = insightValue(syncPayload, ['reach', 'accounts_reached']);
    const impressions = insightValue(syncPayload, ['impressions', 'views']);
    const followers = insightValue(syncPayload, ['follower_count', 'followers_count']);
    const reactions = media.likes + media.comments;
    const username = status?.account?.username || status?.username || syncPayload?.username || 'Instagram';

    widget.querySelector('[data-bb-ig-body]').innerHTML = `
      <div class="bb-admin-instagram-grid">
        <div class="bb-admin-instagram-metric"><p>Акаунт</p><p>${escapeHtml(username)}</p></div>
        <div class="bb-admin-instagram-metric"><p>Охоплення</p><p>${compactNumber(reach || impressions)}</p></div>
        <div class="bb-admin-instagram-metric"><p>Пости</p><p>${compactNumber(media.posts)}</p></div>
        <div class="bb-admin-instagram-metric"><p>Реакції</p><p>${compactNumber(reactions)}</p></div>
      </div>
      <div class="bb-admin-instagram-note">Дані показані тільки в адмінці власника. Тренерський кабінет цей модуль не завантажує.</div>
    `;
  };

  const loadInstagramStats = async (widget, force = false) => {
    if (!widget) return;
    const now = Date.now();
    if (!force) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(IG_CACHE_KEY) || 'null');
        if (cached && now - cached.time < IG_CACHE_TTL) {
          renderInstagramStats(widget, cached.status, cached.syncPayload);
          return;
        }
      } catch (_) {}
    }

    renderInstagramLoading(widget);
    try {
      const status = await requestJson('/api/instagram/status');
      if (!status?.connected) {
        renderInstagramDisconnected(widget);
        return;
      }
      const syncPayload = await requestJson('/api/instagram/sync', { method: 'POST' });
      sessionStorage.setItem(IG_CACHE_KEY, JSON.stringify({ time: now, status, syncPayload }));
      renderInstagramStats(widget, status, syncPayload);
    } catch (error) {
      widget.querySelector('[data-bb-ig-body]').innerHTML = `
        <div class="bb-admin-instagram-grid">
          <div class="bb-admin-instagram-metric"><p>Статус</p><p>ERR</p></div>
          <div class="bb-admin-instagram-metric"><p>Охоплення</p><p>0</p></div>
          <div class="bb-admin-instagram-metric"><p>Пости</p><p>0</p></div>
          <div class="bb-admin-instagram-metric"><p>Реакції</p><p>0</p></div>
        </div>
        <div class="bb-admin-instagram-note">Instagram-статистика не завантажилась. Перевір підключення акаунта або токен Instagram API.</div>
      `;
    }
  };

  const mountAdminInstagramWidget = () => {
    const page = document.querySelector('.bb-motion-page');
    if (!page || !norm(page.textContent).includes('головна')) return;
    if (page.querySelector('[data-bb-admin-instagram-card]')) return;

    const firstBlock = page.firstElementChild;
    const widget = document.createElement('section');
    widget.className = 'bb-admin-instagram-card';
    widget.setAttribute('data-bb-admin-instagram-card', 'true');
    widget.innerHTML = `
      <div class="bb-admin-instagram-top">
        <div>
          <div class="bb-kicker">Instagram API</div>
          <strong>Статистика для адміна</strong><br>
          <span>Окремий блок для власника: акаунт, охоплення, пости і реакції. У тренера цього блоку немає.</span>
        </div>
        <div class="bb-admin-instagram-actions">
          <button type="button" data-bb-ig-refresh>Оновити</button>
          <button type="button" data-bb-ig-connect>Підключити</button>
        </div>
      </div>
      <div data-bb-ig-body></div>
    `;

    if (firstBlock?.nextSibling) page.insertBefore(widget, firstBlock.nextSibling);
    else page.appendChild(widget);
    loadInstagramStats(widget, false);
  };

  const connectInstagram = async () => {
    try {
      const data = await requestJson('/api/auth/instagram/url?action=connect');
      if (data?.url) window.open(data.url, 'InstagramLogin', 'width=600,height=700');
    } catch (_) {}
  };

  const redirectForbiddenCoachTabs = () => {
    if (!isCoach()) return;
    const mainText = norm(document.querySelector('main')?.innerText || '').slice(0, 140);
    const forbiddenStarts = ['заявки', 'реєстрації', 'локації', 'smm agency', 'конструктор', 'тренери', 'акаунти', 'налаштування'];
    if (forbiddenStarts.some((item) => mainText.startsWith(item))) {
      document.getElementById('nav-dashboard')?.click();
    }
  };

  const run = () => {
    if (!isAdminPath()) return;
    addStyles();

    if (isCoach()) {
      document.documentElement.classList.add(ROLE_CLASS);
      hideCoachMenuNoise();
      hideCoachDashboardLeadBlocks();
      mountCoachScopeBanner();
      mountHomeworkScopeNote();
      mountCoachFinanceCard();
      redirectForbiddenCoachTabs();
      return;
    }

    document.documentElement.classList.remove(ROLE_CLASS);
    restoreCoachHidden();
    if (isAdmin()) mountAdminInstagramWidget();
  };

  let scheduled = 0;
  const scheduleRun = () => {
    window.clearTimeout(scheduled);
    scheduled = window.setTimeout(run, 80);
  };

  document.addEventListener('click', (event) => {
    const refresh = event.target.closest('[data-bb-ig-refresh]');
    const connect = event.target.closest('[data-bb-ig-connect]');
    if (refresh) {
      event.preventDefault();
      loadInstagramStats(refresh.closest('[data-bb-admin-instagram-card]'), true);
    }
    if (connect) {
      event.preventDefault();
      connectInstagram();
    }
  });

  const observer = new MutationObserver(scheduleRun);
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('storage', scheduleRun);
  window.addEventListener('focus', scheduleRun);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();

  let warmupTicks = 0;
  const warmup = window.setInterval(() => {
    warmupTicks += 1;
    run();
    if (warmupTicks > 8) window.clearInterval(warmup);
  }, 700);
})();
