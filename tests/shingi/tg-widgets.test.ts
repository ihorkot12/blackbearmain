import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attendanceChatData,
  attendanceState,
  buildCoachAttendanceHtml,
  buildParentCardHtml,
  buildShingiTeamHtml,
  isMarkableDate,
  parseCoachWidgetRequest,
  stateFits,
  widgetFits,
} from '../../api/_shared/tg-widgets.js';

const longName = (i: number) => `Костянтиненко-Вишневецький Олександр ${i}`;

test('картка батьків на 5 дітей вкладається в ліміти', () => {
  const kids = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    name: longName(i),
    belt: '8 кю',
    points: 120,
    group: 'Діти 7–12 · Шулявка',
    coach: 'Котляревський Ігор',
    location: 'вул. Сім’ї Бродських, 31/33',
    schedule: ['Пн 17:00–18:00', 'Ср 17:00–18:00', 'Пт 17:00–18:00'],
    visits: 9,
    month: 'листопаді',
    payment: 'Потрібно перевірити оплату',
    paid: false as const,
  }));
  const html = buildParentCardHtml(kids);
  assert.ok(widgetFits(html).ok, JSON.stringify(widgetFits(html)));
  assert.match(html, /id="t4"/);
  assert.ok(!html.includes('<script>alert'));
});

test('імена екрануються', () => {
  const html = buildParentCardHtml([{ id: 1, name: '<b>x</b>', schedule: [], visits: 0, month: 'січні', payment: 'Оплачено', paid: true }]);
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(!html.includes('<script>')); // одна дитина — без JS
});

test('відмітка групи на 40 дітей вкладається в ліміти, стан ≤ 1 КБ', () => {
  const participants = Array.from({ length: 40 }, (_, i) => ({ id: 10000 + i, name: longName(i) }));
  const html = buildCoachAttendanceHtml({ groupId: 123, title: 'Діти 7–12', subtitle: '14.11.2026 · Шулявка', date: '2026-11-14', participants });
  assert.ok(widgetFits(html).ok, JSON.stringify(widgetFits(html)));
  const state = attendanceState(participants.map((p) => ({ id: p.id, status: 'excused' })));
  assert.ok(stateFits(attendanceChatData('2026-11-14', state)));
});

test('картка SHIN GI вкладається в ліміти', () => {
  const html = buildShingiTeamHtml({
    eventTitle: 'SHIN GI · Kyokushin Open', eventDate: '07.12.2026', daysTo: 23, club: 'Black Bear Dojo',
    kids: 12, open: 4, paid: 10, waiting: 6, drafts: 2, feeLine: 'Внесок 400 грн за бійця', schedule: 'Діти 10:00 · Дорослі 13:00',
  });
  assert.ok(widgetFits(html).ok);
  assert.match(html, /6 чекають оплати/);
});

test('розбір запитів віджета', () => {
  assert.deepEqual(parseCoachWidgetRequest('a:12:345:p:20261114'), { kind: 'mark', groupId: 12, participantId: 345, code: 'p', date: '2026-11-14' });
  assert.deepEqual(parseCoachWidgetRequest('r:12:20261114'), { kind: 'rest', groupId: 12, date: '2026-11-14' });
  assert.equal(parseCoachWidgetRequest('a:12:345:x:20261114'), null);
  assert.equal(parseCoachWidgetRequest('a:0:345:p:20261114'), null);
  assert.equal(parseCoachWidgetRequest('a:12:345:p:2026-11-14'), null);
  assert.equal(parseCoachWidgetRequest(''), null);
  assert.ok(Buffer.byteLength('a:99999:9999999:u:20261114') <= 64);
});

test('дата відмітки: сьогодні і 7 днів назад', () => {
  assert.ok(isMarkableDate('2026-11-14', '2026-11-14'));
  assert.ok(isMarkableDate('2026-11-07', '2026-11-14'));
  assert.ok(!isMarkableDate('2026-11-06', '2026-11-14'));
  assert.ok(!isMarkableDate('2026-11-15', '2026-11-14'));
});

