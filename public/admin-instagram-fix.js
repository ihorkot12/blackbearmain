(() => {
  const ADMIN_PATH_RE = /^\/admin(?:\/|$)/;
  const NOTICE_ID = 'bb-instagram-connect-notice';
  const STYLE_ID = 'bb-instagram-connect-style';
  const IG_CONNECT_URL = '/api/social/ig/connect-url?action=connect';
  const IG_MANUAL_CONNECT_URL = '/api/social/ig/manual-connect';
  const IG_API_ROUTE_MAP = {
    '/api/instagram/status': '/api/social/ig/status',
    '/api/instagram/sync': '/api/social/ig/sync',
    '/api/instagram/accounts': '/api/social/ig/accounts',
    '/api/instagram/select-account': '/api/social/ig/select-account',
    '/api/instagram/manual-connect': '/api/social/ig/manual-connect'
  };

  const isAdminPath = () => ADMIN_PATH_RE.test(window.location.pathname);
  const isCoach = () => window.localStorage.getItem('admin_role') === 'coach';
  const authToken = () => window.localStorage.getItem('admin_token') || '';
  const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  const rewriteIgApiUrl = (value) => {
    const raw = String(value || '');
    if (!raw) return value;

    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return value;
      const replacement = IG_API_ROUTE_MAP[url.pathname];
      if (!replacement) return value;
      url.pathname = replacement;
      return /^https?:\/\//i.test(raw) ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
    } catch (_) {
      return value;
    }
  };

  const installInstagramApiPathPatch = () => {
    if (window.__bbInstagramApiPathPatchInstalled) return;
    window.__bbInstagramApiPathPatchInstalled = true;

    if (typeof window.fetch === 'function') {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (typeof input === 'string' || input instanceof URL) {
          return originalFetch(rewriteIgApiUrl(input), init);
        }
        if (typeof Request === 'function' && input instanceof Request) {
          const rewritten = rewriteIgApiUrl(input.url);
          if (rewritten !== input.url) return originalFetch(new Request(rewritten, input), init);
        }
        return originalFetch(input, init);
      };
    }

    if (typeof window.XMLHttpRequest === 'function') {
      const originalOpen = window.XMLHttpRequest.prototype.open;
      window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        return originalOpen.call(this, method, rewriteIgApiUrl(url), ...rest);
      };
    }
  };

  installInstagramApiPathPatch();

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${NOTICE_ID} {
        position: fixed;
        z-index: 2147483647;
        top: 18px;
        right: 18px;
        width: min(440px, calc(100vw - 36px));
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 18px;
        background: rgba(10,10,12,.96);
        color: #fff;
        box-shadow: 0 24px 70px rgba(0,0,0,.45);
        padding: 14px 16px;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transform: translateY(-10px);
        opacity: 0;
        pointer-events: none;
        transition: opacity .18s ease, transform .18s ease;
      }
      #${NOTICE_ID}.is-visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      #${NOTICE_ID} strong {
        display: block;
        margin-bottom: 5px;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .14em;
        text-transform: uppercase;
      }
      #${NOTICE_ID} p {
        margin: 0;
        color: #d4d4d8;
        font-size: 13px;
        line-height: 1.45;
      }
      #${NOTICE_ID}.is-error { border-color: rgba(239,68,68,.48); }
      #${NOTICE_ID}.is-error strong { color: #fb7185; }
      #${NOTICE_ID}.is-success { border-color: rgba(34,197,94,.45); }
      #${NOTICE_ID}.is-success strong { color: #4ade80; }
      #${NOTICE_ID}.is-info { border-color: rgba(59,130,246,.45); }
      #${NOTICE_ID} button,
      .bb-ig-config-note button {
        margin-top: 12px;
        min-height: 38px;
        border: 0;
        border-radius: 12px;
        background: linear-gradient(90deg, #9333ea, #db2777);
        color: #fff;
        padding: 0 14px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .12em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .bb-ig-config-note {
        margin-top: 12px;
        border-radius: 16px;
        border: 1px solid rgba(239,68,68,.22);
        background: rgba(239,68,68,.08);
        color: #fecdd3;
        padding: 10px 12px;
        font-size: 12px;
        line-height: 1.45;
      }
    `;
    document.head.appendChild(style);
  };

  const showNotice = (message, type = 'info', manualAction = false) => {
    addStyles();
    let notice = document.getElementById(NOTICE_ID);
    if (!notice) {
      notice = document.createElement('div');
      notice.id = NOTICE_ID;
      document.body.appendChild(notice);
    }

    const title = type === 'error'
      ? 'Instagram не підключено'
      : type === 'success'
        ? 'Instagram'
        : 'Перевірка Instagram';

    notice.className = `is-visible is-${type}`;
    notice.innerHTML = `
      <strong>${title}</strong>
      <p>${escapeHtml(message)}</p>
      ${manualAction ? '<button type="button" data-bb-ig-token-connect>Вставити токен вручну</button>' : ''}
    `;

    window.clearTimeout(showNotice.timer);
    if (!manualAction) {
      showNotice.timer = window.setTimeout(() => {
        notice.classList.remove('is-visible');
      }, type === 'error' ? 9000 : 4500);
    }
  };

  const parseResponse = async (response) => {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (_) {
      return { raw: text };
    }
  };

  const humanInstagramError = (message, status) => {
    const raw = String(message || '').trim();
    if (/client id not configured/i.test(raw)) {
      return 'На сервері не задано INSTAGRAM_CLIENT_ID. Додай його у Vercel або підключи Instagram через long-lived token вручну.';
    }
    if (/client secret/i.test(raw)) {
      return 'На сервері не задано INSTAGRAM_CLIENT_SECRET. Без нього Instagram OAuth не зможе завершити підключення.';
    }
    if (/please login/i.test(raw) || /unauthorized/i.test(raw)) {
      return 'Сесія адміна не активна. Вийди та зайди в адмінку ще раз, потім натисни підключення Instagram.';
    }
    if (status >= 500) {
      return raw || 'Сервер Instagram-підключення повернув помилку. Перевір env-поля Meta/Instagram у Vercel.';
    }
    return raw || 'Сервер не повернув посилання Instagram. Потрібні INSTAGRAM_CLIENT_ID і INSTAGRAM_CLIENT_SECRET.';
  };

  const authHeaders = () => {
    const headers = {};
    const token = authToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const getConnectUrl = async () => {
    const response = await fetch(IG_CONNECT_URL, {
      headers: authHeaders(),
      cache: 'no-store'
    });
    const data = await parseResponse(response);

    if (!response.ok) {
      throw new Error(humanInstagramError(data?.error || data?.message || data?.raw, response.status));
    }

    if (!data?.url || !/^https?:\/\//i.test(String(data.url))) {
      throw new Error(humanInstagramError(data?.error || data?.message || data?.raw, response.status));
    }

    return data.url;
  };

  const isManualTokenHelpful = (message) => /INSTAGRAM_CLIENT_ID|long-lived token|не повернув посилання/i.test(String(message || ''));

  const showConfigNote = (message, manualAction = false) => {
    document.querySelectorAll('.bb-admin-instagram-card').forEach((card) => {
      let note = card.querySelector('.bb-ig-config-note');
      if (!note) {
        note = document.createElement('div');
        note.className = 'bb-ig-config-note';
        card.appendChild(note);
      }
      note.innerHTML = `${escapeHtml(message)}${manualAction ? '<br><button type="button" data-bb-ig-token-connect>Вставити токен вручну</button>' : ''}`;
    });
  };

  const openInstagramPopup = (url) => {
    const width = 600;
    const height = 720;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    return window.open(
      url,
      'InstagramLogin',
      `width=${width},height=${height},left=${left},top=${top},noopener=false,noreferrer=false`
    );
  };

  const connectWithManualToken = async () => {
    const rawToken = window.prompt('Встав long-lived Facebook/Instagram access token. Він буде збережений тільки на сервері.');
    const accessToken = String(rawToken || '').replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) return;
    if (accessToken.length < 30) {
      showNotice('Токен занадто короткий. Потрібен long-lived access token з Meta.', 'error', true);
      return;
    }

    try {
      showNotice('Перевіряю токен і шукаю Instagram Business акаунт...', 'info');
      const response = await fetch(IG_MANUAL_CONNECT_URL, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accessToken })
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data?.error || 'Не вдалося підключити Instagram по токену');

      showNotice(`Підключено акаунт ${data?.account?.username || 'Instagram'}. Оновлюю адмінку...`, 'success');
      window.setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      const message = error?.message || 'Не вдалося підключити Instagram по токену.';
      showNotice(message, 'error', true);
      showConfigNote(message, true);
      console.warn('[Black Bear] Manual Instagram connect failed:', message);
    }
  };

  const connectInstagram = async (button) => {
    if (button?.dataset.bbIgBusy === '1') return;
    if (button) button.dataset.bbIgBusy = '1';

    try {
      showNotice('Перевіряю налаштування і готую посилання авторизації...', 'info');
      const url = await getConnectUrl();
      const popup = openInstagramPopup(url);
      if (!popup) {
        throw new Error('Браузер заблокував popup. Дозволь спливаючі вікна для shin-karate.kyiv.ua і натисни ще раз.');
      }
      showNotice('Вікно Instagram відкрилось. Після авторизації дані підтягнуться в адмінку.', 'success');
    } catch (error) {
      const message = error?.message || 'Не вдалося підключити Instagram.';
      const manualAction = isManualTokenHelpful(message);
      showNotice(message, 'error', manualAction);
      showConfigNote(message, manualAction);
      console.warn('[Black Bear] Instagram connect blocked:', message);
    } finally {
      if (button) window.setTimeout(() => { button.dataset.bbIgBusy = '0'; }, 600);
    }
  };

  const shouldHandleButton = (button) => {
    if (!button || !isAdminPath() || isCoach()) return false;
    if (button.matches('[data-bb-ig-token-connect]')) return true;
    const text = norm(button.textContent);
    const label = norm(`${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`);
    const selectorMatch = button.matches('[data-bb-ig-connect]');
    const containsInstagram = text.includes('instagram') || label.includes('instagram') || selectorMatch;
    const asksConnect = text.includes('підключ') || text.includes('connect') || selectorMatch;
    return containsInstagram && asksConnect;
  };

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button,a');
    if (!shouldHandleButton(button)) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    if (button.matches('[data-bb-ig-token-connect]')) {
      connectWithManualToken();
      return;
    }

    connectInstagram(button);
  }, true);

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (event.data === 'instagram_connected' || data?.type === 'instagram_login_success') {
      showNotice('Instagram підключено. Оновлюю адмінку...', 'success');
      window.setTimeout(() => window.location.reload(), 900);
      return;
    }

    if (data?.type === 'instagram_error') {
      const message = data.message || 'Instagram не підключено. Перевір налаштування Meta App і спробуй ще раз.';
      const manualAction = isManualTokenHelpful(message);
      showNotice(message, 'error', manualAction);
      showConfigNote(message, manualAction);
    }
  });
})();
