const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRegister } = require('../api/register');
const { createEventLogger } = require('../api/event-logger');
const env = { BITRIX_WEBHOOK_URL: 'https://example.invalid/rest/test/token/', BITRIX_ASSIGNED_BY_ID: '563' };
const body = { name: 'Иван Иванов', email: 'TEST@example.com', phone: '8 (999) 123-45-67', company: 'Тестовая клиника', promo: 'CLUB', agree: true, pageUrl: 'https://example.invalid/clinic/' };
function response() {
  return { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; } };
}
test('создаёт лид с полями нового мероприятия, ответственным и промокодом', async () => {
  let payload;
  const register = createRegister({ env, request: async (url, options) => {
    assert.equal(url, env.BITRIX_WEBHOOK_URL + 'crm.lead.add.json');
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ result: 123 }) };
  } });
  const res = response();
  await register({ method: 'POST', body }, res);
  assert.equal(res.code, 200);
  assert.equal(res.value.leadId, 123);
  assert.equal(payload.fields.PHONE[0].VALUE, '+79991234567');
  assert.equal(payload.fields.EMAIL[0].VALUE, 'test@example.com');
  assert.equal(payload.fields.LAST_NAME, 'Иванов');
  assert.equal(payload.fields.ASSIGNED_BY_ID, 563);
  assert.equal(payload.fields.SOURCE_ID, 'WEB');
  assert.equal(payload.fields.TITLE, 'ф-п-Клиники-26-12-гб');
  assert.match(payload.fields.SOURCE_DESCRIPTION, /Промокод: CLUB/);
  assert.match(payload.fields.COMMENTS, /Промокод: CLUB/);
});
test('не отправляет в Битрикс данные без согласия или с неверным телефоном', async () => {
  const register = createRegister({ env, request: async () => { throw new Error('Unexpected request'); } });
  for (const change of [{ agree: false }, { phone: '123' }, { company: '' }]) {
    const res = response();
    await register({ method: 'POST', body: { ...body, ...change } }, res);
    assert.equal(res.code, 400);
  }
});
test('не сообщает об успехе при ошибке Битрикс или отсутствии ID лида', async () => {
  for (const result of [{ error: 'ERROR' }, {}, { result: null }]) {
    const register = createRegister({ env, request: async () => ({ ok: true, json: async () => result }) });
    const res = response();
    await register({ method: 'POST', body }, res);
    assert.equal(res.code, 502);
    assert.equal(res.value.ok, false);
  }
});
test('не раскрывает секрет webhook при сетевой ошибке', async () => {
  const entries = [];
  const logger = { info: value => entries.push(value), error: value => entries.push(value) };
  const register = createRegister({ env, logger, request: async () => { throw new Error(env.BITRIX_WEBHOOK_URL); } });
  const res = response();
  await register({ method: 'POST', body }, res);
  assert.equal(res.code, 502);
  assert.match(res.headers['X-Request-ID'], /^[0-9a-f-]{36}$/);
  assert.ok(!JSON.stringify(res.value).includes('token'));
  assert.ok(entries.some(value => JSON.parse(value).event === 'bitrix_request_exception'));
  const log = entries.join('\n');
  assert.ok(!log.includes('token'));
  assert.ok(!log.includes(body.email));
  assert.ok(!log.includes(body.phone));
});
test('записывает безопасные события подтверждения в отдельный JSONL-файл', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-registration-log-'));
  const logFile = path.join(directory, 'events.jsonl');
  const logger = createEventLogger(logFile);
  const register = createRegister({ env, logger, request: async () => ({ ok: true, status: 200, json: async () => ({ result: 321 }) }) });
  const res = response();
  await register({ method: 'POST', body: { ...body, email: 'jsonl@example.com', phone: '8 (999) 222-33-44' } }, res);
  await logger.close();
  const events = fs.readFileSync(logFile, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.map(event => event.event), ['bitrix_request_started', 'bitrix_response_received']);
  assert.equal(events[1].confirmed, true);
  const serialized = JSON.stringify(events);
  assert.ok(!serialized.includes('jsonl@example.com'));
  assert.ok(!serialized.includes('89992223344'));
  fs.rmSync(directory, { recursive: true, force: true });
});
