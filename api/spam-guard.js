const { createHash } = require('node:crypto');
const WINDOW_MS = 10 * 60 * 1000;
function createSpamGuard({ now = Date.now } = {}) {
  const attempts = new Map();
  const submissions = new Map();
  function prune(map) {
    const time = now();
    for (const [key, value] of map) if (value.expires <= time) map.delete(key);
  }
  return {
    allow(req) {
      prune(attempts);
      // req.ip учитывает только явно настроенный доверенный прокси.
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      let entry = attempts.get(ip);
      if (!entry) {
        if (attempts.size >= 10000) return false;
        entry = { count: 0, expires: now() + WINDOW_MS };
        attempts.set(ip, entry);
      }
      return ++entry.count <= 5;
    },
    reserve(email, phone) {
      prune(submissions);
      const key = createHash('sha256').update(email + '\n' + phone).digest('hex');
      if (submissions.has(key) || submissions.size >= 10000) return null;
      // Резервируем до запроса в CRM: параллельный запрос не создаст второй лид.
      submissions.set(key, { expires: now() + WINDOW_MS });
      return key;
    },
    release(key) { submissions.delete(key); },
  };
}
module.exports = { createSpamGuard };
