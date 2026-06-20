(() => {
  const TOPICS = {
    parents: {
      title: 'Батькам',
      lead: 'Портал допомагає бачити реальний прогрес без зайвих питань у чаті.',
      items: [
        'Дивіться відвідування, оплату, домашні завдання, пояс і бали в одному місці.',
        'Підтримуйте регулярність: стабільні тренування дають більше, ніж ривки перед атестацією.',
        'Якщо дитина пропускає заняття або є питання, краще написати тренеру прямо з кабінету.'
      ]
    },
    competitions: {
      title: 'Змагання',
      lead: 'Старт має сенс тоді, коли тренер бачить готовність техніки, дисципліни й психіки.',
      items: [
        'Перші змагання - це досвід, а не тільки медаль.',
        'Перед стартом важливі сон, форма, екіпірування, вага і спокійна підтримка вдома.',
        'Після змагань дивимось не лише результат, а що стало сильніше і що треба доробити.'
      ]
    },
    rules: {
      title: 'Правила',
      lead: 'Повага, чиста форма, пунктуальність і безпечна робота в парі.',
      items: [
        'Приходьте за 10-15 хвилин до тренування.',
        'Прикраси знімаємо, нігті короткі, про травми попереджаємо тренера.',
        'На татамі слухаємо команду тренера і не працюємо силою без дозволу.'
      ]
    },
    belts: {
      title: 'Пояси',
      lead: 'Пояс - це не подарунок, а підтвердження техніки, дисципліни і готовності.',
      items: [
        'Готовність у кабінеті показує напрямок, але рішення про атестацію приймає тренер.',
        'Домашні завдання і методичка допомагають швидше закріпити базу.',
        'Якщо відсоток готовності низький, це не проблема, а карта роботи.'
      ]
    }
  };

  const state = { timer: 0, activeTopic: 'parents', mounted: false, lastText: '' };
  const parentPage = () => location.pathname === '/parent' || location.pathname.startsWith('/parent/');
  const hasToken = () => Boolean(localStorage.getItem('parent_token'));
  const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const lines = (value) => String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const num = (value) => {
    const match = String(value || '').replace(/\s/g, '').match(/-?\d+/);
    return match ? Number(match[0]) : 0;
  };
  const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));

  function addCss() {
    if (document.getElementById('bb-athlete-upgrades-style')) return;
    const style = document.createElement('style');
    style.id = 'bb-athlete-upgrades-style';
    style.textContent = `
      .bb-athlete-lite,.bb-athlete-lite *{box-sizing:border-box}.bb-athlete-lite{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:28px;background:linear-gradient(135deg,rgba(18,18,21,.92),rgba(3,3,3,.96));box-shadow:0 18px 54px rgba(0,0,0,.32);padding:18px;animation:bbLiteIn .28s ease both}.bb-athlete-lite:before{content:'';position:absolute;inset:0;background:linear-gradient(110deg,rgba(239,68,68,.13),transparent 34%,rgba(255,255,255,.035));pointer-events:none}.bb-lite-grid{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(260px,.9fr);gap:14px}.bb-lite-main{width:100%;min-width:0;border:0;border-radius:22px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);padding:16px;color:white;text-align:left;display:flex;align-items:center;gap:14px;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.bb-lite-main:hover{transform:translateY(-2px);border-color:rgba(239,68,68,.28);background:rgba(255,255,255,.055)}.bb-lite-avatar{width:54px;height:54px;border-radius:18px;background:#dc2626;display:grid;place-items:center;font-size:22px;font-weight:950;box-shadow:0 12px 32px rgba(220,38,38,.28);flex:0 0 auto}.bb-lite-eyebrow{font-size:9px;font-weight:950;letter-spacing:.22em;text-transform:uppercase;color:#ef4444}.bb-lite-name{margin-top:5px;font-size:22px;line-height:1.02;font-weight:950;text-transform:uppercase;letter-spacing:-.02em;color:#fff}.bb-lite-meta{margin-top:6px;font-size:12px;line-height:1.45;font-weight:700;color:#8b8b93}.bb-lite-level{margin-left:auto;border-radius:16px;border:1px solid rgba(245,158,11,.28);background:rgba(245,158,11,.1);padding:10px 12px;color:#fbbf24;font-size:10px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}.bb-lite-side{border-radius:22px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.06);padding:16px}.bb-lite-row{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}.bb-lite-title{font-size:10px;font-weight:950;letter-spacing:.2em;text-transform:uppercase;color:#a1a1aa}.bb-lite-score{font-size:22px;font-weight:950;color:#fff}.bb-lite-meter{height:10px;border-radius:999px;background:rgba(255,255,255,.06);padding:2px;overflow:hidden}.bb-lite-meter span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#dc2626,#f59e0b);box-shadow:0 0 22px rgba(220,38,38,.35);transition:width .42s ease}.bb-lite-badges{position:relative;z-index:1;display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.bb-lite-chip{min-height:34px;display:inline-flex;align-items:center;gap:8px;border-radius:999px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.04);padding:0 12px;color:#d4d4d8;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;transition:transform .18s ease,border-color .18s ease}.bb-lite-chip:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.16)}.bb-lite-chip.locked{opacity:.45}.bb-lite-dot{width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 14px rgba(239,68,68,.5)}.bb-lite-chip.done .bb-lite-dot{background:#22c55e;box-shadow:0 0 14px rgba(34,197,94,.5)}.bb-lite-actions{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.bb-lite-action{border:0;border-radius:15px;min-height:42px;padding:0 14px;background:#dc2626;color:#fff;cursor:pointer;font-size:10px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;transition:transform .18s ease,background .18s ease}.bb-lite-action:hover{transform:translateY(-2px);background:#ef4444}.bb-lite-action.ghost{background:rgba(255,255,255,.055);color:#e4e4e7;border:1px solid rgba(255,255,255,.08)}.bb-lite-action.ghost:hover{background:rgba(255,255,255,.09)}.bb-kb-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(12px)}.bb-kb-modal{width:min(780px,100%);max-height:min(700px,calc(100vh - 40px));overflow:auto;border:1px solid rgba(255,255,255,.1);border-radius:28px;background:#09090b;box-shadow:0 28px 90px rgba(0,0,0,.68);padding:22px}.bb-kb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.bb-kb-kicker{font-size:9px;font-weight:950;letter-spacing:.24em;text-transform:uppercase;color:#ef4444}.bb-kb-title{margin-top:6px;font-size:34px;line-height:.95;font-weight:950;text-transform:uppercase;letter-spacing:-.03em;color:#fff}.bb-kb-close{width:42px;height:42px;border-radius:15px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:#fff;font-size:22px;cursor:pointer}.bb-kb-tabs{display:flex;gap:8px;overflow-x:auto;margin:18px 0 14px;padding-bottom:4px}.bb-kb-tab{border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(255,255,255,.04);color:#a1a1aa;padding:10px 12px;cursor:pointer;white-space:nowrap;font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.1em}.bb-kb-tab.active{background:#dc2626;border-color:#dc2626;color:#fff}.bb-kb-lead{margin:0 0 14px;color:#d4d4d8;font-size:15px;font-weight:650;line-height:1.6}.bb-kb-list{display:grid;gap:9px}.bb-kb-list div{border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(255,255,255,.035);padding:13px;color:#a1a1aa;font-size:13px;line-height:1.5;font-weight:650}@keyframes bbLiteIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@media(max-width:900px){.bb-lite-grid{grid-template-columns:1fr}.bb-lite-level{margin-left:0}}@media(max-width:560px){.bb-athlete-lite{border-radius:22px;padding:14px}.bb-lite-main{align-items:flex-start;flex-wrap:wrap}.bb-lite-avatar{width:48px;height:48px;border-radius:16px}.bb-lite-name{font-size:19px}.bb-lite-actions{display:grid;grid-template-columns:1fr 1fr}.bb-lite-action{width:100%;padding:0 10px}.bb-kb-title{font-size:28px}}@media(prefers-reduced-motion:reduce){.bb-athlete-lite,.bb-lite-main,.bb-lite-chip,.bb-lite-action,.bb-lite-meter span{animation:none;transition:none}}
    `;
    document.head.appendChild(style);
  }

  function findStatsGrid() {
    return Array.from(document.querySelectorAll('div.grid')).find((element) => {
      const text = norm(element.innerText || element.textContent);
      return element.querySelectorAll('button').length >= 4 && ['відвідуваність', 'досягнення', 'оплата', 'telegram'].every((label) => text.includes(label));
    });
  }

  function findActionSection() {
    return Array.from(document.querySelectorAll('section')).find((element) => {
      const text = norm(element.innerText || element.textContent);
      return text.includes('домашні завдання') && text.includes('методичка');
    });
  }

  function overviewRoot() {
    return Array.from(document.querySelectorAll('main .bb-motion-page > div, main div.space-y-10')).find((element) => {
      const text = norm(element.innerText || element.textContent);
      return text.includes('дашборд') && text.includes('домашні завдання') && text.includes('методичка');
    });
  }

  function childRoot() {
    const main = document.querySelector('main.pt-28');
    if (!main || !norm(document.body.innerText).includes('режим спортсмена')) return null;
    return main;
  }

  function keepStatsTop(root) {
    const stats = findStatsGrid();
    const action = findActionSection();
    if (!stats || !action || stats.parentElement !== root) return stats;
    const statsBeforeAction = Boolean(stats.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!statsBeforeAction) root.insertBefore(stats, action);
    return stats;
  }

  function visibleNumbers() {
    const text = document.body.innerText || '';
    const attendanceButton = Array.from(document.querySelectorAll('button')).find((button) => norm(button.innerText).includes('відвідуваність'));
    const achievementButton = Array.from(document.querySelectorAll('button')).find((button) => norm(button.innerText).includes('досягнення'));
    const paymentButton = Array.from(document.querySelectorAll('button')).find((button) => norm(button.innerText).includes('оплата'));
    const sidebar = Array.from(document.querySelectorAll('div')).find((element) => {
      const value = norm(element.innerText);
      return value.includes('рейтинг') && value.includes('пояс') && value.length < 260;
    });
    const percent = [...text.matchAll(/(\d{1,3})%/g)].map((match) => clamp(match[1])).sort((a, b) => b - a)[0] || 0;
    return {
      attendance: num(attendanceButton?.innerText),
      achievements: num(achievementButton?.innerText),
      paymentOk: paymentButton ? /ок|оплачено|paid/i.test(paymentButton.innerText) : false,
      rating: num(sidebar?.innerText),
      readiness: percent
    };
  }

  function profileInfo() {
    const storedName = localStorage.getItem('parent_name') || '';
    const sidebar = Array.from(document.querySelectorAll('div')).find((element) => {
      const value = norm(element.innerText);
      return value.includes('рейтинг') && value.includes('пояс') && value.length < 260;
    });
    const sidebarLines = lines(sidebar?.innerText);
    const nameLine = sidebarLines.find((line) => !/рейтинг|пояс|група|\d+/.test(norm(line))) || storedName || 'Спортсмен';
    const beltIndex = sidebarLines.findIndex((line) => norm(line).includes('пояс'));
    const belt = beltIndex >= 0 ? sidebarLines[beltIndex + 1] || '' : '';
    const group = sidebarLines.find((line) => norm(line).includes('група')) || '';
    return { name: nameLine, belt: belt || 'пояс у профілі', group: group || 'група у профілі' };
  }

  function levelFor(values) {
    const score = values.rating + values.attendance * 3 + values.achievements * 12 + values.readiness;
    if (values.readiness >= 85) return { name: 'Атестація близько', progress: values.readiness };
    if (score >= 180) return { name: 'Сильний темп', progress: 82 };
    if (score >= 90) return { name: 'Стабільний рівень', progress: 62 };
    if (values.attendance > 0 || values.rating > 0) return { name: 'Впевнений старт', progress: 36 };
    return { name: 'Новий старт', progress: 14 };
  }

  function badges(values) {
    return [
      { label: 'Старт', done: values.attendance > 0 || values.rating > 0 },
      { label: 'Стабільність', done: values.attendance >= 8 },
      { label: 'Домашка', done: norm(document.body.innerText).includes('активні') || norm(document.body.innerText).includes('дз +') },
      { label: 'Техніка', done: values.readiness >= 50 },
      { label: 'Рейтинг', done: values.rating > 0 || values.achievements > 0 },
      { label: 'Пояс', done: values.readiness >= 80 }
    ];
  }

  function panelHtml(variant) {
    const info = profileInfo();
    const values = visibleNumbers();
    const level = levelFor(values);
    const meta = [info.group, info.belt].filter(Boolean).join(' • ');
    return `<section class="bb-athlete-lite" data-bb-athlete-lite="${variant}">
      <div class="bb-lite-grid">
        <button type="button" class="bb-lite-main" data-bb-jump-tab="progress" aria-label="Відкрити прогрес спортсмена">
          <div class="bb-lite-avatar">${esc(info.name.charAt(0) || 'B')}</div>
          <div class="min-w-0">
            <div class="bb-lite-eyebrow">Профіль спортсмена</div>
            <div class="bb-lite-name">${esc(info.name)}</div>
            <div class="bb-lite-meta">${esc(meta || 'рівень, пояс і прогрес')}</div>
          </div>
          <div class="bb-lite-level">${esc(level.name)}</div>
        </button>
        <div class="bb-lite-side">
          <div class="bb-lite-row"><div class="bb-lite-title">Готовність / рівень</div><div class="bb-lite-score">${level.progress}%</div></div>
          <div class="bb-lite-meter"><span style="width:${clamp(level.progress)}%"></span></div>
        </div>
      </div>
      <div class="bb-lite-badges">${badges(values).map((badge) => `<span class="bb-lite-chip ${badge.done ? 'done' : 'locked'}"><i class="bb-lite-dot"></i>${esc(badge.label)}</span>`).join('')}</div>
      <div class="bb-lite-actions">
        <button type="button" class="bb-lite-action" data-bb-jump-tab="homework">Домашні</button>
        <button type="button" class="bb-lite-action ghost" data-bb-jump-tab="manual">Методичка</button>
        <button type="button" class="bb-lite-action ghost" data-bb-jump-tab="progress">Прогрес</button>
        <button type="button" class="bb-lite-action ghost" data-bb-open-kb="parents">База знань</button>
      </div>
    </section>`;
  }

  function mountOverview() {
    const root = overviewRoot();
    if (!root) return false;
    const stats = keepStatsTop(root);
    const existing = root.querySelector('[data-bb-athlete-lite="overview"]');
    const html = panelHtml('overview');
    if (existing) {
      if (state.lastText !== document.body.innerText) existing.outerHTML = html;
      return true;
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    if (stats && stats.parentElement === root) stats.insertAdjacentElement('afterend', wrap.firstElementChild);
    else root.insertBefore(wrap.firstElementChild, root.firstElementChild?.nextSibling || null);
    return true;
  }

  function mountChild() {
    const root = childRoot();
    if (!root) return false;
    const existing = root.querySelector('[data-bb-athlete-lite="child"]');
    const html = panelHtml('child');
    if (existing) return true;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const firstSection = root.querySelector('section');
    if (firstSection) firstSection.insertAdjacentElement('afterend', wrap.firstElementChild);
    else root.prepend(wrap.firstElementChild);
    return true;
  }

  function render() {
    if (!parentPage() || !hasToken()) return;
    const text = document.body.innerText || '';
    if (!text.includes('Дашборд') && !text.includes('Режим спортсмена')) return;
    addCss();
    const didMount = mountOverview() || mountChild();
    if (didMount) {
      state.mounted = true;
      state.lastText = text;
    }
  }

  function schedule() {
    if (!parentPage() || !hasToken()) return;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(render, { timeout: 900 });
      else requestAnimationFrame(render);
    }, 260);
  }

  function openKnowledge(topicId = state.activeTopic) {
    addCss();
    const topic = TOPICS[topicId] || TOPICS.parents;
    state.activeTopic = topicId in TOPICS ? topicId : 'parents';
    let overlay = document.querySelector('.bb-kb-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'bb-kb-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="bb-kb-modal" role="dialog" aria-modal="true" aria-label="База знань Black Bear Dojo">
      <div class="bb-kb-head"><div><div class="bb-kb-kicker">База знань</div><div class="bb-kb-title">${esc(topic.title)}</div></div><button type="button" class="bb-kb-close" data-bb-close-kb aria-label="Закрити">×</button></div>
      <div class="bb-kb-tabs">${Object.entries(TOPICS).map(([id, item]) => `<button type="button" class="bb-kb-tab ${item === topic ? 'active' : ''}" data-bb-topic="${id}">${esc(item.title)}</button>`).join('')}</div>
      <p class="bb-kb-lead">${esc(topic.lead)}</p>
      <div class="bb-kb-list">${topic.items.map((item) => `<div>${esc(item)}</div>`).join('')}</div>
    </div>`;
  }

  document.addEventListener('click', (event) => {
    const kb = event.target.closest('[data-bb-open-kb]');
    if (kb) {
      event.preventDefault();
      openKnowledge(kb.getAttribute('data-bb-open-kb'));
      return;
    }
    const topic = event.target.closest('[data-bb-topic]');
    if (topic) {
      event.preventDefault();
      openKnowledge(topic.getAttribute('data-bb-topic'));
      return;
    }
    if (event.target.closest('[data-bb-close-kb]') || event.target.classList?.contains('bb-kb-overlay')) {
      event.preventDefault();
      document.querySelector('.bb-kb-overlay')?.remove();
      return;
    }
    const jump = event.target.closest('[data-bb-jump-tab]');
    if (jump) {
      event.preventDefault();
      document.getElementById(`parent-nav-${jump.getAttribute('data-bb-jump-tab')}`)?.click();
    }
  }, { passive: false });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.querySelector('.bb-kb-overlay')?.remove();
  });

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener('storage', schedule);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
})();
