(() => {
  const PANEL_ID = 'bb-parent-telegram-social-panel';
  const STYLE_ID = 'bb-parent-telegram-social-style';

  const isParentPage = () => window.location.pathname.replace(/\/$/, '') === '/parent';
  const getParentToken = () => window.localStorage.getItem('parent_token') || '';

  const state = {
    telegram: null,
    social: null,
    loadingTelegram: false,
    loadingSocial: false
  };

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bb-parent-connect-panel {
        margin: 18px auto;
        max-width: 1120px;
        border: 1px solid rgba(15, 23, 42, 0.14);
        border-radius: 8px;
        background: #ffffff;
        color: #111827;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
        overflow: hidden;
      }
      .bb-parent-connect-inner {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.85fr);
        gap: 0;
      }
      .bb-parent-connect-section {
        padding: 18px;
      }
      .bb-parent-connect-section + .bb-parent-connect-section {
        border-left: 1px solid rgba(15, 23, 42, 0.12);
        background: #f8fafc;
      }
      .bb-parent-connect-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        color: #475569;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
      }
      .bb-parent-connect-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #ef4444;
      }
      .bb-parent-connect-dot.is-connected {
        background: #16a34a;
      }
      .bb-parent-connect-title {
        margin: 0 0 6px;
        color: #020617;
        font-size: 18px;
        font-weight: 800;
        line-height: 1.25;
      }
      .bb-parent-connect-text {
        margin: 0 0 14px;
        max-width: 680px;
        color: #475569;
        font-size: 14px;
        line-height: 1.5;
      }
      .bb-parent-connect-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .bb-parent-connect-button {
        display: inline-flex;
        min-height: 40px;
        align-items: center;
        justify-content: center;
        border: 1px solid #111827;
        border-radius: 8px;
        padding: 9px 14px;
        background: #111827;
        color: #ffffff;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.2;
        text-decoration: none;
        cursor: pointer;
      }
      .bb-parent-connect-button:hover,
      .bb-parent-connect-button:focus-visible {
        background: #0f172a;
        color: #ffffff;
      }
      .bb-parent-connect-button.secondary {
        border-color: rgba(15, 23, 42, 0.22);
        background: #ffffff;
        color: #111827;
      }
      .bb-parent-connect-button.secondary:hover,
      .bb-parent-connect-button.secondary:focus-visible {
        border-color: #ef4444;
        color: #991b1b;
      }
      @media (max-width: 760px) {
        .bb-parent-connect-panel {
          margin: 14px 12px;
        }
        .bb-parent-connect-inner {
          grid-template-columns: 1fr;
        }
        .bb-parent-connect-section + .bb-parent-connect-section {
          border-left: 0;
          border-top: 1px solid rgba(15, 23, 42, 0.12);
        }
        .bb-parent-connect-button {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async function fetchTelegram(force = false) {
    if (state.telegram && !force) return state.telegram;
    if (state.loadingTelegram) return state.telegram;
    const token = getParentToken();
    if (!token) return null;

    state.loadingTelegram = true;
    try {
      const response = await fetch('/api/parent/telegram-link', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return null;
      state.telegram = await response.json();
      return state.telegram;
    } catch {
      return null;
    } finally {
      state.loadingTelegram = false;
    }
  }

  async function fetchSocial() {
    if (state.social || state.loadingSocial) return state.social;
    state.loadingSocial = true;
    try {
      const response = await fetch('/api/parent/social-links', { credentials: 'same-origin' });
      state.social = response.ok ? await response.json() : {};
      return state.social;
    } catch {
      state.social = {};
      return state.social;
    } finally {
      state.loadingSocial = false;
    }
  }

  async function openTelegramConnect() {
    const info = await fetchTelegram(true);
    if (info?.connectUrl) {
      window.open(info.connectUrl, '_blank', 'noopener,noreferrer');
      renderPanel();
    }
  }

  function shouldInterceptTelegramClick(target) {
    if (!isParentPage()) return null;
    const control = target.closest('button, a, [role="button"]');
    if (!control || control.closest(`#${PANEL_ID}`)) return null;
    const text = (control.textContent || '').toLowerCase();
    if (!text.includes('telegram')) return null;
    if (text.includes('відключити')) return null;
    return control;
  }

  document.addEventListener('click', (event) => {
    const control = shouldInterceptTelegramClick(event.target);
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    openTelegramConnect();
  }, true);

  function findMountPoint() {
    const root = document.getElementById('root');
    const main = document.querySelector('main') || root;
    if (!main) return null;

    const firstWideSection = main.querySelector('.max-w-7xl, .max-w-6xl, section, [class*="grid"]');
    return firstWideSection?.parentElement || main;
  }

  function renderHtml(telegram, social) {
    const connected = Boolean(telegram?.connected || Number(telegram?.connectedCount || 0) > 0);
    const statusText = connected ? 'Telegram підключено' : 'Telegram очікує підключення';
    const actionText = connected ? 'Підключити ще одного з батьків' : 'Підключити Telegram';
    const instagramUrl = social?.instagramUrl || '';
    const facebookUrl = social?.facebookUrl || '';

    return `
      <div class="bb-parent-connect-inner">
        <section class="bb-parent-connect-section" aria-label="Telegram">
          <div class="bb-parent-connect-eyebrow"><span class="bb-parent-connect-dot ${connected ? 'is-connected' : ''}"></span>${statusText}</div>
          <h2 class="bb-parent-connect-title">Telegram-сповіщення</h2>
          <p class="bb-parent-connect-text">Сповіщення про ДЗ, оплату і повідомлення тренера приходитимуть у Telegram.</p>
          <div class="bb-parent-connect-actions">
            <button class="bb-parent-connect-button" type="button" data-bb-connect-telegram>${actionText}</button>
          </div>
        </section>
        <section class="bb-parent-connect-section" aria-label="Соцмережі клубу">
          <div class="bb-parent-connect-eyebrow"><span class="bb-parent-connect-dot"></span>Підпишіться на клуб</div>
          <h2 class="bb-parent-connect-title">Новини BLACK BEAR DOJO</h2>
          <p class="bb-parent-connect-text">Там публікуємо фото, відео, новини клубу, змагання, атестації та важливі оголошення.</p>
          <div class="bb-parent-connect-actions">
            ${instagramUrl ? `<a class="bb-parent-connect-button secondary" href="${instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram</a>` : ''}
            ${facebookUrl ? `<a class="bb-parent-connect-button secondary" href="${facebookUrl}" target="_blank" rel="noopener noreferrer">Facebook</a>` : ''}
          </div>
        </section>
      </div>
    `;
  }

  async function renderPanel() {
    addStyle();

    if (!isParentPage()) {
      document.getElementById(PANEL_ID)?.remove();
      return;
    }

    const mount = findMountPoint();
    if (!mount || !getParentToken()) return;

    const [telegram, social] = await Promise.all([fetchTelegram(), fetchSocial()]);
    if (!telegram) return;

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.className = 'bb-parent-connect-panel';
      mount.insertBefore(panel, mount.firstElementChild || null);
    }

    panel.innerHTML = renderHtml(telegram, social || {});
    panel.querySelector('[data-bb-connect-telegram]')?.addEventListener('click', openTelegramConnect);
  }

  let renderTimer = null;
  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderPanel, 250);
  }

  const originalPushState = history.pushState;
  history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    scheduleRender();
    return result;
  };

  window.addEventListener('popstate', scheduleRender);
  window.addEventListener('storage', scheduleRender);
  document.addEventListener('DOMContentLoaded', scheduleRender);

  const observer = new MutationObserver(() => {
    if (isParentPage() && !document.getElementById(PANEL_ID)) scheduleRender();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  scheduleRender();
})();
