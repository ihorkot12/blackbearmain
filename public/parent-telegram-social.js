(() => {
  const PANEL_ID = 'bb-parent-telegram-social-panel';
  const ANCHOR_ID = 'bb-parent-telegram-social-anchor';
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
        position: relative;
        z-index: 1;
        margin: 0;
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 28px;
        background: linear-gradient(135deg, rgba(24, 24, 27, 0.72), rgba(9, 9, 11, 0.9));
        color: #ffffff;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
        overflow: hidden;
        isolation: isolate;
      }
      .bb-parent-connect-anchor {
        display: block;
        min-width: 0;
      }
      .bb-parent-connect-anchor:empty {
        display: none;
      }
      .bb-parent-connect-panel::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 16% 0%, rgba(220, 38, 38, 0.16), transparent 34%),
          radial-gradient(circle at 100% 100%, rgba(59, 130, 246, 0.12), transparent 28%);
        opacity: 0.9;
      }
      .bb-parent-connect-inner {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.85fr);
        gap: 0;
      }
      .bb-parent-connect-section {
        padding: 24px;
      }
      .bb-parent-connect-section + .bb-parent-connect-section {
        border-left: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.025);
      }
      .bb-parent-connect-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        color: #a1a1aa;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.18em;
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
        margin: 0 0 8px;
        color: #ffffff;
        font-size: 24px;
        font-weight: 900;
        letter-spacing: -0.03em;
        line-height: 1.05;
      }
      .bb-parent-connect-text {
        margin: 0 0 18px;
        max-width: 680px;
        color: #a1a1aa;
        font-size: 14px;
        line-height: 1.5;
      }
      .bb-parent-connect-social-note {
        margin: -4px 0 16px;
        color: #fecaca;
        font-size: 13px;
        font-weight: 900;
        line-height: 1.35;
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
        border: 1px solid rgba(220, 38, 38, 0.82);
        border-radius: 14px;
        padding: 11px 16px;
        background: #dc2626;
        color: #ffffff;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.04em;
        line-height: 1.2;
        text-decoration: none;
        cursor: pointer;
        transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease;
      }
      .bb-parent-connect-button:hover,
      .bb-parent-connect-button:focus-visible {
        border-color: #ef4444;
        background: #ef4444;
        color: #ffffff;
        transform: translateY(-1px);
      }
      .bb-parent-connect-button.secondary {
        border-color: rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: #ffffff;
      }
      .bb-parent-connect-button.secondary:hover,
      .bb-parent-connect-button.secondary:focus-visible {
        border-color: rgba(220, 38, 38, 0.55);
        background: rgba(220, 38, 38, 0.12);
        color: #ffffff;
      }
      @media (max-width: 760px) {
        .bb-parent-connect-panel {
          border-radius: 22px;
        }
        .bb-parent-connect-inner {
          grid-template-columns: 1fr;
        }
        .bb-parent-connect-section + .bb-parent-connect-section {
          border-left: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
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
    const popup = window.open('', '_blank');
    if (popup) {
      popup.opener = null;
      popup.document.write('<title>Telegram</title><p style="font-family: system-ui, sans-serif; padding: 24px;">Відкриваємо Telegram...</p>');
    }

    const info = await fetchTelegram(true);
    if (info?.connectUrl) {
      if (popup) popup.location.href = info.connectUrl;
      else window.location.href = info.connectUrl;
      renderPanel();
      return;
    }

    if (popup) popup.close();
  }

  function shouldInterceptTelegramClick(target) {
    if (!isParentPage() || !(target instanceof Element)) return null;
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
    const anchor = document.getElementById(ANCHOR_ID);
    if (anchor) return anchor;

    document.getElementById(PANEL_ID)?.remove();
    return null;
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
          <h2 class="bb-parent-connect-title">BLACK BEAR DOJO в соцмережах</h2>
          <p class="bb-parent-connect-text">Там публікуємо фото, відео, новини клубу, змагання, атестації та важливі оголошення.</p>
          <p class="bb-parent-connect-social-note">Підписуйтесь, щоб бачити життя клубу першими.</p>
          <div class="bb-parent-connect-actions" aria-label="Соцмережі BLACK BEAR DOJO">
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
    }
    if (panel.parentElement !== mount) mount.appendChild(panel);

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
