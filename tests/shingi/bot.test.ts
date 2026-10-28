import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { secretMatches, startReply, webhookSecret } from '../../api/_shingi/bot.js';

const TOKEN = '123456:TEST-TOKEN-NOT-REAL';
const BASE = 'https://shin-karate.kyiv.ua';

describe('бот: секрет вебхука', () => {
  it('залежить від токена і не є самим токеном', () => {
    const secret = webhookSecret(TOKEN);
    assert.match(secret, /^[a-f0-9]{64}$/);
    assert.notEqual(secret, TOKEN);
    assert.notEqual(secret, webhookSecret('other:token'));
  });

  it('приймає правильний секрет і відхиляє решту', () => {
    assert.equal(secretMatches(webhookSecret(TOKEN), TOKEN), true);
    assert.equal(secretMatches('wrong', TOKEN), false);
    assert.equal(secretMatches(undefined, TOKEN), false);
    assert.equal(secretMatches(webhookSecret(TOKEN), ''), false);
  });
});

describe('бот: відповідь на /start', () => {
  it('звичайний /start веде в кабінет', () => {
    const r = startReply('/start', BASE)!;
    assert.equal(r.url, `${BASE}/shin-gi/cabinet`);
    assert.match(r.text, /SHIN GI/);
  });

  it('deep-link team і solo ведуть на анкету з роллю', () => {
    assert.equal(startReply('/start team', BASE)!.url, `${BASE}/shin-gi/register?role=coach`);
    assert.equal(startReply('/start solo', BASE)!.url, `${BASE}/shin-gi/register?role=solo`);
  });

  it('невідомий параметр і /start@bot працюють як звичайний старт', () => {
    assert.equal(startReply('/start event', BASE)!.url, `${BASE}/shin-gi/cabinet`);
    assert.equal(startReply('/start@shingii_bot team', BASE)!.url, `${BASE}/shin-gi/register?role=coach`);
  });

  it('зайвий слеш у base не дублюється, інші повідомлення ігноруються', () => {
    assert.equal(startReply('/start', `${BASE}/`)!.url, `${BASE}/shin-gi/cabinet`);
    assert.equal(startReply('привіт', BASE), null);
    assert.equal(startReply('/help', BASE), null);
  });
});
