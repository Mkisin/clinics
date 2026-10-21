const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Проверка сертификата CRM обязательна, даже если оболочка разработки её отключала.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const express = require('express');
const register = require('./api/register');
const app = express();
const site = express.Router();
const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '');
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'loopback') app.set('trust proxy', 'loopback');
site.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
site.use(express.json({ limit: '32kb' }));
site.post('/api/register', register);
site.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
for (const file of ['styles.css', 'script.js']) {
  site.get('/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
}
site.use('/assets', (req, res, next) => {
  if (!/\.(png|jpe?g|webp|svg|ico|woff2?)$/i.test(req.path)) return res.sendStatus(404);
  next();
}, express.static(path.join(__dirname, 'assets'), { maxAge: '1d', index: false }));
site.use('/old', (req, res, next) => {
  if (!/\.(png|jpe?g|webp)$/i.test(req.path)) return res.sendStatus(404);
  next();
}, express.static(path.join(__dirname, 'old'), { maxAge: '1d', index: false }));
site.use('/doc', (req, res, next) => {
  if (!/\.pdf$/i.test(req.path)) return res.sendStatus(404);
  next();
}, express.static(path.join(__dirname, 'doc'), { index: false }));
if (basePath) {
  app.get(basePath, (req, res, next) => {
    if (req.path !== basePath) return next();
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    res.redirect(308, basePath + '/' + query);
  });
}
app.use(basePath || '/', site);
app.use((req, res) => res.sendStatus(404));
app.use((error, req, res, next) => {
  res.status(error.status === 413 ? 413 : 400).json({ ok: false, message: 'Некорректный запрос.' });
});
if (require.main === module) {
  const port = process.env.PORT || 3010;
  app.listen(port, '127.0.0.1', () => console.log(`Сайт: http://127.0.0.1:${port}${basePath}/`));
}
module.exports = app;
