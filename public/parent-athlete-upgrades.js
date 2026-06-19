(() => {
  const KNOWLEDGE_TOPICS = [
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
      lead: 'Пояс - це не подарунок і не просто дата. Це підтвердження техніки, дисципліни, відвідуваності і готовності.',
      items: [
        'До атестації важливі базова техніка, кіхон, стійки, удари, захист, витривалість і поведінка в залі.',
        'Готовність у кабінеті показує напрямок, але остаточне рішення завжди за тренером.',
        'Якщо готовність ще низька, це не проблема. Це карта: що саме треба підтягнути.',
        'Домашні завдання і методичка допомагають швидше закріплювати матеріал між тренуваннями.'
      ]
    }
  ];

  const state = {
    data: null,
    lastFetch: 0,
    renderTimer: 0,
    isFetching: false,
    activeKnowledgeTopic: 'parents'
  };

  const isParentPage = () => window.location.pathname === '/parent' || window.location.pathname.startsWith('/parent/');
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, toNumber(value)));
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
  const authHeaders = () => {
    const token = localStorage.getItem('parent_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  function injectStyles() {
    if (document.getElementById('bb-athlete-upgrades-style')) return;
    const style = document.createElement('style');
    style.id = 'bb-athlete-upgrades-style';
    style.textContent = `
      .bb-athlete-upgrade, .bb-athlete-upgrade * { box-sizing: border-box; }
      .bb-athlete-upgrade {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 32px;
        background:
          linear-gradient(135deg, rgba(24,24,27,.92), rgba(0,0,0,.96)),
          radial-gradient(circle at 18% 0%, rgba(239,68,68,.18), transparent 38%);
        padding: 24px;
        box-shadow: 0 24px 80px rgba(0,0,0,.34);
      }
      .bb-athlete-upgrade:before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(120deg, rgba(255,255,255,.08), transparent 32%, transparent 70%, rgba(239,68,68,.06));
        opacity: .65;
      }
      .bb-athlete-inner { position: relative; z-index: 1; display: grid; gap: 18px; }
      .bb-athlete-head { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr); gap: 18px; align-items: stretch; }
      .bb-athlete-main, .bb-athlete-side, .bb-knowledge-card {
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 26px;
        background: rgba(0,0,0,.38);
        padding: 20px;
      }
      .bb-athlete-kicker, .bb-badge-kicker, .bb-knowledge-kicker {
        color: #ef4444;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .22em;
      }
      .bb-athlete-title { margin: 8px 0 10px; color: #fff; font-size: clamp(26px, 4vw, 44px); line-height: .92; font-weight: 950; text-transform: uppercase; letter-spacing: -.02em; }
      .bb-athlete-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .bb-pill { display: inline-flex; align-items: center; min-height: 32px; border-radius: 999px; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.045); padding: 0 12px; color: #d4d4d8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
      .bb-pill.red { border-color: rgba(239,68,68,.28); background: rgba(239,68,68,.11); color: #fca5a5; }
      .bb-athlete-summary { color: #a1a1aa; font-size: 14px; line-height: 1.6; max-width: 680px; }
      .bb-level-name { margin-top: 8px; color: #fff; font-size: 28px; line-height: 1; font-weight: 950; text-transform: uppercase; letter-spacing: -.02em; }
      .bb-level-note { margin-top: 8px; color: #a1a1aa; font-size: 13px; line-height: 1.5; }
      .bb-level-meter { height: 12px; border-radius: 999px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.06); padding: 2px; margin-top: 18px; overflow: hidden; }
      .bb-level-meter span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #ef4444, #f59e0b); box-shadow: 0 0 20px rgba(239,68,68,.45); }
      .bb-athlete-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
      .bb-action { border: 0; min-height: 44px; border-radius: 16px; padding: 0 16px; cursor: pointer; color: white; background: #dc2626; font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: .12em; transition: transform .18s ease, background .18s ease, border-color .18s ease; }
      .bb-action:hover { transform: translateY(-2px); background: #ef4444; }
      .bb-action.secondary { border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.05); color: #e4e4e7; }
      .bb-action.secondary:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.16); }
      .bb-badges-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
      .bb-badge { min-height: 132px; border: 1px solid rgba(255,255,255,.07); border-radius: 22px; background: rgba(0,0,0,.34); padding: 16px; transition: transform .18s ease, border-color .18s ease, background .18s ease; }
      .bb-badge:hover { transform: translateY(-2px); border-color: rgba(239,68,68,.25); background: rgba(255,255,255,.045); }
      .bb-badge.locked { opacity: .48; filter: grayscale(.55); }
      .bb-badge-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 13px; margin-bottom: 14px; background: rgba(239,68,68,.12); color: #ef4444; font-size: 14px; font-weight: 950; }
      .bb-badge.unlocked .bb-badge-mark { background: rgba(245,158,11,.13); color: #fbbf24; }
      .bb-badge-title { color: #fff; font-size: 13px; font-weight: 950; text-transform: uppercase; letter-spacing: .02em; line-height: 1.2; }
      .bb-badge-desc { margin-top: 8px; color: #71717a; font-size: 11px; font-weight: 700; line-height: 1.45; }
      .bb-next-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .bb-next-item { border-radius: 20px; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.04); padding: 15px; color: #d4d4d8; font-size: 12px; line-height: 1.45; font-weight: 750; }
      .bb-knowledge-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
      .bb-knowledge-card { min-height: 108px; cursor: pointer; text-align: left; color: #fff; transition: transform .18s ease, border-color .18s ease, background .18s ease; }
      .bb-knowledge-card:hover { transform: translateY(-2px); border-color: rgba(239,68,68,.25); background: rgba(255,255,255,.05); }
      .bb-knowledge-title { margin-top: 10px; font-size: 15px; font-weight: 950; text-transform: uppercase; letter-spacing: -.01em; }
      .bb-knowledge-sub { margin-top: 6px; color: #71717a; font-size: 11px; line-height: 1.35; font-weight: 700; }
      .bb-knowledge-overlay { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 22px; background: rgba(0,0,0,.78); backdrop-filter: blur(14px); }
      .bb-knowledge-modal { width: min(920px, 100%); max-height: min(760px, calc(100vh - 44px)); overflow: auto; border: 1px solid rgba(255,255,255,.1); border-radius: 32px; background: linear-gradient(145deg, #111113, #030303); box-shadow: 0 30px 100px rgba(0,0,0,.65); padding: 22px; }
      .bb-knowledge-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
      .bb-knowledge-modal h2 { margin: 6px 0 0; color: #fff; font-size: clamp(26px, 5vw, 46px); line-height: .95; font-weight: 950; text-transform: uppercase; letter-spacing: -.03em; }
      .bb-close { width: 44px; height: 44px; border: 1px solid rgba(255,255,255,.09); border-radius: 16px; background: rgba(255,255,255,.05); color: #fff; cursor: pointer; font-size: 22px; line-height: 1; }
      .bb-topic-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 18px; }
      .bb-topic-tab { border: 1px solid rgba(255,255,255,.08); border-radius: 999px; background: rgba(255,255,255,.04); color: #a1a1aa; padding: 10px 13px; cursor: pointer; white-space: nowrap; font-size: 10px; font-weight: 950; text-transform: uppercase; letter-spacing: .12em; }
      .bb-topic-tab.active { background: #dc2626; border-color: #dc2626; color: white; }
      .bb-topic-lead { color: #d4d4d8; font-size: 16px; line-height: 1.65; font-weight: 650; margin: 0 0 18px; }
      .bb-topic-list { display: grid; gap: 10px; }
      .bb-topic-list div { border: 1px solid rgba(255,255,255,.07); border-radius: 18px; background: rgba(255,255,255,.035); padding: 15px; color: #a1a1aa; font-size: 14px; line-height: 1.55; font-weight: 650; }
      @media (max-width: 1050px) {
        .bb-athlete-head, .bb-next-grid { grid-template-columns: 1fr; }
        .bb-badges-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .bb-knowledge-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 560px) {
        .bb-athlete-upgrade { border-radius: 24px; padding: 16px; }
        .bb-athlete-main, .bb-athlete-side, .bb-knowledge-card { border-radius: 20px; padding: 16px; }
        .bb-badges-grid, .bb-knowledge-row { grid-template-columns: 1fr; }
        .bb-athlete-title { font-size: 30px; }
        .bb-next-grid { gap: 8px; }
      }
    `;
    document.head.appendChild(style);
  }

  async function fetchJson(url, fallback) {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        headers: authHeaders()
      });
      if (!response.ok) return fallback;
      return await response.json();
    } catch {
      return fallback;
    }
  }

  async function loadData(force = false) {
    if (!isParentPage()) return null;
    const now = Date.now();
    if (!force && state.data && now - state.lastFetch < 25000) return state.data;
    if (state.isFetching) return state.data;

    state.isFetching = true;
    const [participant, attendance, badges, events, ratings, homework, pointsLog] = await Promise.all([
      fetchJson('/api/parent/me', null),
      fetchJson('/api/parent/attendance', []),
      fetchJson('/api/parent/badges', []),
      fetchJson('/api/parent/events', []),
      fetchJson('/api/parent/ratings', null),
      fetchJson('/api/parent/homework', []),
      fetchJson('/api/parent/points-log', [])
    ]);
    state.isFetching = false;

    if (!participant || participant.error) return null;
    state.data = {
      participant,
      attendance: Array.isArray(attendance) ? attendance : [],
      badges: Array.isArray(badges) ? badges : [],
      events: Array.isArray(events) ? events : [],
      ratings: ratings && !ratings.error ? ratings : null,
      homework: Array.isArray(homework) ? homework : [],
      pointsLog: Array.isArray(pointsLog) ? pointsLog : []
    };
    state.lastFetch = now;
    return state.data;
  }

  function normalizeBeltName(value) {
    const raw = String(value || '').trim();
    return raw || 'пояс не вказано';
  }

  function parseChecklist(value) {
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

  function getCounts(data) {
    const participant = data.participant || {};
    const ratingsChild = data.ratings?.currentChild || {};
    const points = toNumber(ratingsChild.total_points ?? participant.rank_points);
    const attendanceCount = data.attendance.length;
    const presentCount = data.attendance.filter((item) => String(item.status || '').toLowerCase() === 'present').length;
    const readiness = clamp(participant.exam_readiness);
    const rank = toNumber(ratingsChild.rank_position);
    const homeworkDone = data.homework.filter((item) => ['submitted', 'approved'].includes(String(item.status || ''))).length;
    const homeworkActive = data.homework.filter((item) => !['approved', 'archived'].includes(String(item.status || ''))).length;
    return {
      points,
      attendanceCount,
      presentCount,
      readiness,
      rank,
      homeworkDone,
      homeworkActive,
      eventsCount: data.events.length,
      realBadgesCount: data.badges.length,
      skillsCount: parseChecklist(participant.skill_checklist).length,
      streak: toNumber(participant.streak)
    };
  }

  function buildLevel(data) {
    const counts = getCounts(data);
    const rankBonus = counts.rank > 0 && counts.rank <= 3;
    if (rankBonus && counts.points >= 80) {
      return { name: 'Лідер групи', progress: 100, note: 'Високий рейтинг у групі. Завдання - втримати темп і якість.' };
    }
    if (counts.readiness >= 85) {
      return { name: 'Готовий до атестації', progress: counts.readiness, note: 'Готовність висока. Варто уточнити у тренера фінальні деталі.' };
    }
    if (counts.points >= 180 || counts.presentCount >= 24) {
      return { name: 'Сильний темп', progress: Math.min(92, Math.max(70, counts.readiness || 76)), note: 'Є стабільна база. Наступний крок - якість техніки і контроль.' };
    }
    if (counts.points >= 80 || counts.presentCount >= 10 || counts.homeworkDone >= 2) {
      return { name: 'Стабільний учасник', progress: Math.min(76, Math.max(45, counts.readiness || 55)), note: 'Ритм уже є. Регулярність і домашні завдання швидко піднімуть рівень.' };
    }
    if (counts.presentCount >= 1 || counts.points > 0) {
      return { name: 'Впевнений старт', progress: Math.min(48, Math.max(22, counts.readiness || 30)), note: 'Перші кроки зроблено. Головне - не випадати з графіка.' };
    }
    return { name: 'Новий старт', progress: 12, note: 'Портал почне показувати більше після перших тренувань і оцінок.' };
  }

  function buildBadges(data) {
    const counts = getCounts(data);
    const realBadges = data.badges.slice(0, 3).map((badge) => ({
      title: badge.name || badge.title || badge.type || 'Відзнака тренера',
      desc: 'Додано тренером у профіль спортсмена.',
      unlocked: true,
      mark: 'BB'
    }));
    const smartBadges = [
      { title: 'Перший крок', desc: 'Є перше відвідування або перші бали.', unlocked: counts.presentCount >= 1 || counts.points > 0, mark: '01' },
      { title: 'Стабільність', desc: '10+ присутніх тренувань.', unlocked: counts.presentCount >= 10, mark: '10' },
      { title: 'Домашка', desc: 'Є виконані або здані ДЗ.', unlocked: counts.homeworkDone > 0, mark: 'HW' },
      { title: 'Готовність', desc: '70%+ готовності до наступного поясу.', unlocked: counts.readiness >= 70, mark: 'KYU' },
      { title: 'Подія клубу', desc: 'Участь у семінарі, атестації або змаганні.', unlocked: counts.eventsCount > 0, mark: 'EV' },
      { title: 'Топ групи', desc: 'Місце у першій трійці рейтингу.', unlocked: counts.rank > 0 && counts.rank <= 3, mark: 'TOP' },
      { title: 'Техніка', desc: 'Є чек-лист навичок від тренера.', unlocked: counts.skillsCount >= 3, mark: 'TK' }
    ];
    return [...realBadges, ...smartBadges].slice(0, 8);
  }

  function buildNextSteps(data) {
    const counts = getCounts(data);
    const participant = data.participant || {};
    const steps = [];
    if (participant.payment_status && participant.payment_status !== 'paid') steps.push('Закрити оплату, щоб статус у кабінеті був спокійний.');
    if (counts.homeworkActive > 0) steps.push(`Виконати активні домашні завдання: ${counts.homeworkActive}.`);
    if (counts.readiness < 70) steps.push('Підняти готовність до поясу через методичку і регулярні тренування.');
    if (counts.presentCount < 8) steps.push('Набрати стабільність: ціль - 8-10 відвідувань без великих пауз.');
    if (steps.length < 3) steps.push('Попросити тренера відмітити сильні сторони і найближчу ціль.');
    return steps.slice(0, 3);
  }

  function findStatsGrid() {
    return Array.from(document.querySelectorAll('div.grid')).find((element) => {
      const text = normalize(element.innerText || element.textContent);
      return element.querySelectorAll('button').length >= 4
        && ['відвідуваність', 'досягнення', 'оплата', 'telegram'].every((label) => text.includes(label));
    });
  }

  function findActionSection() {
    return Array.from(document.querySelectorAll('section')).find((element) => {
      const text = normalize(element.innerText || element.textContent);
      return text.includes('домашні завдання') && text.includes('методичка');
    });
  }

  function ensureStatsBeforeActions() {
    const stats = findStatsGrid();
    const action = findActionSection();
    if (!stats || !action || stats.parentElement !== action.parentElement) return;
    const statsBeforeActions = Boolean(stats.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!statsBeforeActions) action.parentElement.insertBefore(stats, action);
  }

  function findOverviewRoot() {
    return Array.from(document.querySelectorAll('main .bb-motion-page > div, main div.space-y-10')).find((element) => {
      const text = normalize(element.innerText || element.textContent);
      return text.includes('дашборд') && text.includes('домашні завдання') && text.includes('методичка');
    });
  }

  function renderBadge(badge) {
    return `
      <div class="bb-badge ${badge.unlocked ? 'unlocked' : 'locked'}">
        <div class="bb-badge-mark">${escapeHTML(badge.mark)}</div>
        <div class="bb-badge-title">${escapeHTML(badge.title)}</div>
        <div class="bb-badge-desc">${escapeHTML(badge.desc)}</div>
      </div>
    `;
  }

  function renderKnowledgeCards() {
    return KNOWLEDGE_TOPICS.map((topic) => `
      <button class="bb-knowledge-card" type="button" data-bb-open-knowledge="${topic.id}">
        <div class="bb-knowledge-kicker">${escapeHTML(topic.eyebrow)}</div>
        <div class="bb-knowledge-title">${escapeHTML(topic.title)}</div>
        <div class="bb-knowledge-sub">${escapeHTML(topic.lead)}</div>
      </button>
    `).join('');
  }

  function renderProfile(data, variant = 'overview') {
    const participant = data.participant || {};
    const counts = getCounts(data);
    const level = buildLevel(data);
    const badges = buildBadges(data);
    const nextSteps = buildNextSteps(data);
    const isAdult = participant.member_type === 'adult';
    const name = participant.name || participant.first_name || 'Спортсмен';
    const group = participant.group_name || 'групу ще не призначено';
    const belt = normalizeBeltName(participant.belt);
    const rankText = counts.rank > 0 ? `#${counts.rank} у групі` : `${counts.points} балів`;
    const title = isAdult ? 'Профіль учасника' : 'Профіль спортсмена';
    const summary = isAdult
      ? 'Ваш рівень, бали, відвідуваність, домашні завдання і база знань зібрані в одному місці.'
      : 'Батьки бачать зрозумілу картину: рівень, пояс, рейтинг, бейджі і що робити далі.';

    return `
      <section class="bb-athlete-upgrade ${variant === 'child' ? 'bb-athlete-child' : ''}" data-bb-athlete-upgrades="${variant}">
        <div class="bb-athlete-inner">
          <div class="bb-athlete-head">
            <div class="bb-athlete-main">
              <div class="bb-athlete-kicker">${escapeHTML(title)}</div>
              <h2 class="bb-athlete-title">${escapeHTML(name)}</h2>
              <p class="bb-athlete-summary">${escapeHTML(summary)}</p>
              <div class="bb-athlete-meta">
                <span class="bb-pill red">${escapeHTML(belt)}</span>
                <span class="bb-pill">${escapeHTML(group)}</span>
                <span class="bb-pill">${escapeHTML(rankText)}</span>
                <span class="bb-pill">${counts.presentCount} відвідувань</span>
              </div>
              <div class="bb-athlete-actions">
                <button type="button" class="bb-action" data-bb-open-knowledge="parents">База знань</button>
                <button type="button" class="bb-action secondary" data-bb-jump-tab="progress">Прогрес</button>
                <button type="button" class="bb-action secondary" data-bb-jump-tab="homework">Домашні</button>
              </div>
            </div>
            <div class="bb-athlete-side">
              <div class="bb-athlete-kicker">Рівень</div>
              <div class="bb-level-name">${escapeHTML(level.name)}</div>
              <div class="bb-level-note">${escapeHTML(level.note)}</div>
              <div class="bb-level-meter" aria-label="Прогрес рівня"><span style="width:${clamp(level.progress)}%"></span></div>
              <div class="bb-athlete-meta">
                <span class="bb-pill">Готовність ${counts.readiness}%</span>
                <span class="bb-pill">ДЗ ${counts.homeworkDone}</span>
              </div>
            </div>
          </div>

          <div class="bb-badges-grid">
            ${badges.map(renderBadge).join('')}
          </div>

          <div class="bb-next-grid">
            ${nextSteps.map((step) => `<div class="bb-next-item">${escapeHTML(step)}</div>`).join('')}
          </div>

          <div class="bb-knowledge-row">
            ${renderKnowledgeCards()}
          </div>
        </div>
      </section>
    `;
  }

  function mountOverview(data) {
    const root = findOverviewRoot();
    if (!root) return false;
    ensureStatsBeforeActions();

    const existing = root.querySelector('[data-bb-athlete-upgrades="overview"]');
    const html = renderProfile(data, 'overview');
    if (existing) {
      existing.outerHTML = html;
      return true;
    }

    const stats = findStatsGrid();
    const action = findActionSection();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const section = wrapper.firstElementChild;
    if (stats && stats.parentElement === root) {
      stats.insertAdjacentElement('afterend', section);
      return true;
    }
    if (action && action.parentElement === root) {
      root.insertBefore(section, action);
      return true;
    }
    root.appendChild(section);
    return true;
  }

  function mountChildMode(data) {
    const childMain = document.querySelector('main.pt-28');
    if (!childMain || !normalize(document.body.innerText).includes('режим спортсмена')) return false;
    const existing = childMain.querySelector('[data-bb-athlete-upgrades="child"]');
    const html = renderProfile(data, 'child');
    if (existing) {
      existing.outerHTML = html;
      return true;
    }
    const firstSection = childMain.querySelector('section');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const section = wrapper.firstElementChild;
    if (firstSection) firstSection.insertAdjacentElement('afterend', section);
    else childMain.prepend(section);
    return true;
  }

  function renderKnowledgeModal(topicId = state.activeKnowledgeTopic) {
    const topic = KNOWLEDGE_TOPICS.find((item) => item.id === topicId) || KNOWLEDGE_TOPICS[0];
    state.activeKnowledgeTopic = topic.id;
    let overlay = document.querySelector('.bb-knowledge-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'bb-knowledge-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="bb-knowledge-modal" role="dialog" aria-modal="true" aria-label="База знань Black Bear Dojo">
        <div class="bb-knowledge-modal-head">
          <div>
            <div class="bb-athlete-kicker">База знань</div>
            <h2>${escapeHTML(topic.title)}</h2>
          </div>
          <button type="button" class="bb-close" data-bb-close-knowledge aria-label="Закрити">×</button>
        </div>
        <div class="bb-topic-tabs">
          ${KNOWLEDGE_TOPICS.map((item) => `
            <button type="button" class="bb-topic-tab ${item.id === topic.id ? 'active' : ''}" data-bb-topic="${item.id}">${escapeHTML(item.title)}</button>
          `).join('')}
        </div>
        <p class="bb-topic-lead">${escapeHTML(topic.lead)}</p>
        <div class="bb-topic-list">
          ${topic.items.map((item) => `<div>${escapeHTML(item)}</div>`).join('')}
        </div>
      </div>
    `;
  }

  async function render(force = false) {
    if (!isParentPage()) return;
    injectStyles();
    const data = await loadData(force);
    if (!data) return;
    mountOverview(data);
    mountChildMode(data);
  }

  function scheduleRender(force = false) {
    if (!isParentPage()) return;
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(() => render(force), 220);
  }

  document.addEventListener('click', (event) => {
    const knowledgeButton = event.target.closest('[data-bb-open-knowledge]');
    if (knowledgeButton) {
      event.preventDefault();
      injectStyles();
      renderKnowledgeModal(knowledgeButton.getAttribute('data-bb-open-knowledge'));
      return;
    }

    const topicButton = event.target.closest('[data-bb-topic]');
    if (topicButton) {
      event.preventDefault();
      renderKnowledgeModal(topicButton.getAttribute('data-bb-topic'));
      return;
    }

    if (event.target.closest('[data-bb-close-knowledge]') || event.target.classList?.contains('bb-knowledge-overlay')) {
      event.preventDefault();
      document.querySelector('.bb-knowledge-overlay')?.remove();
      return;
    }

    const jumpButton = event.target.closest('[data-bb-jump-tab]');
    if (jumpButton) {
      event.preventDefault();
      const tab = jumpButton.getAttribute('data-bb-jump-tab');
      document.getElementById(`parent-nav-${tab}`)?.click();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.querySelector('.bb-knowledge-overlay')?.remove();
  });

  const observer = new MutationObserver(() => scheduleRender(false));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', () => scheduleRender(true));
  window.addEventListener('storage', () => scheduleRender(true));
  window.setInterval(() => scheduleRender(true), 30000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleRender(true));
  } else {
    scheduleRender(true);
  }
})();
