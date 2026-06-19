(() => {
  const TOPICS = [
    {
      id: 'parents',
      title: 'Батькам',
      eyebrow: 'як допомогти дитині',
      lead: 'Головна задача батьків - не тиснути, а допомогти дитині тримати стабільний ритм тренувань.',
      items: [
        'Регулярність важливіша за рідкісні сильні ривки. Краще стабільно ходити 2-3 рази на тиждень.',
        'Не порівнюйте дитину з іншими. Дивіться на її власний прогрес: відвідування, дисципліна, техніка, сміливість.',
        'Якщо дитина пропускає тренування, краще коротко написати тренеру причину в кабінеті.',
        'Домашні завдання потрібні не для навантаження, а щоб техніка не забувалась між заняттями.'
      ]
    },
    {
      id: 'rules',
      title: 'Правила клубу',
      eyebrow: 'порядок і безпека',
      lead: 'Правила прості: повага, дисципліна, чиста форма, пунктуальність і безпечна робота в парі.',
      items: [
        'Приходити за 10-15 хвилин до тренування, щоб спокійно переодягнутись і налаштуватись.',
        'Форма має бути чистою, нігті короткі, прикраси зняті. Це питання безпеки.',
        'На татамі слухаємо тренера, не перебиваємо і не працюємо силою без команди.',
        'Про травми, погане самопочуття або обмеження краще попереджати тренера до заняття.'
      ]
    },
    {
      id: 'competitions',
      title: 'Змагання',
      eyebrow: 'коли і навіщо',
      lead: 'Змагання - це не тільки медалі. Це досвід, характер, контроль емоцій і розуміння власного рівня.',
      items: [
        'Починати варто тоді, коли тренер бачить технічну і психологічну готовність учня.',
        'Перші старти можуть бути навчальними. Головне - вийти, почути тренера і зробити свою роботу.',
        'Перед змаганнями важливі регулярність, екіпірування, вага, сон і спокійна підтримка вдома.',
        'Після старту аналізуємо не лише результат, а що вийшло краще і що треба підтягнути.'
      ]
    },
    {
      id: 'start',
      title: 'Коли починати',
      eyebrow: 'для новачків',
      lead: 'Починати можна тоді, коли дитина готова слухати тренера, працювати в групі і поступово звикати до дисципліни.',
      items: [
        'Для малих дітей перший етап - координація, увага, правила залу і базова дисципліна.',
        'Для підлітків важливі техніка, сила характеру, впевненість і контроль емоцій.',
        'Для дорослих тренування дають фізичну форму, кардіо, мобільність, самодисципліну і новий спортивний ритм.',
        'Не треба чекати “ідеальної форми”. Форма зʼявляється в процесі регулярних занять.'
      ]
    },
    {
      id: 'belts',
      title: 'Пояси',
      eyebrow: 'атестація і прогрес',
      lead: 'Пояс - це підтвердження техніки, дисципліни, відвідуваності і готовності.',
      items: [
        'До атестації важливі базова техніка, стійки, удари, захист, витривалість і поведінка в залі.',
        'Готовність у кабінеті показує напрямок, але остаточне рішення завжди за тренером.',
        'Якщо готовність ще низька, це карта: що саме треба підтягнути.',
        'Домашні завдання і методичка допомагають швидше закріплювати матеріал між тренуваннями.'
      ]
    }
  ];

  const state = { data: null, lastFetch: 0, timer: 0, fetching: false, activeTopic: 'parents' };
  const isParentPage = () => location.pathname === '/parent' || location.pathname.startsWith('/parent/');
  const hasToken = () => Boolean(localStorage.getItem('parent_token'));
  const norm = (value) => String(value || '').trim().toLowerCase();
  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamp = (value) => Math.max(0, Math.min(100, num(value)));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const headers = () => hasToken() ? { Authorization: `Bearer ${localStorage.getItem('parent_token')}` } : {};

  function css() {
    if (document.getElementById('bb-athlete-upgrades-style')) return;
    const style = document.createElement('style');
    style.id = 'bb-athlete-upgrades-style';
    style.textContent = `
      .bb-athlete-plus,.bb-athlete-plus *{box-sizing:border-box}.bb-athlete-plus{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.07);border-radius:32px;background:linear-gradient(135deg,rgba(24,24,27,.94),rgba(0,0,0,.98)),radial-gradient(circle at 20% 0%,rgba(220,38,38,.18),transparent 38%);padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.34)}
      .bb-athlete-plus:before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(120deg,rgba(255,255,255,.08),transparent 32%,transparent 70%,rgba(239,68,68,.06));opacity:.72}.bb-athlete-wrap{position:relative;z-index:1;display:grid;gap:16px}.bb-athlete-head{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:16px}.bb-panel,.bb-kb-card{border:1px solid rgba(255,255,255,.07);border-radius:26px;background:rgba(0,0,0,.38);padding:20px}.bb-kicker{color:#ef4444;font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.22em}.bb-athlete-title{margin:8px 0 10px;color:#fff;font-size:clamp(28px,4vw,46px);line-height:.92;font-weight:950;text-transform:uppercase;letter-spacing:-.03em}.bb-muted{color:#a1a1aa;font-size:14px;line-height:1.6}.bb-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.bb-pill{display:inline-flex;align-items:center;min-height:32px;border-radius:999px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.045);padding:0 12px;color:#d4d4d8;font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.bb-pill.red{border-color:rgba(239,68,68,.28);background:rgba(239,68,68,.11);color:#fca5a5}.bb-level{margin-top:8px;color:#fff;font-size:28px;line-height:1;font-weight:950;text-transform:uppercase;letter-spacing:-.02em}.bb-meter{height:12px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.06);padding:2px;margin-top:18px;overflow:hidden}.bb-meter span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ef4444,#f59e0b);box-shadow:0 0 20px rgba(239,68,68,.45)}.bb-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.bb-btn{border:0;min-height:44px;border-radius:16px;padding:0 16px;cursor:pointer;color:white;background:#dc2626;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.12em;transition:transform .18s ease,background .18s ease,border-color .18s ease}.bb-btn:hover{transform:translateY(-2px);background:#ef4444}.bb-btn.secondary{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:#e4e4e7}.bb-btn.secondary:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.16)}.bb-badges{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.bb-badge{min-height:132px;border:1px solid rgba(255,255,255,.07);border-radius:22px;background:rgba(0,0,0,.34);padding:16px;transition:transform .18s ease,border-color .18s ease,background .18s ease}.bb-badge:hover{transform:translateY(-2px);border-color:rgba(239,68,68,.25);background:rgba(255,255,255,.045)}.bb-badge.locked{opacity:.48;filter:grayscale(.55)}.bb-mark{width:34px;height:34px;display:grid;place-items:center;border-radius:13px;margin-bottom:14px;background:rgba(239,68,68,.12);color:#ef4444;font-size:13px;font-weight:950}.bb-badge.unlocked .bb-mark{background:rgba(245,158,11,.13);color:#fbbf24}.bb-badge-title{color:#fff;font-size:13px;font-weight:950;text-transform:uppercase;line-height:1.2}.bb-badge-desc{margin-top:8px;color:#71717a;font-size:11px;font-weight:700;line-height:1.45}.bb-next{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.bb-next div{border-radius:20px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.04);padding:15px;color:#d4d4d8;font-size:12px;line-height:1.45;font-weight:750}.bb-kb{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.bb-kb-card{min-height:108px;cursor:pointer;text-align:left;color:#fff;transition:transform .18s ease,border-color .18s ease,background .18s ease}.bb-kb-card:hover{transform:translateY(-2px);border-color:rgba(239,68,68,.25);background:rgba(255,255,255,.05)}.bb-kb-title{margin-top:10px;font-size:15px;font-weight:950;text-transform:uppercase}.bb-kb-sub{margin-top:6px;color:#71717a;font-size:11px;line-height:1.35;font-weight:700}.bb-kb-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:22px;background:rgba(0,0,0,.78);backdrop-filter:blur(14px)}.bb-kb-modal{width:min(920px,100%);max-height:min(760px,calc(100vh - 44px));overflow:auto;border:1px solid rgba(255,255,255,.1);border-radius:32px;background:linear-gradient(145deg,#111113,#030303);box-shadow:0 30px 100px rgba(0,0,0,.65);padding:22px}.bb-kb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.bb-kb-modal h2{margin:6px 0 0;color:#fff;font-size:clamp(26px,5vw,46px);line-height:.95;font-weight:950;text-transform:uppercase;letter-spacing:-.03em}.bb-close{width:44px;height:44px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.05);color:#fff;cursor:pointer;font-size:22px;line-height:1}.bb-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:18px}.bb-tab{border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(255,255,255,.04);color:#a1a1aa;padding:10px 13px;cursor:pointer;white-space:nowrap;font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.12em}.bb-tab.active{background:#dc2626;border-color:#dc2626;color:white}.bb-lead{color:#d4d4d8;font-size:16px;line-height:1.65;font-weight:650;margin:0 0 18px}.bb-list{display:grid;gap:10px}.bb-list div{border:1px solid rgba(255,255,255,.07);border-radius:18px;background:rgba(255,255,255,.035);padding:15px;color:#a1a1aa;font-size:14px;line-height:1.55;font-weight:650}
      @media(max-width:1050px){.bb-athlete-head,.bb-next{grid-template-columns:1fr}.bb-badges,.bb-kb{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.bb-athlete-plus{border-radius:24px;padding:16px}.bb-panel,.bb-kb-card{border-radius:20px;padding:16px}.bb-badges,.bb-kb{grid-template-columns:1fr}.bb-athlete-title{font-size:30px}.bb-next{grid-template-columns:1fr;gap:8px}}
    `;
    document.head.appendChild(style);
  }

  async function getJson(url, fallback) {
    try {
      const response = await fetch(url, { credentials: 'include', headers: headers() });
      if (!response.ok) return fallback;
      return await response.json();
    } catch {
      return fallback;
    }
  }

  async function loadData(force = false) {
    if (!isParentPage() || !hasToken()) return null;
    const now = Date.now();
    if (!force && state.data && now - state.lastFetch < 25000) return state.data;
    if (state.fetching) return state.data;
    state.fetching = true;
    const [participant, attendance, badges, events, ratings, homework] = await Promise.all([
      getJson('/api/parent/me', null),
      getJson('/api/parent/attendance', []),
      getJson('/api/parent/badges', []),
      getJson('/api/parent/events', []),
      getJson('/api/parent/ratings', null),
      getJson('/api/parent/homework', [])
    ]);
    state.fetching = false;
    if (!participant || participant.error) return null;
    state.data = {
      participant,
      attendance: Array.isArray(attendance) ? attendance : [],
      badges: Array.isArray(badges) ? badges : [],
      events: Array.isArray(events) ? events : [],
      ratings: ratings && !ratings.error ? ratings : null,
      homework: Array.isArray(homework) ? homework : []
    };
    state.lastFetch = now;
    return state.data;
  }

  function checklist(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  function counts(data) {
    const p = data.participant || {};
    const rating = data.ratings?.currentChild || {};
    const present = data.attendance.filter((item) => String(item.status || '').toLowerCase() === 'present').length;
    return {
      points: num(rating.total_points ?? p.rank_points),
      present,
      readiness: clamp(p.exam_readiness),
      rank: num(rating.rank_position),
      homeworkDone: data.homework.filter((item) => ['submitted', 'approved'].includes(String(item.status || ''))).length,
      homeworkActive: data.homework.filter((item) => !['approved', 'archived'].includes(String(item.status || ''))).length,
      events: data.events.length,
      skills: checklist(p.skill_checklist).length
    };
  }

  function levelFor(data) {
    const c = counts(data);
    if (c.rank > 0 && c.rank <= 3 && c.points >= 80) return { name: 'Лідер групи', progress: 100, note: 'Високий рейтинг у групі. Завдання - втримати темп і якість.' };
    if (c.readiness >= 85) return { name: 'Готовий до атестації', progress: c.readiness, note: 'Готовність висока. Варто уточнити у тренера фінальні деталі.' };
    if (c.points >= 180 || c.present >= 24) return { name: 'Сильний темп', progress: Math.min(92, Math.max(70, c.readiness || 76)), note: 'Є стабільна база. Наступний крок - якість техніки і контроль.' };
    if (c.points >= 80 || c.present >= 10 || c.homeworkDone >= 2) return { name: 'Стабільний учасник', progress: Math.min(76, Math.max(45, c.readiness || 55)), note: 'Ритм уже є. Регулярність і ДЗ швидко піднімуть рівень.' };
    if (c.present >= 1 || c.points > 0) return { name: 'Впевнений старт', progress: Math.min(48, Math.max(22, c.readiness || 30)), note: 'Перші кроки зроблено. Головне - не випадати з графіка.' };
    return { name: 'Новий старт', progress: 12, note: 'Портал покаже більше після перших тренувань і оцінок.' };
  }

  function badgesFor(data) {
    const c = counts(data);
    const real = data.badges.slice(0, 3).map((badge) => ({ title: badge.name || badge.title || badge.type || 'Відзнака тренера', desc: 'Додано тренером у профіль спортсмена.', unlocked: true, mark: 'BB' }));
    const smart = [
      { title: 'Перший крок', desc: 'Є перше відвідування або перші бали.', unlocked: c.present >= 1 || c.points > 0, mark: '01' },
      { title: 'Стабільність', desc: '10+ присутніх тренувань.', unlocked: c.present >= 10, mark: '10' },
      { title: 'Домашка', desc: 'Є виконані або здані ДЗ.', unlocked: c.homeworkDone > 0, mark: 'HW' },
      { title: 'Готовність', desc: '70%+ готовності до наступного поясу.', unlocked: c.readiness >= 70, mark: 'KYU' },
      { title: 'Подія клубу', desc: 'Семінар, атестація або змагання.', unlocked: c.events > 0, mark: 'EV' },
      { title: 'Топ групи', desc: 'Місце у першій трійці рейтингу.', unlocked: c.rank > 0 && c.rank <= 3, mark: 'TOP' },
      { title: 'Техніка', desc: 'Є чек-лист навичок від тренера.', unlocked: c.skills >= 3, mark: 'TK' }
    ];
    return [...real, ...smart].slice(0, 8);
  }

  function stepsFor(data) {
    const c = counts(data);
    const p = data.participant || {};
    const steps = [];
    if (p.payment_status && p.payment_status !== 'paid') steps.push('Закрити оплату, щоб статус у кабінеті був спокійний.');
    if (c.homeworkActive > 0) steps.push(`Виконати активні домашні завдання: ${c.homeworkActive}.`);
    if (c.readiness < 70) steps.push('Підняти готовність до поясу через методичку і регулярні тренування.');
    if (c.present < 8) steps.push('Набрати стабільність: ціль - 8-10 відвідувань без великих пауз.');
    if (steps.length < 3) steps.push('Попросити тренера відмітити сильні сторони і найближчу ціль.');
    return steps.slice(0, 3);
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

  function keepStatsTop() {
    const stats = findStatsGrid();
    const action = findActionSection();
    if (!stats || !action || stats.parentElement !== action.parentElement) return;
    const statsBeforeAction = Boolean(stats.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!statsBeforeAction) action.parentElement.insertBefore(stats, action);
  }

  function badgeHtml(badge) {
    return `<div class="bb-badge ${badge.unlocked ? 'unlocked' : 'locked'}"><div class="bb-mark">${esc(badge.mark)}</div><div class="bb-badge-title">${esc(badge.title)}</div><div class="bb-badge-desc">${esc(badge.desc)}</div></div>`;
  }

  function kbCards() {
    return TOPICS.map((topic) => `<button class="bb-kb-card" type="button" data-bb-open-kb="${topic.id}"><div class="bb-kicker">${esc(topic.eyebrow)}</div><div class="bb-kb-title">${esc(topic.title)}</div><div class="bb-kb-sub">${esc(topic.lead)}</div></button>`).join('');
  }

  function profileHtml(data, variant = 'overview') {
    const p = data.participant || {};
    const c = counts(data);
    const level = levelFor(data);
    const isAdult = p.member_type === 'adult';
    const name = p.name || p.first_name || 'Спортсмен';
    const group = p.group_name || 'групу ще не призначено';
    const belt = p.belt || 'пояс не вказано';
    const rankText = c.rank > 0 ? `#${c.rank} у групі` : `${c.points} балів`;
    return `<section class="bb-athlete-plus" data-bb-athlete-plus="${variant}"><div class="bb-athlete-wrap"><div class="bb-athlete-head"><div class="bb-panel"><div class="bb-kicker">${isAdult ? 'Профіль учасника' : 'Профіль спортсмена'}</div><h2 class="bb-athlete-title">${esc(name)}</h2><p class="bb-muted">${isAdult ? 'Ваш рівень, бали, відвідуваність, домашні завдання і база знань зібрані в одному місці.' : 'Батьки бачать зрозумілу картину: рівень, пояс, рейтинг, бейджі і що робити далі.'}</p><div class="bb-meta"><span class="bb-pill red">${esc(belt)}</span><span class="bb-pill">${esc(group)}</span><span class="bb-pill">${esc(rankText)}</span><span class="bb-pill">${c.present} відвідувань</span></div><div class="bb-actions"><button type="button" class="bb-btn" data-bb-open-kb="parents">База знань</button><button type="button" class="bb-btn secondary" data-bb-jump-tab="progress">Прогрес</button><button type="button" class="bb-btn secondary" data-bb-jump-tab="homework">Домашні</button></div></div><div class="bb-panel"><div class="bb-kicker">Рівень</div><div class="bb-level">${esc(level.name)}</div><p class="bb-muted" style="margin-top:8px">${esc(level.note)}</p><div class="bb-meter"><span style="width:${clamp(level.progress)}%"></span></div><div class="bb-meta"><span class="bb-pill">Готовність ${c.readiness}%</span><span class="bb-pill">ДЗ ${c.homeworkDone}</span></div></div></div><div class="bb-badges">${badgesFor(data).map(badgeHtml).join('')}</div><div class="bb-next">${stepsFor(data).map((step) => `<div>${esc(step)}</div>`).join('')}</div><div class="bb-kb">${kbCards()}</div></div></section>`;
  }

  function mountOverview(data) {
    const root = overviewRoot();
    if (!root) return false;
    keepStatsTop();
    const html = profileHtml(data, 'overview');
    const existing = root.querySelector('[data-bb-athlete-plus="overview"]');
    if (existing) {
      existing.outerHTML = html;
      return true;
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const section = wrap.firstElementChild;
    const stats = findStatsGrid();
    const action = findActionSection();
    if (stats && stats.parentElement === root) stats.insertAdjacentElement('afterend', section);
    else if (action && action.parentElement === root) root.insertBefore(section, action);
    else root.appendChild(section);
    return true;
  }

  function mountChildMode(data) {
    const main = document.querySelector('main.pt-28');
    if (!main || !norm(document.body.innerText).includes('режим спортсмена')) return false;
    const html = profileHtml(data, 'child');
    const existing = main.querySelector('[data-bb-athlete-plus="child"]');
    if (existing) {
      existing.outerHTML = html;
      return true;
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const first = main.querySelector('section');
    if (first) first.insertAdjacentElement('afterend', wrap.firstElementChild);
    else main.prepend(wrap.firstElementChild);
    return true;
  }

  function openKnowledge(topicId = state.activeTopic) {
    css();
    const topic = TOPICS.find((item) => item.id === topicId) || TOPICS[0];
    state.activeTopic = topic.id;
    let overlay = document.querySelector('.bb-kb-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'bb-kb-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="bb-kb-modal" role="dialog" aria-modal="true" aria-label="База знань Black Bear Dojo"><div class="bb-kb-head"><div><div class="bb-kicker">База знань</div><h2>${esc(topic.title)}</h2></div><button type="button" class="bb-close" data-bb-close-kb aria-label="Закрити">×</button></div><div class="bb-tabs">${TOPICS.map((item) => `<button type="button" class="bb-tab ${item.id === topic.id ? 'active' : ''}" data-bb-topic="${item.id}">${esc(item.title)}</button>`).join('')}</div><p class="bb-lead">${esc(topic.lead)}</p><div class="bb-list">${topic.items.map((item) => `<div>${esc(item)}</div>`).join('')}</div></div>`;
  }

  async function render(force = false) {
    if (!isParentPage() || !hasToken()) return;
    const data = await loadData(force);
    if (!data) return;
    css();
    mountOverview(data);
    mountChildMode(data);
  }

  function schedule(force = false) {
    if (!isParentPage() || !hasToken()) return;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => render(force), 220);
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
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.querySelector('.bb-kb-overlay')?.remove();
  });

  new MutationObserver(() => schedule(false)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', () => schedule(true));
  window.addEventListener('storage', () => schedule(true));
  window.setInterval(() => schedule(true), 30000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => schedule(true));
  else schedule(true);
})();
