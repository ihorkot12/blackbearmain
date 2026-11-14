/**
 * HTML-віджети Telegram (Bot API 10.4, `sendWidget`) для трьох ботів клубу.
 *
 * Тут лише чисті функції: збирання HTML, перевірка лімітів, розбір запитів.
 * Відправку робить кожен бот своїм клієнтом і своїм токеном — боти лишаються окремими.
 *
 * Ліміти Telegram: HTML ≤ 32768 байт і ≤ 4096 байт після zlib level 9,
 * chat_data ≤ 1024 байт, data запиту 1–64 байти, відповідь ≤ 1024 байти.
 * Віджет не має мережі: усі дані вшиті в HTML або лежать у chat_data.
 * Вимкнути всі віджети без деплою: TELEGRAM_WIDGETS=off.
 */
import zlib from 'zlib';

export const WIDGET_HTML_MAX = 32768;
export const WIDGET_ZLIB_MAX = 4096;
export const WIDGET_STATE_MAX = 1024;

export const widgetsEnabled = () => String(process.env.TELEGRAM_WIDGETS || '').trim().toLowerCase() !== 'off';

const bytes = (value: string) => Buffer.byteLength(value, 'utf8');

export function widgetFits(html: string) {
  const raw = bytes(html);
  const packed = zlib.deflateSync(Buffer.from(html, 'utf8'), { level: 9 }).length;
  return { ok: raw <= WIDGET_HTML_MAX && packed <= WIDGET_ZLIB_MAX, raw, packed };
}

export const stateFits = (state: string) => bytes(state) <= WIDGET_STATE_MAX;

export const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Прибирає відступи й переноси між тегами — менше байт до ліміту 4 КБ. */
export const minify = (html: string) =>
  html
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/>\n</g, '><');

/**
 * Спільний стиль у клубному візуальному коді Black Bear Dojo:
 * чорна база #0A0A0A, текст #F2F2F0, службовий сірий #7A7A7A, золото #C9A227 лише для регалій (пояс),
 * червона риска + надрядок «BLACK BEAR DOJO · …», кандзі-водяний знак. Статуси — окремі смислові кольори.
 */
