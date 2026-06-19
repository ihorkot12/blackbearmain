(() => {
  const SETTINGS_URL = '/api/settings';
  const SETTING_KEY = 'monobank_payments_enabled';
  const CARD_ID = 'bb-mono-admin-payment-settings';
  let currentEnabled = true;
  let isLoaded = false;
  let isSaving = false;
  let isScanning = false;
  let scanTimer = 0;
  let lastMessage = '';

  const isAdminPage = () => window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const getAdminToken = () => window.localStorage.getItem('admin_token');

  function settingIsEnabled(value) {
    return !['false', '0', 'off', 'disabled', 'hidden', 'hide', 'no'].includes(normalize(value));
  }

  function authHeaders(extra = {}) {
    const token = getAdminToken();
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  }

  async function loadSettings() {
    if (isLoaded) return currentEnabled;
    const token = getAdminToken();
    if (!token) return currentEnabled;

    try {
      const response = await fetch(SETTINGS_URL, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('settings_load_failed');
      const data = await response.json().catch(() => ({}));
      currentEnabled = data[SETTING_KEY] === undefined ? true : settingIsEnabled(data[SETTING_KEY]);
      isLoaded = true;
    } catch {
      lastMessage = 'Не вдалося завантажити статус оплати';
    }

    return currentEnabled;
  }

  async function saveSetting(nextEnabled) {
    if (isSaving) return;
    const token = getAdminToken();
    if (!token) {
      lastMessage = 'Потрібно увійти в адмінку';
      render(true);
      return;
    }

    isSaving = true;
    lastMessage = 'Зберігаю...';
    render(true);

    try {
      const response = await fetch(SETTINGS_URL, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ [SETTING_KEY]: nextEnabled ? 'true' : 'false' }),
      });
      if (!response.ok) throw new Error('settings_save_failed');
      currentEnabled = nextEnabled;
      isLoaded = true;
      lastMessage = nextEnabled
        ? 'Кнопка оплати показується в кабінетах'
        : 'Кнопка оплати схована в кабінетах';
    } catch {
      lastMessage = 'Не вдалося зберегти налаштування';
    } finally {
      isSaving = false;
      render(true);
    }
  }

  function findSettingsGrid() {
    const heading = Array.from(document.querySelectorAll('h2'))
      .find((node) => normalize(node.textContent).includes('налаштування системи'));
    if (!heading) return null;

    const root = heading.parentElement?.parentElement;
    if (!root) return null;

    const directGrid = Array.from(root.children)
      .find((node) => node instanceof HTMLElement && node.className.includes('grid'));
    if (directGrid) return directGrid;

    return root;
  }

  function cardHtml() {
    const enabled = currentEnabled;
    const knobX = enabled ? 'translateX(28px)' : 'translateX(4px)';
    const switchBg = enabled ? '#dc2626' : '#3f3f46';
    const statusBg = enabled ? 'rgba(34,197,94,.12)' : 'rgba(244,63,94,.12)';
    const statusColor = enabled ? '#22c55e' : '#fb7185';
    const statusText = enabled ? 'Кнопка активна' : 'Кнопка схована';
    const helperText = enabled
      ? 'Батьки, діти та дорослі учасники бачать кнопку оплати Monobank у розділі оплати.'
      : 'Кнопка не показується в кабінетах, а пряме створення рахунку заблоковане сервером.';

    return `
      <div class="flex items-start justify-between gap-5 mb-6">
        <div>
          <div class="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 mb-2">Monobank</div>
          <h3 class="text-xl font-black uppercase tracking-tight flex items-center gap-3">
            <span class="w-9 h-9 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center font-black">₴</span>
            Онлайн-оплата
          </h3>
        </div>
        <span style="background:${statusBg};color:${statusColor}" class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap">${statusText}</span>
      </div>
      <p class="text-sm text-zinc-500 leading-relaxed mb-6">${helperText}</p>
      <button
        type="button"
        id="bb-mono-admin-toggle"
        role="switch"
        aria-checked="${enabled ? 'true' : 'false'}"
        class="w-full flex items-center justify-between gap-4 p-4 bg-black/25 rounded-2xl border border-white/5 text-left hover:bg-black/35 transition-all disabled:opacity-60"
        ${isSaving ? 'disabled' : ''}
      >
        <span>
          <span class="block text-sm font-black text-white uppercase tracking-tight">Показувати кнопку оплати</span>
          <span class="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Для батьківського і дорослого кабінету</span>
        </span>
        <span style="width:56px;height:28px;border-radius:999px;background:${switchBg};position:relative;display:inline-flex;align-items:center;transition:background .2s ease;flex-shrink:0">
          <span style="width:20px;height:20px;border-radius:999px;background:#fff;position:absolute;left:0;transform:${knobX};transition:transform .22s ease;box-shadow:0 8px 20px rgba(0,0,0,.35)"></span>
        </span>
      </button>
      <div class="mt-4 min-h-[18px] text-[10px] font-black uppercase tracking-widest ${lastMessage.includes('Не вдалося') ? 'text-red-500' : 'text-zinc-500'}">${lastMessage || ''}</div>
    `;
  }

  function render(force = false) {
    if (!isAdminPage()) return;
    const grid = findSettingsGrid();
    if (!grid) return;

    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'bg-zinc-900 border border-white/5 rounded-[2.5rem] p-8';
      grid.appendChild(card);
      force = true;
    }

    const renderKey = `${currentEnabled}|${isSaving}|${lastMessage}`;
    if (!force && card.dataset.renderKey === renderKey) return;

    card.dataset.renderKey = renderKey;
    card.innerHTML = cardHtml();
    const toggle = card.querySelector('#bb-mono-admin-toggle');
    if (toggle) toggle.onclick = () => saveSetting(!currentEnabled);
  }

  async function scan() {
    window.clearTimeout(scanTimer);
    scanTimer = 0;
    if (isScanning || !isAdminPage()) return;
    if (!findSettingsGrid()) return;

    isScanning = true;
    try {
      await loadSettings();
      render(false);
    } finally {
      isScanning = false;
    }
  }

  function scheduleScan() {
    if (!isAdminPage() || scanTimer) return;
    scanTimer = window.setTimeout(scan, 120);
  }

  const observer = new MutationObserver((mutations) => {
    const onlyWidgetChanged = mutations.every((mutation) => {
      const target = mutation.target;
      const targetInsideWidget = target instanceof HTMLElement && Boolean(target.closest(`#${CARD_ID}`));
      const addedWidget = Array.from(mutation.addedNodes).some((node) => node instanceof HTMLElement && node.id === CARD_ID);
      return targetInsideWidget || addedWidget;
    });

    if (!onlyWidgetChanged) scheduleScan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleScan);
  } else {
    scheduleScan();
  }
})();
