const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRegister } = require('../api/register');
const { createSpamGuard } = require('../api/spam-guard');
const body = { name: 'Test User', email: 'test@example.com', phone: '89991234567', company: 'Test clinic', agree: true };
const env = { BITRIX_WEBHOOK_URL: 'https://example.invalid/rest/1/secret/' };
const response = () => ({ setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; } });

test('honeypot blocks requests before CRM call', async () => {
  let called = false;
  const register = createRegister({ env, request: async () => { called = true; } });
  const res = response();
  await register({ method: 'POST', body: { ...body, website: 'spam.example' }, ip: 'a' }, res);
  assert.equal(res.code, 400);
  assert.equal(called, false);
});
test('rate limit: five attempts in ten minutes, forged forwarded header ignored', () => {
  let time = 1000;
  const guard = createSpamGuard({ now: () => time });
  for (let i = 0; i < 5; i++) assert.equal(guard.allow({ ip: 'client-a', headers: { 'x-forwarded-for': String(i) } }), true);
  assert.equal(guard.allow({ ip: 'client-a', headers: { 'x-forwarded-for': 'different' } }), false);
  assert.equal(guard.allow({ ip: 'client-b' }), true);
  time += 600001;
  assert.equal(guard.allow({ ip: 'client-a' }), true);
});
test('concurrent and repeated submissions create only one CRM request', async () => {
  let finish;
  let calls = 0;
  const register = createRegister({ env, request: async () => {
    calls++;
    await new Promise(resolve => { finish = resolve; });
    return { ok: true, json: async () => ({ result: 123 }) };
  } });
  const first = response();
  const pending = register({ method: 'POST', body, ip: 'a' }, first);
  const second = response();
  await register({ method: 'POST', body, ip: 'b' }, second);
  assert.equal(second.code, 409);
  finish();
  await pending;
  const third = response();
  await register({ method: 'POST', body, ip: 'a' }, third);
  assert.equal(third.code, 409);
  assert.equal(calls, 1);
});
test('uncertain CRM response blocks retries; no automatic duplicate creation', async () => {
  let calls = 0;
  const register = createRegister({ env, request: async () => { calls++; throw new Error('Timeout'); } });
  const first = response();
  await register({ method: 'POST', body }, first);
  assert.equal(first.code, 502);
  const second = response();
  await register({ method: 'POST', body }, second);
  assert.equal(second.code, 409);
  assert.equal(calls, 1);
});
test('HTTP routes do not expose secrets, source files, or directory traversal', async () => {
  const app = require('../server');
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const url of ['/.env', '/%2eenv', '/.env.example', '/server.js', '/package.json', '/api/register.js', '/api/spam-guard.js', '/.git/config', '/assets/../.env', '/assets/%2e%2e%2f.env', '/doc/../.env', '/old/../.env', '/index_2025.html']) {
      assert.equal((await fetch(base + url)).status, 404, url);
    }
    for (const url of ['/', '/script.js', '/styles.css']) {
      const result = await fetch(base + url);
      assert.equal(result.status, 200);
      const text = await result.text();
      const secret = process.env.BITRIX_WEBHOOK_URL;
      if (secret) {
        assert.ok(!text.includes(secret), 'Secret URL must not appear in public response');
        const token = new URL(secret).pathname.split('/').filter(Boolean).at(-1);
        assert.ok(!text.includes(token), 'Secret token must not appear in public response');
      }
    }
    const bad = await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(bad.status, 400);
    assert.deepEqual(await bad.json(), { ok: false, message: 'Некорректный запрос.' });
    const large = await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(40000) }) });
    assert.equal(large.status, 413);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
test('webhook token is absent from all publishable files', () => {
  const root = path.join(__dirname, '..');
  require('dotenv').config({ path: path.join(root, '.env') });
  const secret = process.env.BITRIX_WEBHOOK_URL;
  assert.ok(secret, 'Webhook configured');
  const token = new URL(secret).pathname.split('/').filter(Boolean).at(-1);
  const files = ['index.html', 'script.js', 'styles.css'];
  function collect(dir, extensions) {
    for (const item of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = path.join(dir, item.name);
      if (item.isDirectory()) collect(relative, extensions);
      else if (extensions.test(item.name)) files.push(relative);
    }
  }
  collect('assets', /\.(png|jpe?g|svg|webp|ico|woff2?)$/i);
  collect('old', /\.(png|jpe?g|webp)$/i);
  collect('doc', /\.pdf$/i);
  for (const file of files) assert.ok(!fs.readFileSync(path.join(root, file)).includes(Buffer.from(token)), 'Secret absent: ' + file);
});
