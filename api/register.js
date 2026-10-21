const EVENT_TITLE = 'Встреча клуба директоров частных клиник «Экономика частной клиники-2027», 8 декабря 2026, Москва';
const { createSpamGuard } = require('./spam-guard');
const trim = (value) => typeof value === 'string' ? value.trim() : '';

function normalizePhone(value) {
  const digits = trim(value).replace(/\D/g, '');
  if (digits.length === 10) return '+7' + digits;
  if (digits.length === 11 && /^[78]/.test(digits)) return '+7' + digits.slice(1);
  return '';
}

// fetch и настройки можно подменить в тестах без обращений в реальный Битрикс.
function createRegister({ request = (...args) => fetch(...args), env = process.env, guard = createSpamGuard() } = {}) {
  return async function register(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Метод не поддерживается.' });
    if (!guard.allow(req)) {
      res.setHeader('Retry-After', '600');
      return res.status(429).json({ ok: false, message: 'Слишком много попыток. Пожалуйста, попробуйте через 10 минут.' });
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ ok: false, message: 'Некорректный формат запроса.' });
    }
    const name = trim(body.name);
    const email = trim(body.email).toLowerCase();
    const phone = normalizePhone(body.phone);
    const company = trim(body.company);
    const promo = trim(body.promo);
    const pageUrl = trim(body.pageUrl).slice(0, 2048);
    const pageTitle = trim(body.pageTitle).slice(0, 300);
    const errors = [];
    if (name.length < 2 || name.length > 150) errors.push('Укажите имя и фамилию (до 150 символов).');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Укажите корректный e-mail.');
    if (!phone) errors.push('Укажите корректный телефон в российском формате.');
    if (company.length < 2 || company.length > 200) errors.push('Укажите название медучреждения (до 200 символов).');
    if (promo.length > 80) errors.push('Промокод слишком длинный.');
    if (body.agree !== true) errors.push('Нужно согласие на обработку персональных данных.');
    if (errors.length) return res.status(400).json({ ok: false, message: errors[0], errors });
    if (trim(body.website)) return res.status(400).json({ ok: false, message: 'Не удалось отправить заявку.' });

    const baseUrl = trim(env.BITRIX_WEBHOOK_URL);
    const assignedBy = Number(env.BITRIX_ASSIGNED_BY_ID || 563);
    if (!baseUrl || !Number.isSafeInteger(assignedBy) || assignedBy < 1) {
      return res.status(503).json({ ok: false, message: 'Приём заявок временно недоступен. Попробуйте позже.' });
    }
    let endpoint;
    try {
      endpoint = new URL(baseUrl.replace(/\/+$/, '') + '/crm.lead.add.json');
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('Invalid webhook');
    } catch {
      return res.status(503).json({ ok: false, message: 'Приём заявок временно недоступен.' });
    }
    const reservation = guard.reserve(email, phone);
    if (!reservation) return res.status(409).json({ ok: false, message: 'Заявка с этими контактами уже отправлена или обрабатывается. Пожалуйста, дождитесь ответа менеджера.' });
    const parts = name.split(/\s+/);
    const payload = {
      fields: {
        TITLE: env.BITRIX_LEAD_TITLE || 'Экономика частной клиники-2027 — 08.12.2026',
        NAME: parts[0], LAST_NAME: parts.slice(1).join(' '), COMPANY_TITLE: company,
        EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
        PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
        SOURCE_ID: 'WEB', SOURCE_DESCRIPTION: ['лид с сайта', pageUrl].filter(Boolean).join(' '),
        ASSIGNED_BY_ID: assignedBy,
        COMMENTS: [`Форма: ${EVENT_TITLE}`, pageTitle && `Страница: ${pageTitle}`, pageUrl && `URL: ${pageUrl}`, promo && `Промокод: ${promo}`, 'Согласие на обработку персональных данных: получено'].filter(Boolean).join('\n'),
      },
      params: { REGISTER_SONET_EVENT: 'Y' },
    };
    try {
      const response = await request(endpoint.href, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(15000), redirect: 'error',
      });
      const result = await response.json();
      if (result.error) guard.release(reservation);
      if (!response.ok || result.error || !Number.isSafeInteger(Number(result.result)) || Number(result.result) < 1) {
        return res.status(502).json({ ok: false, message: 'Битрикс24 не подтвердил создание заявки. Пожалуйста, свяжитесь с организатором.' });
      }
      return res.status(200).json({ ok: true, leadId: result.result });
    } catch {
      return res.status(502).json({ ok: false, message: 'Не удалось получить подтверждение от Битрикс24. Пожалуйста, свяжитесь с организатором перед повторной отправкой.' });
    }
  };
}
module.exports = createRegister();
module.exports.createRegister = createRegister;