test('стан відвідуваності: late рахується як присутність, порожнє не пишеться', () => {
  assert.deepEqual(attendanceState([{ id: 1, status: 'present' }, { id: 2, status: 'late' }, { id: 3, status: '' }, { id: 4, status: 'absent' }]), { '1': 'p', '2': 'p', '4': 'a' });
});

// Імітація середовища віджета: мінімальний DOM і TelegramWidget, щоб прогнати вбудований JS.
function runWidgetScript(html: string, chatData: string | null, answer: (data: string) => string) {
  const script = /<script>([\s\S]*)<\/script>/.exec(html)?.[1];
  assert.ok(script, 'script present');
  const nodes = new Map<string, any>();
  const node = (id: string) => {
    if (!nodes.has(id)) {
      const listeners: Record<string, () => void> = {};
      nodes.set(id, {
        id, className: '', textContent: '', style: { display: '' },
        firstChild: { textContent: '' },
        addEventListener: (name: string, fn: () => void) => { listeners[name] = fn; },
        click: () => listeners.click?.(),
      });
    }
    return nodes.get(id);
  };
  const requests: string[] = [];
  const W: any = {
    chatData,
    onEvent: () => {},
    ready: () => {},
    request: (data: string) => { requests.push(data); return Promise.resolve({ result: answer(data) }); },
  };
  const timers: Array<() => void> = [];
  const fn = new Function('window', 'document', 'setTimeout', 'clearTimeout', 'TelegramWidget', script!);
  fn({ TelegramWidget: W }, { getElementById: node }, (cb: () => void) => { timers.push(cb); return timers.length; }, () => {}, W);
  return { node, requests, flushTimers: () => { while (timers.length) timers.shift()!(); } };
}

test('JS відмітки: тапи циклюють статус і йдуть у бот одним запитом', async () => {
  const html = buildCoachAttendanceHtml({
    groupId: 7, title: 'Г', subtitle: 's', date: '2026-11-14',
    participants: [{ id: 1, name: 'А' }, { id: 2, name: 'Б' }],
  });
  const env = runWidgetScript(html, JSON.stringify({ d: '2026-11-14', s: { '2': 'p' } }), (data) =>
    data.startsWith('a:7:1:a') ? JSON.stringify({ s: { '1': 'a', '2': 'p' } }) : JSON.stringify({ s: { '1': 'p', '2': 'p' } }),
  );
  assert.equal(env.node('b2').className, 'r p');
  assert.equal(env.node('b2').firstChild.textContent, '✓');
  env.node('b1').click(); // → p
  env.node('b1').click(); // → a
  assert.equal(env.node('b1').className, 'r a');
  env.flushTimers();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(env.requests, ['a:7:1:a:20261114']);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(env.node('m').textContent, 'Збережено');
  assert.match(env.node('sum').textContent, /✓ 1 · ✕ 1/);
});

test('JS картки батьків: вкладки перемикають дитину', () => {
  const kid = (id: number) => ({ id, name: `Дитина ${id}`, schedule: [], visits: 1, month: 'січні', payment: 'Оплачено', paid: true as const });
  const html = buildParentCardHtml([kid(1), kid(2)]);
  const env = runWidgetScript(html, null, () => '');
  env.node('t1').click();
  assert.equal(env.node('k0').style.display, 'none');
  assert.equal(env.node('k1').style.display, '');
  assert.equal(env.node('t1').className, 'on');
});

test('відмінювання кількості тренувань', async () => {
  const { visitsLabel } = await import('../../api/_shared/tg-widgets.js');
  assert.equal(visitsLabel(1), '1 тренування');
  assert.equal(visitsLabel(3), '3 тренування');
  assert.equal(visitsLabel(7), '7 тренувань');
  assert.equal(visitsLabel(12), '12 тренувань');
  assert.equal(visitsLabel(21), '21 тренування');
});
