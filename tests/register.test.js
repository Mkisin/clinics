const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRegister } = require('../api/register');
const env = { BITRIX_WEBHOOK_URL: 'https://example.invalid/rest/test/token/', BITRIX_ASSIGNED_BY_ID: '563' };
const body = { name: 'Иван Иванов', email: 'TEST@example.com', phone: '8 (999) 123-45-67', company: 'Тестовая клиника', promo: 'CLUB', agree: true, pageUrl: 'https://example.invalid/clinic/' };
function response() {
  return { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; } };
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
  assert.match(payload.fields.TITLE, /08\.12\.2026/);
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
  const register = createRegister({ env, request: async () => { throw new Error(env.BITRIX_WEBHOOK_URL); } });
  const res = response();
  await register({ method: 'POST', body }, res);
  assert.equal(res.code, 502);
  assert.ok(!JSON.stringify(res.value).includes('token'));
});
