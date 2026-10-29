import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dueReminders, parseQuestionTag, questionTag, reminderText } from '../../api/_shingi/reminders.js';

const EVENT = { status: 'registration', deadline_apps: '2026-12-16', deadline_pay: '2026-12-19', fee_uah: 400 };

describe('нагадування: які настали', () => {
  it('за 3 дні до дедлайну заявок', () => {
    assert.deepEqual(dueReminders(EVENT, '2026-12-13'), [{ key: 'apps:d3', kind: 'apps', days: 3, deadline: '2026-12-16' }]);
  });

  it('заявки й внесок можуть збігтися в один день', () => {
    const same = { ...EVENT, deadline_pay: '2026-12-16' };
    assert.deepEqual(dueReminders(same, '2026-12-15').map((r) => r.key), ['apps:d1', 'pay:d1']);
  });

  it('в останній день — окреме нагадування', () => {
    assert.deepEqual(dueReminders(EVENT, '2026-12-19').map((r) => r.key), ['pay:d0']);
  });

  it('в інші дні тиша', () => {
    for (const day of ['2026-12-01', '2026-12-12', '2026-12-14', '2026-12-17', '2026-12-20']) {
      assert.deepEqual(dueReminders(EVENT, day), [], day);
    }
  });

  it('безкоштовний захід — про внесок не нагадуємо', () => {
    assert.deepEqual(dueReminders({ ...EVENT, fee_uah: 0 }, '2026-12-16').map((r) => r.key), ['apps:d0']);
  });

  it('не в статусі «реєстрація» — нічого', () => {
    for (const status of ['draft', 'announced', 'groups_published', 'done', 'cancelled']) {
      assert.deepEqual(dueReminders({ ...EVENT, status }, '2026-12-13'), [], status);
    }
  });

  it('порожні дедлайни не ламають розрахунок', () => {
    assert.deepEqual(dueReminders({ ...EVENT, deadline_apps: null, deadline_pay: null }, '2026-12-13'), []);
  });
});

describe('нагадування: тексти', () => {
  it('про заявки', () => {
    const text = reminderText({ kind: 'apps', days: 3, deadline: '2026-12-16' }, { unpaid: 0, feeUah: 400 });
    assert.match(text, /до 16\.12\.2026/);
    assert.match(text, /залишилось 3 дні/);
  });

  it('про внесок — з сумою за неоплачених', () => {
    const text = reminderText({ kind: 'pay', days: 1, deadline: '2026-12-19' }, { unpaid: 4, feeUah: 400 });
    assert.match(text, /залишився 1 день/);
    assert.match(text, /4 бійц\., 1600 грн/);
  });

  it('останній день і власна назва внеску', () => {
    const text = reminderText({ kind: 'pay', days: 0, deadline: '2026-12-19' }, { unpaid: 1, feeUah: 300, noun: 'благодійний внесок' });
    assert.match(text, /сьогодні останній день/);
    assert.match(text, /благодійний внесок потрібно сплатити/);
  });
});

describe('питання: мітка в повідомленні штабу', () => {
  it('мітку можна знайти назад', () => {
    assert.equal(parseQuestionTag(`Питання ${questionTag(42)}\nтекст`), 42);
  });
  it('без мітки — null', () => {
    assert.equal(parseQuestionTag('просто повідомлення'), null);
    assert.equal(parseQuestionTag(undefined), null);
  });
});
