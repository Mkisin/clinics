document.querySelectorAll('[data-program]').forEach((link) => {
  const section = document.getElementById(link.dataset.program);
  if (!section) return;
  link.setAttribute('aria-controls', section.id);
  link.setAttribute('aria-expanded', String(section.open));
  section.addEventListener('toggle', () => {
    link.setAttribute('aria-expanded', String(section.open));
  });
  link.addEventListener('click', (event) => {
    event.preventDefault();
    section.open = !section.open;
    if (section.open) {
      section.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
      section.querySelector('summary').focus({ preventScroll: true });
    }
  });
});

const registrationForm = document.getElementById('registration-form');
if (registrationForm) {
  const submitButton = registrationForm.querySelector('[type="submit"]');
  const status = document.getElementById('registration-status');
  let sending = false;
  registrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending || !registrationForm.reportValidity()) return;
    status.classList.remove('registration-status-success');
    if (window.location.protocol === 'file:') {
      status.textContent = 'Для отправки заявки откройте сайт через сервер.';
      return;
    }
    if (registrationForm.elements.website.value.trim()) {
      status.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз.';
      return;
    }
    sending = true;
    submitButton.disabled = true;
    submitButton.textContent = 'ОТПРАВЛЯЕМ…';
    registrationForm.setAttribute('aria-busy', 'true');
    status.textContent = '';
    try {
      const formData = new FormData(registrationForm);
      const response = await fetch('api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'), email: formData.get('email'), phone: formData.get('phone'),
          company: formData.get('organization'), promo: formData.get('promo'),
          agree: formData.get('consent') === 'yes', website: formData.get('website'),
          pageUrl: window.location.href, pageTitle: document.title,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok || !result.leadId) {
        status.textContent = result?.message || 'Не удалось получить подтверждение заявки. Свяжитесь с организатором перед повторной отправкой.';
        return;
      }
      registrationForm.reset();
      status.classList.add('registration-status-success');
      status.textContent = 'Спасибо! Ваша заявка принята. Менеджер свяжется с вами.';
    } catch {
      status.textContent = 'Не удалось получить подтверждение заявки. Проверьте соединение и свяжитесь с организатором перед повторной отправкой.';
    } finally {
      sending = false;
      submitButton.disabled = false;
      submitButton.textContent = 'ПОДАТЬ ЗАЯВКУ';
      registrationForm.removeAttribute('aria-busy');
    }
  });
  submitButton.disabled = false;
}

// Добавлять снимки только к соответствующему мероприятию.
// При одном снимке карточка остаётся статичной.
const historyAlbums = {
  'december-2025': ['old/11_1.jpg', 'old/11_2.jpg', 'old/11_3.jpg', 'old/11_4.jpg', 'old/11_5.jpg'],
  'june-2025': ['old/12_1.png', 'old/12-2.png', 'old/12_3.png', 'old/12-4.png', 'old/12_5.png'],
  'december-2024': ['old/13_1.jpeg', 'old/13_2.jpeg', 'old/13-3.jpeg', 'old/13_4.jpeg', 'old/13_5.jpeg'],
  'june-2024': ['old/14-1.jpg', 'old/14-2.jpg', 'old/14-3.jpg', 'old/14_4.jpg', 'old/14-6.jpg'],
};

document.querySelectorAll('[data-history]').forEach((slideshow, cardIndex) => {
  const photos = historyAlbums[slideshow.dataset.history] || [];
  if (photos.length < 2) return;
  let current = slideshow.querySelector('img');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let photoIndex = Math.max(0, photos.indexOf(current.getAttribute('src')));
  let timer;
  let inView = false;
  let paused = false;
  let running = false;
  function schedule() {
    clearTimeout(timer);
    if (!inView || paused || document.hidden || motionPreference.matches || running) return;
    timer = setTimeout(rotate, 3000 + cardIndex * 270);
  }
  async function rotate() {
    if (running) return;
    running = true;
    const nextIndex = (photoIndex + 1) % photos.length;
    const next = new Image();
    next.className = 'history-next';
    next.alt = current.alt;
    next.width = 460;
    next.height = 240;
    next.src = photos[nextIndex];
    let animation;
    try {
      await next.decode();
      if (!inView || paused || document.hidden || motionPreference.matches) return;
      slideshow.append(next);
      animation = next.animate(
        [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }],
        { duration: 600, easing: 'ease', fill: 'forwards' }
      );
      await animation.finished;
      // Оставляем уже показанный элемент, не загружая тот же кадр в другой слой.
      current.remove();
      next.classList.remove('history-next');
      current = next;
      photoIndex = nextIndex;
    } catch {
      // При недоступном файле сохраняем текущий снимок.
    } finally {
      if (next !== current) next.remove();
      if (animation) animation.cancel();
      running = false;
      schedule();
    }
  }
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    schedule();
  });
  observer.observe(slideshow);
  slideshow.addEventListener('mouseenter', () => { paused = true; schedule(); });
  slideshow.addEventListener('mouseleave', () => { paused = false; schedule(); });
  document.addEventListener('visibilitychange', schedule);
  motionPreference.addEventListener('change', schedule);
});
