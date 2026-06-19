(() => {
  const API_URL = '/api/parent/payments/monobank-invoice';
  const STATUS_URL = '/api/parent/payments/monobank-status';
  const installedButtons = new WeakSet();
  let stylesReady = false;
  let returnStatusChecked = false;

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
      .bb-mono-result {
        position: fixed;
        z-index: 2147483000;
        top: 18px;
        right: 18px;
        width: min(420px, calc(100vw - 36px));
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 22px;
        background: rgba(10,10,12,.94);
        color: #fff;
        box-shadow: 0 22px 70px rgba(0,0,0,.46), 0 0 0 1px rgba(239,68,68,.08) inset;
        backdrop-filter: blur(18px);
        padding: 18px 18px 16px;
        display: grid;
        grid-template-columns: 42px 1fr auto;
        gap: 14px;
        align-items: start;
        transform: translateY(-12px);
        opacity: 0;
        animation: bbMonoResultIn .28s ease forwards;
      }
      .bb-mono-result__mark {
        width: 42px;
        height: 42px;
        border-radius: 16px;
        display: grid;
        place-items: center;
        font-size: 22px;
        font-weight: 1000;
        background: rgba(239,68,68,.18);
        color: #ff2a36;
      }
      .bb-mono-result[data-kind="success"] .bb-mono-result__mark {
        background: rgba(34,197,94,.16);
        color: #22c55e;
      }
      .bb-mono-result[data-kind="pending"] .bb-mono-result__mark {
        background: rgba(37,99,235,.18);
        color: #3b82f6;
      }
      .bb-mono-result__title {
        margin: 0 0 5px;
        font-size: 17px;
        line-height: 1.15;
        font-weight: 1000;
        letter-spacing: 0;
      }
      .bb-mono-result__text {
        margin: 0;
        color: rgba(228,228,231,.76);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 700;
      }
      .bb-mono-result__close {
        border: 0;
        width: 34px;
        height: 34px;
        border-radius: 12px;
        background: rgba(255,255,255,.07);
        color: rgba(255,255,255,.78);
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
      }
      .bb-mono-result__close:hover {
        background: rgba(255,255,255,.12);
        color: #fff;
      }
      @keyframes bbMonoResultIn {
        to { transform: translateY(0); opacity: 1; }
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
        .bb-mono-result {
          top: auto;
          right: 12px;
          bottom: 12px;
          width: calc(100vw - 24px);
          grid-template-columns: 38px 1fr auto;
          border-radius: 18px;
          padding: 15px;
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

  function showResultBanner(kind, title, text) {
    ensureStyles();
    document.querySelectorAll('.bb-mono-result').forEach((node) => node.remove());

    const banner = document.createElement('section');
    banner.className = 'bb-mono-result';
    banner.dataset.kind = kind;
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');

    const mark = document.createElement('div');
    mark.className = 'bb-mono-result__mark';
    mark.textContent = kind === 'success' ? '✓' : kind === 'pending' ? '…' : '!';

    const content = document.createElement('div');
    const heading = document.createElement('h3');
    heading.className = 'bb-mono-result__title';
    heading.textContent = title;
    const description = document.createElement('p');
    description.className = 'bb-mono-result__text';
    description.textContent = text;
    content.appendChild(heading);
    content.appendChild(description);

    const close = document.createElement('button');
    close.className = 'bb-mono-result__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрити повідомлення');
    close.textContent = '×';
    close.addEventListener('click', () => banner.remove());

    banner.appendChild(mark);
    banner.appendChild(content);
    banner.appendChild(close);
    document.body.appendChild(banner);
  }

  function statusCopy(status) {
    switch (status) {
      case 'success':
        return {
          kind: 'success',
          title: 'Оплату підтверджено',
          text: 'Дякуємо, платіж зараховано в кабінеті.',
        };
      case 'hold':
        return {
          kind: 'pending',
          title: 'Кошти заблоковано',
          text: 'Monobank підтвердив hold-платіж. Остаточне списання робиться після підтвердження.',
        };
      case 'processing':
      case 'created':
        return {
          kind: 'pending',
          title: 'Оплата обробляється',
          text: 'Monobank ще підтверджує платіж. Оновіть кабінет за хвилину.',
        };
      case 'failure':
      case 'expired':
      case 'reversed':
        return {
          kind: 'error',
          title: 'Оплата не зарахована',
          text: 'Платіж не пройшов або був скасований. Спробуйте ще раз або напишіть тренеру.',
        };
      default:
        return {
          kind: 'pending',
          title: 'Статус оплати',
          text: status ? `Поточний статус Monobank: ${status}.` : 'Перевіряємо платіж у Monobank.',
        };
    }
  }

  async function checkReturnStatus() {
    if (returnStatusChecked || !isParentPage()) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'monobank') return;

    returnStatusChecked = true;
    const reference = params.get('invoice') || params.get('reference') || params.get('invoiceId');
    if (!reference) {
      showResultBanner('error', 'Не знайшли рахунок', 'Повернення з Monobank було без номера платежу. Перевірте оплату трохи пізніше.');
      return;
    }

    showResultBanner('pending', 'Перевіряємо оплату', 'Звіряємо статус платежу з Monobank.');

    try {
      const queryKey = reference.startsWith('p2_') ? 'invoiceId' : 'reference';
      const response = await fetch(`${STATUS_URL}?${queryKey}=${encodeURIComponent(reference)}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не вдалося перевірити оплату');

      const copy = statusCopy(data.status);
      showResultBanner(copy.kind, copy.title, copy.text);
    } catch (error) {
      showResultBanner(
        'error',
        'Не вдалося перевірити оплату',
        error?.message || 'Платіж міг пройти, але сайт зараз не отримав статус. Оновіть кабінет за хвилину.'
      );
    } finally {
      const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
      window.history.replaceState({}, '', cleanUrl);
    }
  }

  function install(button) {
    if (installedButtons.has(button)) return;
    installedButtons.add(button);
    ensureStyles();

    const parent = button.parentElement;
    if (!parent) return;

    parent.style.flexWrap = 'wrap';
    parent.style.gap = parent.style.gap || '24px';

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
    document.addEventListener('DOMContentLoaded', () => {
      scan();
      checkReturnStatus();
    });
  } else {
    scan();
    checkReturnStatus();
  }
})();
