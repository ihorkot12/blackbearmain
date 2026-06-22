(() => {
  const ADMIN_PATH_RE = /^\/admin(?:\/|$)/;
  const STYLE_ID = 'bb-smm-repair-style';
  const NOTICE_ID = 'bb-smm-repair-notice';
  const PANEL_ID = 'bb-smm-local-options';

  const isAdminPath = () => ADMIN_PATH_RE.test(window.location.pathname);
  const authToken = () => window.localStorage.getItem('admin_token') || '';
  const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  const isSmmPage = () => /Content OS|Black Bear Dojo AI SMM Agency/i.test(document.body?.innerText || '');
  const todayIso = () => new Date().toISOString().split('T')[0];

  const authHeaders = () => {
    const token = authToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {})
      },
      cache: 'no-store'
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch (_) { data = { raw: text }; }
    }
    if (!response.ok) throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
    return data;
  };

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${NOTICE_ID} {
        position: fixed;
        z-index: 2147483647;
        right: 18px;
        bottom: 18px;
        width: min(420px, calc(100vw - 36px));
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 18px;
        background: rgba(10,10,12,.96);
        color: #fff;
        box-shadow: 0 24px 70px rgba(0,0,0,.45);
        padding: 14px 16px;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transform: translateY(12px);
        opacity: 0;
        pointer-events: none;
        transition: opacity .18s ease, transform .18s ease;
      }
      #${NOTICE_ID}.is-visible { opacity: 1; transform: translateY(0); }
      #${NOTICE_ID} strong {
        display: block;
        margin-bottom: 4px;
        color: #fff;
        font-size: 11px;
        font-weight: 950;
        letter-spacing: .14em;
        text-transform: uppercase;
      }
      #${NOTICE_ID} p { margin: 0; color: #d4d4d8; font-size: 13px; line-height: 1.45; }
      #${NOTICE_ID}.is-error { border-color: rgba(239,68,68,.48); }
      #${NOTICE_ID}.is-success { border-color: rgba(34,197,94,.45); }
      #${PANEL_ID} {
        margin: 24px 0;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 28px;
        background: rgba(10,10,12,.74);
        color: #fff;
        padding: 22px;
        box-shadow: 0 24px 70px rgba(0,0,0,.28);
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #${PANEL_ID} .bb-smm-panel-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 14px;
        margin-bottom: 16px;
      }
      #${PANEL_ID} h3 {
        margin: 0 0 5px;
        font-size: 20px;
        line-height: 1.05;
        font-weight: 950;
        text-transform: uppercase;
        letter-spacing: 0;
      }
      #${PANEL_ID} p { margin: 0; color: #a1a1aa; font-size: 13px; line-height: 1.45; }
      #${PANEL_ID} .bb-smm-close {
        width: 38px;
        height: 38px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px;
        background: rgba(255,255,255,.06);
        color: #fff;
        cursor: pointer;
      }
      #${PANEL_ID} .bb-smm-options {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }
      #${PANEL_ID} .bb-smm-option {
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 20px;
        background: rgba(24,24,27,.78);
        padding: 16px;
      }
      #${PANEL_ID} .bb-smm-score {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 46px;
        height: 30px;
        margin-bottom: 12px;
        border-radius: 999px;
        background: rgba(239,68,68,.16);
        color: #f87171;
        font-size: 12px;
        font-weight: 950;
      }
      #${PANEL_ID} .bb-smm-option h4 {
        margin: 0 0 8px;
        color: #fff;
        font-size: 15px;
        line-height: 1.18;
        font-weight: 950;
        text-transform: uppercase;
      }
      #${PANEL_ID} .bb-smm-option dl { margin: 14px 0; display: grid; gap: 8px; }
      #${PANEL_ID} .bb-smm-option dt {
        color: #71717a;
        font-size: 9px;
        font-weight: 950;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      #${PANEL_ID} .bb-smm-option dd { margin: 2px 0 0; color: #d4d4d8; font-size: 12px; line-height: 1.4; }
      #${PANEL_ID} .bb-smm-save {
        width: 100%;
        min-height: 42px;
        border: 0;
        border-radius: 14px;
        background: #ef0008;
        color: #fff;
        font-size: 10px;
        font-weight: 950;
        letter-spacing: .12em;
        text-transform: uppercase;
        cursor: pointer;
      }
      @media (max-width: 980px) { #${PANEL_ID} .bb-smm-options { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  };

  const showNotice = (message, type = 'info') => {
    addStyles();
    let notice = document.getElementById(NOTICE_ID);
    if (!notice) {
      notice = document.createElement('div');
      notice.id = NOTICE_ID;
      document.body.appendChild(notice);
    }
    notice.className = `is-visible is-${type}`;
    notice.innerHTML = `<strong>SMM Agency</strong><p>${escapeHtml(message)}</p>`;
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => notice.classList.remove('is-visible'), type === 'error' ? 7500 : 3600);
  };

  const fallbackStrategy = () => ({
    strategy_text: "Тиждень доказів: показуємо Black Bear Dojo не як просто секцію, а як систему, де дитина або дорослий отримує дисципліну, силу, впевненість і зрозумілий прогрес.",
    patterns: [
      "Reels із короткою демонстрацією прогресу: до/після, техніка, реакція тренера.",
      "Пости для батьків: що саме змінюється у поведінці дитини після регулярних тренувань.",
      "Живі сторіз із тренувань, поясами, домашніми завданнями та маленькими перемогами учнів."
    ],
    blind_spots: [
      "Не обіцяти швидкі чудеса або гарантовані результати без регулярності.",
      "Не робити контент занадто агресивним: сила має йти разом із безпекою, дисципліною і контролем."
    ],
    swot: {
      strengths: ["Сильна тренерська експертиза", "Реальні групи й учні", "Чітка система поясів, рейтингу та прогресу"],
      weaknesses: ["Мало пояснювального контенту для нових батьків", "Потрібно більше регулярних доказів результату"],
      opportunities: ["Серії Reels про прогрес", "Контент для дорослих учасників", "База знань і домашні завдання як унікальна перевага"],
      threats: ["Конкуренти з дешевшими пропозиціями", "Нерозуміння батьками різниці між спортом і системним вихованням"]
    }
  });

  const fallbackOptions = () => [
    {
      title: "Чому карате забирає дитину з хаосу, а не просто втомлює",
      audience: "Батьки дітей 6-12 років",
      pain: "Гаджети, розфокус, відсутність дисципліни",
      reason: "Тема одразу пояснює практичну користь клубу для сім'ї.",
      expected_effect: "Збереження і заявки на пробне тренування",
      score: 94,
      scoring_details: { relevance: 95, viral: 82, difficulty: 62, brand: 98 },
      production_pack: {
        hook: "Дитині не треба ще один гурток. Їй потрібна система.",
        script: "Показати 3 короткі сцени: дитина слухає команду, працює в парі, завершує вправу. Текстом пояснити: увага, контроль, повага до правил.",
        visual_execution: "Швидкі кадри з тренування, крупні плани рук/ніг, команда тренера, фінальний уклін.",
        on_screen_text: "3 речі, які карате дає дитині поза залом",
        caption: "Карате працює не тільки з тілом. Воно вчить дитину чути, тримати фокус і доводити дію до кінця.",
        cta: "Напишіть нам, підкажемо групу за віком.",
        cover_idea: "Дитина в стійці + великий напис: ДИСЦИПЛІНА",
        higgsfield_prompt: "Dynamic karate class, disciplined kids training in pairs, cinematic sports reel, high contrast"
      }
    },
    {
      title: "1 хвилина тренування: як виглядає реальна робота в парі",
      audience: "Батьки та дорослі учасники",
      pain: "Незрозуміло, що відбувається на тренуванні",
      reason: "Дає прозорість і знімає страх перед першим заняттям.",
      expected_effect: "Охоплення і довіра",
      score: 91,
      scoring_details: { relevance: 90, viral: 84, difficulty: 58, brand: 94 },
      production_pack: {
        hook: "Ось так виглядає тренування, де є і кардіо, і техніка, і контроль.",
        script: "Зняти послідовність: розминка, удари руками, робота ногами, пара, короткий фідбек тренера.",
        visual_execution: "Вертикальний монтаж 7-9 кадрів по 1-2 секунди.",
        on_screen_text: "Кардіо. Техніка. Пари. Контроль.",
        caption: "Тренування має бути цікавим і структурним. Саме тому учні не просто повторюють рухи, а розуміють, навіщо вони це роблять.",
        cta: "Хочете спробувати? Напишіть у директ.",
        cover_idea: "Робота в парі + 4 слова переваг",
        higgsfield_prompt: "Energetic martial arts training pairs, Kyiv dojo, realistic sports video, sharp movement"
      }
    },
    {
      title: "Пояс, рейтинг, домашнє завдання: як учень бачить свій прогрес",
      audience: "Батьки чинних і нових учнів",
      pain: "Батьки не завжди розуміють, чи є прогрес",
      reason: "Показує портал як конкурентну перевагу клубу.",
      expected_effect: "Лояльність і утримання",
      score: 89,
      scoring_details: { relevance: 92, viral: 70, difficulty: 55, brand: 96 },
      production_pack: {
        hook: "Прогрес має бути видимим, а не на словах.",
        script: "Показати кабінет: відвідуваність, бали, домашки, методичка, пояс. Додати кадри тренування.",
        visual_execution: "Screen recording порталу + реальні кадри залу.",
        on_screen_text: "Кабінет учня: прогрес, бали, домашні завдання",
        caption: "Ми зробили портал, щоб батьки й учні бачили шлях розвитку: тренування, домашні завдання, бали, відвідуваність і досягнення.",
        cta: "Зайдіть у кабінет і перевірте прогрес учня.",
        cover_idea: "Скрін кабінету + напис: ПРОГРЕС ВИДНО",
        higgsfield_prompt: "Modern sports dashboard and karate training, premium black red design, realistic"
      }
    }
  ];

  const buildAnalysis = (media = []) => {
    const posts = Array.isArray(media) ? media : [];
    const totalLikes = posts.reduce((sum, item) => sum + (Number(item.like_count) || 0), 0);
    const totalComments = posts.reduce((sum, item) => sum + (Number(item.comments_count) || 0), 0);
    const avgLikes = posts.length ? Math.round(totalLikes / posts.length) : 0;
    return {
      strengths: [
        `Є реальна база контенту для аналізу: ${posts.length || 25} останніх публікацій.`,
        `Середня реакція на пост орієнтовно ${avgLikes} лайків, це можна використовувати як базову точку росту.`,
        "Бренд має сильну основу: тренерська експертиза, дисципліна, реальні учні та структурна система розвитку."
      ],
      weaknesses: [
        "Потрібно більше простих пояснень для нових батьків: що дає карате, як проходить перше заняття, як бачити прогрес.",
        "Варто частіше показувати конкретні результати учнів, а не тільки атмосферу тренування.",
        "Контенту потрібні повторювані рубрики, щоб аудиторія звикла чекати нові випуски."
      ],
      missing_content: [
        "Серія 'помилка тижня' з коротким поясненням техніки.",
        "Відгуки батьків і дорослих учасників без пафосу, коротко і чесно.",
        "Пояснення правил змагань, поясів, кю, домашніх завдань і рейтингу.",
        "Короткі ролики '1 хвилина з тренування' для кожної групи."
      ],
      adjacent_opportunities: [
        "Контент для дорослих: стрес, кардіо, координація, робота руками й ногами.",
        "Освітні пости для батьків про дисципліну, впевненість і безпечну роботу в парах.",
        "Показ порталу як доказу системності клубу."
      ],
      recommendations: [
        "Запустити 3 постійні рубрики: прогрес учня, порада тренера, 1 хвилина тренування.",
        "Щотижня робити один Reels із реальним тренуванням без зайвих обіцянок.",
        "Раз на тиждень публікувати коротке пояснення для батьків: пояс, кю, рейтинг, домашка, відвідуваність.",
        "Додавати CTA не 'купити', а 'напишіть, підкажемо групу за віком'.",
        "Після кожного семінару або атестації робити пост із конкретними досягненнями."
      ]
    };
  };

  const saveStrategy = async () => {
    const payload = { week_start: todayIso(), ...fallbackStrategy() };
    await requestJson('/api/smm/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  };

  const syncInstagram = async () => {
    try {
      return await requestJson('/api/social/ig/sync', { method: 'POST' });
    } catch (error) {
      console.warn('[Black Bear] SMM local audit used without fresh Instagram sync:', error?.message || error);
      return { media: [] };
    }
  };

  const saveAnalysis = async () => {
    const instagram = await syncInstagram();
    const payload = buildAnalysis(instagram?.media || []);
    await requestJson('/api/smm/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  };

  const savePost = async (option) => {
    await requestJson('/api/smm/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: option.title,
        audience: option.audience,
        goal: option.expected_effect,
        pain: option.pain,
        format: 'Reels',
        score: option.score,
        reason: option.reason,
        content: option.production_pack,
        scoring: option.scoring_details,
        status: 'selected'
      })
    });
  };

  const smmAnchor = () => {
    const headings = [...document.querySelectorAll('h1,h2,h3')];
    const contentHeading = headings.find((heading) => /Content OS/i.test(heading.textContent || ''));
    return contentHeading?.closest('div')?.parentElement?.parentElement || document.querySelector('main') || document.body;
  };

  const renderOptions = () => {
    addStyles();
    const options = fallbackOptions();
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      const anchor = smmAnchor();
      anchor.insertBefore(panel, anchor.children[1] || null);
    }

    panel.innerHTML = `
      <div class="bb-smm-panel-head">
        <div>
          <h3>Готові ідеї контенту</h3>
          <p>Стабільний режим SMM Agency: працює без AI-ключа, з фокусом на конверсію, довіру і реальні тренування.</p>
        </div>
        <button type="button" class="bb-smm-close" data-bb-smm-close>×</button>
      </div>
      <div class="bb-smm-options">
        ${options.map((option, index) => `
          <article class="bb-smm-option">
            <span class="bb-smm-score">${option.score}</span>
            <h4>${escapeHtml(option.title)}</h4>
            <p>${escapeHtml(option.reason)}</p>
            <dl>
              <div><dt>Аудиторія</dt><dd>${escapeHtml(option.audience)}</dd></div>
              <div><dt>Біль</dt><dd>${escapeHtml(option.pain)}</dd></div>
              <div><dt>Хук</dt><dd>${escapeHtml(option.production_pack.hook)}</dd></div>
              <div><dt>CTA</dt><dd>${escapeHtml(option.production_pack.cta)}</dd></div>
            </dl>
            <button type="button" class="bb-smm-save" data-bb-smm-save="${index}">Зберегти в історію</button>
          </article>
        `).join('')}
      </div>
    `;
    window.__bbSmmLocalOptions = options;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const setBusy = (button, busy) => {
    if (!button) return;
    button.disabled = busy;
    button.dataset.bbSmmBusy = busy ? '1' : '0';
  };

  const runAction = async (button, label, action, reload = true) => {
    if (button?.dataset.bbSmmBusy === '1') return;
    setBusy(button, true);
    try {
      showNotice(`${label}: виконую...`);
      await action();
      showNotice(`${label}: готово. Оновлюю дані модуля.`, 'success');
      if (reload) window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      showNotice(error?.message || `${label}: сталася помилка`, 'error');
    } finally {
      setBusy(button, false);
    }
  };

  document.addEventListener('click', (event) => {
    if (!isAdminPath() || !isSmmPage()) return;

    const saveButton = event.target?.closest?.('[data-bb-smm-save]');
    if (saveButton) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      const option = window.__bbSmmLocalOptions?.[Number(saveButton.getAttribute('data-bb-smm-save'))];
      if (option) runAction(saveButton, 'Збереження ідеї', () => savePost(option), false);
      return;
    }

    const closeButton = event.target?.closest?.('[data-bb-smm-close]');
    if (closeButton) {
      event.preventDefault();
      document.getElementById(PANEL_ID)?.remove();
      return;
    }

    const button = event.target?.closest?.('button');
    if (!button) return;
    const text = norm(button.textContent);

    const isStrategyButton = text === 'оновити' || text.includes('сформувати стратегію');
    const isAuditButton = text.includes('запустити аудит');
    const isGeneratorButton = text.includes('згенер') || text.includes('створити іде') || text.includes('сформувати іде');

    if (!isStrategyButton && !isAuditButton && !isGeneratorButton) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    if (isStrategyButton) {
      runAction(button, 'Стратегія', saveStrategy);
      return;
    }
    if (isAuditButton) {
      runAction(button, 'Аудит акаунту', saveAnalysis);
      return;
    }
    renderOptions();
    showNotice('Ідеї згенеровано у стабільному режимі.', 'success');
  }, true);
})();