const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font:15px/1.35 -apple-system,system-ui,"Segoe UI",Roboto,sans-serif;color:#F2F2F0;background:#0A0A0A;padding:14px;position:relative;overflow:hidden}
body:after{content:"極真";position:absolute;right:-6px;top:-10px;font-size:92px;font-weight:800;color:#fff;opacity:.04;pointer-events:none}
.o{font-size:10px;letter-spacing:.16em;color:#7A7A7A;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:6px}
.o:before{content:"";width:16px;height:2px;background:#E11B22}
.o b{color:#E11B22;font-weight:700}
.h{color:#7A7A7A;font-size:13px}
.c{background:#151515;border:1px solid #222;border-radius:12px;padding:9px 11px}
.c b{display:block;font-size:17px;margin-top:2px}
.ok{color:#3FB950}.no{color:#F85149}.gd{color:#C9A227}
button{border:1px solid #262626;font:inherit;color:#F2F2F0;background:#151515;border-radius:12px;padding:7px 12px}
button.on{background:#F2F2F0;color:#0A0A0A;border-color:#F2F2F0;font-weight:600}
`;

const OVERLINE = (tail: string) => `<div class="o">Black Bear <b>Dojo</b> · ${esc(tail)}</div>`;

const shortName = (name: unknown, max = 22) => {
  const value = String(name ?? '').trim() || 'Учасник';
  return value.length <= max ? value : `${value.slice(0, max - 1).trim()}…`;
};

// ───────────────────────── Батьківський бот: картка дитини ─────────────────────────

export type ParentCardKid = {
  id: number;
  name: string;
  belt?: string | null;
  points?: number | null;
  group?: string | null;
  coach?: string | null;
  location?: string | null;
  schedule: string[]; // «Пн 17:00–18:00»
  visits: number; // присутності за поточний місяць
  month: string; // «листопад»
  payment: string; // «Оплачено» / «Канікули до …» / «Потрібно перевірити оплату»
  paid: boolean | 'freeze';
};

export function visitsLabel(n: number) {
  const tail = n % 100 >= 11 && n % 100 <= 14 ? 'тренувань' : n % 10 === 1 ? 'тренування' : n % 10 >= 2 && n % 10 <= 4 ? 'тренування' : 'тренувань';
  return `${n} ${tail}`;
}

function kidPanel(kid: ParentCardKid, index: number) {
  const payClass = kid.paid === true ? 'ok' : kid.paid === 'freeze' ? '' : 'no';
  const where = [kid.group || 'група уточнюється', kid.location, kid.coach ? `тренер ${kid.coach}` : '']
    .filter(Boolean)
    .join(' · ');
  const days = kid.schedule.length
    ? kid.schedule.slice(0, 4).map((line) => `<span class="d">${esc(line)}</span>`).join('')
    : '<span class="h">Розклад уточнюється</span>';
  return `<div id="k${index}"${index ? ' style="display:none"' : ''}>
<div class="n">${esc(shortName(kid.name, 40))}</div>
<div class="h"><span class="gd">${esc(kid.belt || 'Білий пояс')}</span> · ${Number(kid.points || 0)} балів</div>
<div class="g">
<div class="c"><span class="h">У ${esc(kid.month)}</span><b>${visitsLabel(Number(kid.visits || 0))}</b></div>
<div class="c"><span class="h">Оплата</span><b class="${payClass}">${esc(kid.payment)}</b></div>
</div>
<div class="h w">${esc(where)}</div>
<div class="ds">${days}</div>
</div>`;
}

/** Статична картка: усі дані вшиті в HTML, JS лише перемикає вкладки, якщо дітей кілька. */
export function buildParentCardHtml(kids: ParentCardKid[]) {
  const list = kids.slice(0, 5);
  const tabs =
    list.length > 1
      ? `<div class="t">${list
          .map((kid, i) => `<button id="t${i}"${i ? '' : ' class="on"'}>${esc(shortName(kid.name.split(/\s+/)[0], 14))}</button>`)
          .join('')}</div>`
      : '';
  const script =
    list.length > 1
      ? `<script>
var n=${list.length};
function s(i){for(var j=0;j<n;j++){document.getElementById('k'+j).style.display=j===i?'':'none';document.getElementById('t'+j).className=j===i?'on':''}}
for(var i=0;i<n;i++){(function(i){document.getElementById('t'+i).addEventListener('click',function(){s(i)})})(i)}
if(window.TelegramWidget&&TelegramWidget.ready)TelegramWidget.ready();
</script>`
      : '';
  return minify(`<style>${BASE_CSS}
.t{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.n{font-size:20px;font-weight:700;letter-spacing:-.01em}
.g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 8px}
.w{margin-bottom:6px}
.ds{display:flex;gap:6px;flex-wrap:wrap}
.d{border:1px solid #262626;border-radius:8px;padding:3px 8px;font-size:13px}
</style>
${OVERLINE('картка учня')}
${tabs}
${list.map(kidPanel).join('\n')}
${script}`);
}

// ───────────────────────── Тренерський бот: відмітка групи ─────────────────────────

export type AttendanceCode = 'p' | 'a' | 'e';
export type AttendanceState = Record<string, AttendanceCode>;

const TO_CODE: Record<string, AttendanceCode> = { present: 'p', absent: 'a', excused: 'e', late: 'p' };

export function attendanceState(rows: Array<{ id: number | string; status?: string | null }>): AttendanceState {
  const state: AttendanceState = {};
  for (const row of rows) {
    const code = TO_CODE[String(row.status || '').toLowerCase()];
    if (code) state[String(row.id)] = code;
  }
  return state;
}

/** chat_data віджета: дата відмітки + статуси тільки відмічених. */
export const attendanceChatData = (date: string, state: AttendanceState) => JSON.stringify({ d: date, s: state });

export function buildCoachAttendanceHtml(params: {
  groupId: number;
  title: string;
  subtitle: string;
  date: string; // YYYY-MM-DD
  participants: Array<{ id: number; name: string }>;
}) {
  const ids = params.participants.map((p) => Number(p.id));
  const rows = params.participants
    .map((p) => `<button class="r" id="b${Number(p.id)}"><i>—</i>${esc(shortName(p.name, 26))}</button>`)
    .join('');
  return minify(`<style>${BASE_CSS}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.n{font-size:19px;font-weight:700}
#sum{margin:4px 0 8px}
.l{display:grid;gap:5px}
.r{display:flex;align-items:center;gap:10px;text-align:left;width:100%;padding:8px 10px}
.r i{font-style:normal;width:22px;text-align:center;font-weight:700}
.r i{color:#7A7A7A}.r.p i{color:#3FB950}.r.a i{color:#F85149}.r.e i{color:#D29922}
.r.p{box-shadow:inset 3px 0 #3FB950}.r.a{box-shadow:inset 3px 0 #F85149}.r.e{box-shadow:inset 3px 0 #D29922}
#all{width:100%;margin-top:8px}
#m{margin-top:6px;min-height:16px}
</style>
${OVERLINE('відмітка')}
<div class="top"><div class="n">${esc(params.title)}</div><div class="h">${esc(params.subtitle)}</div></div>
<div class="h" id="sum"></div>
<div class="l">${rows}</div>
<button class="on" id="all">Решта — були</button>
<div class="h" id="m">Тап по імені: ✓ був → ✕ нема → П поважна → без відмітки</div>
<script>
var W=window.TelegramWidget,G=${Number(params.groupId)},D='${params.date.replace(/[^0-9-]/g, '')}',P=${JSON.stringify(ids)};
var S={},Q={},busy=0,tm=0,N={'':'—',p:'✓',a:'✕',e:'П'},X={'':'p',p:'a',a:'e',e:''};
function $(i){return document.getElementById(i)}
function load(){try{var j=JSON.parse(W.chatData||'{}');if(j.d===D&&j.s){S=j.s;for(var k in Q)S[k]=Q[k]}}catch(x){}paint()}
function paint(){var c={p:0,a:0,e:0,u:0};for(var i=0;i<P.length;i++){var s=S[P[i]]||'',b=$('b'+P[i]);b.className='r '+s;b.firstChild.textContent=N[s];c[s||'u']++}
$('sum').textContent='✓ '+c.p+' · ✕ '+c.a+' · П '+c.e+' · без відмітки '+c.u+' з '+P.length}
function msg(t){$('m').textContent=t}
function send(d,after){busy=1;W.request(d).then(function(r){try{var j=JSON.parse(r.result||'{}');if(j.e){msg(j.e)}else if(j.s){S=j.s;for(var k in Q)S[k]=Q[k];paint();msg('Збережено')}}catch(x){}},function(e){msg(e&&e.code==='RATE_LIMITED'?'Зачекайте секунду…':'Не збережено, тапніть ще раз')}).then(function(){busy=0;if(after)after();flush()})}
function flush(){if(busy)return;var k=Object.keys(Q)[0];if(!k)return;var s=Q[k];delete Q[k];send('a:'+G+':'+k+':'+(s||'u')+':'+D.replace(/-/g,''))}
for(var i=0;i<P.length;i++){(function(p){$('b'+p).addEventListener('click',function(){var s=X[S[p]||''];if(s)S[p]=s;else delete S[p];Q[p]=s;paint();msg('…');clearTimeout(tm);tm=setTimeout(flush,700)})})(P[i])}
$('all').addEventListener('click',function(){if(busy)return;for(var i=0;i<P.length;i++)if(!S[P[i]])S[P[i]]='p';paint();msg('…');send('r:'+G+':'+D.replace(/-/g,''))});
W.onEvent('chatDataChanged',load);load();if(W.ready)W.ready();
</script>`);
}

export type CoachWidgetRequest =
  | { kind: 'mark'; groupId: number; participantId: number; code: AttendanceCode | 'u'; date: string }
  | { kind: 'rest'; groupId: number; date: string };

const toIsoDate = (compact: string) =>
  /^\d{8}$/.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}` : null;

/** Розбір `a:<group>:<participant>:<p|a|e|u>:<YYYYMMDD>` і `r:<group>:<YYYYMMDD>`. */
export function parseCoachWidgetRequest(data: unknown): CoachWidgetRequest | null {
  const parts = String(data ?? '').split(':');
  if (parts[0] === 'a' && parts.length === 5) {
    const groupId = Number(parts[1]);
    const participantId = Number(parts[2]);
    const code = parts[3] as AttendanceCode | 'u';
    const date = toIsoDate(parts[4]);
    if (!Number.isInteger(groupId) || groupId <= 0 || !Number.isInteger(participantId) || participantId <= 0) return null;
    if (!['p', 'a', 'e', 'u'].includes(code) || !date) return null;
    return { kind: 'mark', groupId, participantId, code, date };
  }
  if (parts[0] === 'r' && parts.length === 3) {
    const groupId = Number(parts[1]);
    const date = toIsoDate(parts[2]);
    if (!Number.isInteger(groupId) || groupId <= 0 || !date) return null;
    return { kind: 'rest', groupId, date };
  }
  return null;
}

/** Відмічати можна сьогодні і на 7 днів назад; майбутнє — ні. */
export function isMarkableDate(date: string, today: string) {
  if (date > today) return false;
  const diff = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(diff) && diff <= 7;
}

// ───────────────────────── SHIN GI: картка команди ─────────────────────────

export type ShingiTeamCard = {
  eventTitle: string;
  eventDate: string; // «07.12.2026»
  daysTo: number | null;
  club: string;
  kids: number;
  open: number;
  paid: number;
  waiting: number; // подано, чекає оплати
  drafts: number;
  feeLine?: string | null;
  schedule?: string | null; // «Діти 10:00 · Дорослі 13:00»
};

export function buildShingiTeamHtml(card: ShingiTeamCard) {
  const total = card.kids + card.open;
  const when = card.daysTo === null ? '' : card.daysTo > 0 ? `через ${card.daysTo} дн.` : card.daysTo === 0 ? 'сьогодні' : 'завершено';
  const payLine =
    card.waiting > 0
      ? `<b class="no">${card.waiting} чекають оплати</b>`
      : total > 0
        ? '<b class="ok">Усе оплачено</b>'
        : '<b>Бійців ще немає</b>';
  return minify(`<style>${BASE_CSS}
body:after{content:"心技"}
.k{color:#C9A227;font-size:11px;letter-spacing:.18em;margin-bottom:4px}
.n{font-size:20px;font-weight:700;margin:2px 0}
.g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0}
.p{margin-top:2px}
</style>
<div class="k">SHIN GI 心技</div>
<div class="n">${esc(card.club || 'Моя команда')}</div>
<div class="h">${esc([card.eventTitle, card.eventDate, when].filter(Boolean).join(' · '))}</div>
<div class="g">
<div class="c"><span class="h">Діти</span><b>${card.kids}</b></div>
<div class="c"><span class="h">Дорослі</span><b>${card.open}</b></div>
<div class="c"><span class="h">Оплачено</span><b>${card.paid}</b></div>
</div>
<div class="c p">${payLine}${card.drafts ? `<span class="h">${card.drafts} у чернетці — не подані</span>` : ''}</div>
${card.schedule ? `<div class="h" style="margin-top:8px">${esc(card.schedule)}</div>` : ''}
${card.feeLine ? `<div class="h">${esc(card.feeLine)}</div>` : ''}`);
}
