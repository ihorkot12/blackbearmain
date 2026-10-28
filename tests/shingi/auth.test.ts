import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import {
  readCookie,
  signSession,
  verifyLoginWidget,
  verifySession,
  verifyWebAppInitData,
} from '../../api/_shingi/auth.js';

const BOT_TOKEN = '123456:TEST-TOKEN-NOT-REAL';
const NOW = Date.UTC(2026, 10, 1, 12, 0, 0);
const nowSec = Math.floor(NOW / 1000);

const dcs = (fields: Record<string, string>) =>
  Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');

function signedWidget(over: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    id: '4242',
    first_name: 'Тест',
    username: 'tester',
    auth_date: String(nowSec - 60),
    ...over,
  };
  const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs(fields)).digest('hex');
  return { ...fields, hash };
}

function signedInitData(over: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    auth_date: String(nowSec - 60),
    query_id: 'AAH-test',
    user: JSON.stringify({ id: 4242, first_name: 'Тест', username: 'tester' }),
    ...over,
  };
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs(fields)).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe('Telegram Login Widget', () => {
  it('приймає валідний підпис', () => {
    const result = verifyLoginWidget(signedWidget(), BOT_TOKEN, NOW);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.id, 4242);
  });

  it('відхиляє підроблені дані', () => {
    const forged = { ...signedWidget(), id: '1' };
    assert.deepEqual(verifyLoginWidget(forged, BOT_TOKEN, NOW), { ok: false, reason: 'bad_hash' });
  });

  it('відхиляє підпис іншим токеном', () => {
    assert.deepEqual(verifyLoginWidget(signedWidget(), 'other:token', NOW), { ok: false, reason: 'bad_hash' });
  });

  it('відхиляє протермінований auth_date (> 24 год)', () => {
    const old = signedWidget({ auth_date: String(nowSec - 25 * 3600) });
    assert.deepEqual(verifyLoginWidget(old, BOT_TOKEN, NOW), { ok: false, reason: 'expired' });
  });

  it('відхиляє відсутній hash', () => {
    const { hash: _hash, ...rest } = signedWidget();
    assert.deepEqual(verifyLoginWidget(rest, BOT_TOKEN, NOW), { ok: false, reason: 'malformed' });
  });
});

describe('Telegram Mini App initData', () => {
  it('приймає валідний підпис', () => {
    const result = verifyWebAppInitData(signedInitData(), BOT_TOKEN, NOW);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.username, 'tester');
  });

  it('відхиляє підміну користувача', () => {
    const params = new URLSearchParams(signedInitData());
    params.set('user', JSON.stringify({ id: 1 }));
    assert.deepEqual(verifyWebAppInitData(params.toString(), BOT_TOKEN, NOW), { ok: false, reason: 'bad_hash' });
  });

  it('відхиляє протермінований', () => {
    const old = signedInitData({ auth_date: String(nowSec - 48 * 3600) });
    assert.deepEqual(verifyWebAppInitData(old, BOT_TOKEN, NOW), { ok: false, reason: 'expired' });
  });
});

describe('сесія', () => {
  const secret = 'unit-test-secret';

  it('підписує і перевіряє', () => {
    assert.equal(verifySession(signSession(7, secret, NOW), secret, NOW), 7);
  });

  it('відхиляє чужий секрет і підміну payload', () => {
    const token = signSession(7, secret, NOW);
    assert.equal(verifySession(token, 'other', NOW), null);
    const [h, , s] = token.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ pid: 1, exp: nowSec + 1e6 })).toString('base64url');
    assert.equal(verifySession(`${h}.${forgedBody}.${s}`, secret, NOW), null);
  });

  it('відхиляє протермінований (31 день)', () => {
    const token = signSession(7, secret, NOW);
    assert.equal(verifySession(token, secret, NOW + 31 * 24 * 3600 * 1000), null);
  });

  it('читає cookie', () => {
    assert.equal(readCookie('a=1; shingi_session=abc.def; b=2', 'shingi_session'), 'abc.def');
    assert.equal(readCookie(undefined, 'shingi_session'), null);
  });
});
