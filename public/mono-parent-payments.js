(() => {
  const API_URL = '/api/parent/payments/monobank-invoice';
  const installedButtons = new WeakSet();
  let stylesReady = false;

  const normalize = (value) => String(value || '').trim().toLowerCase();

  function isParentPage() {
    return window.location.pathname === '/parent' || window.location.pathname.startsWith('/parent/');
  }

  function isPaymentButton(button) {
    const text = normalize(button.textContent);
    return (
      (text.includes('оплат') && text.includes('онлайн')) ||
      (text.includes('рћрї') && text.includes('рѕрЅ'))
    );
  }

  function ensureStyles() {
    if (stylesReady) return;
    stylesReady = true;

    const style = document.createElement('style');
    style.textContent = `
      .bb-mono-panel {
        display: grid;
        gap: 10px;
        min-width: min(100%, 280px);
      }
      .bb-mono-row {
        display: flex;
        align-items: center;
        gap: 10px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .bb-mono-amount {
        width: 140px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 16px;
        background: rgba(0,0,0,.45);
        color: #fff;
        padding: 14px 16px;
        font-size: 14px;
        font-weight: 900;
        outline: none;
      }
      .bb-mono-amount:focus {
        border-color: rgba(239,68,68,.85);
        box-shadow: 0 0 0 4px rgba(239,68,68,.16);
      }
      .bb-mono-caption {
        color: rgba(161,161,170,.95);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .12em;
        text-transform: uppercase;
        text-align: right;
      }
      .bb-mono-status {
        min-height: 16px;
        color: #ef4444;
        font-size: 11px;
        font-weight: 800;
        text-align: right;
      }
      .bb-mono-status[data-ok="true"] {
        color: #22c55e;
      }
      @media (max-width: 720px) {
        .bb-mono-row {
          justify-content: stretch;
        }
        .bb-mono-panel,
        .bb-mono-amount,
        .bb-mono-row button {
          width: 100%;
        }
        .bb-mono-caption,
        .bb-mono-status {
          text-align: left;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getAuthHeaders() {
    const token = window.localStorage.getItem('parent_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function lockButton(button, locked) {
    button.disabled = locked;
    button.style.opacity = locked ? '.72' : '';
    button.style.cursor = locked ? 'wait' : '';
  }

  function install(button) {
    if (installedButtons.has(button)) return;
    installedButtons.add(button);
    ensureStyles();

    const parent = button.parentElement;
    if (!parent) return;

    const panel = document.createElement('div');
    panel.className = 'bb-mono-panel';

    const caption = document.createElement('div');
    caption.className = 'bb-mono-caption';
    caption.textContent = 'Сума оплати, грн';

    const row = document.createElement('div');
    row.className = 'bb-mono-row';

    const amountInput = document.createElement('input');
    amountInput.className = 'bb-mono-amount';
    amountInput.type = 'number';
    amountInput.min = '1';
    amountInput.max = '100000';
    amountInput.step = '10';
    amountInput.inputMode = 'decimal';
    amountInput.value = window.localStorage.getItem('bb_mono_last_amount') || '1000';
    amountInput.setAttribute('aria-label', 'Сума оплати в гривнях');

    const status = document.createElement('div');
    status.className = 'bb-mono-status';

    button.textContent = 'Оплатити через monobank';
    button.type = 'button';

    row.appendChild(amountInput);
    row.appendChild(button);
    panel.appendChild(caption);
    panel.appendChild(row);
    panel.appendChild(status);
    parent.appendChild(panel);

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const amount = Number(String(amountInput.value || '').replace(',', '.'));
      if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
        status.dataset.ok = 'false';
        status.textContent = 'Вкажіть суму від 1 до 100000 грн';
        amountInput.focus();
        return;
      }

      window.localStorage.setItem('bb_mono_last_amount', String(amount));
      status.dataset.ok = 'true';
      status.textContent = 'Створюємо рахунок monobank...';
      lockButton(button, true);

      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ amount }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.pageUrl) {
          throw new Error(data.error || 'Не вдалося створити рахунок');
        }

        status.dataset.ok = 'true';
        status.textContent = 'Переходимо до оплати...';
        window.location.assign(data.pageUrl);
      } catch (error) {
        status.dataset.ok = 'false';
        status.textContent = error?.message || 'Оплата тимчасово недоступна';
        lockButton(button, false);
      }
    });
  }

  function scan() {
    if (!isParentPage()) return;
    document.querySelectorAll('button').forEach((button) => {
      if (isPaymentButton(button)) install(button);
    });
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
})();
