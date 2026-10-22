const registrationDialog = document.getElementById('registration-dialog');
if (registrationDialog) {
  document.querySelectorAll('[data-open-registration]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      registrationDialog.showModal();
      document.body.classList.add('dialog-open');
    });
  });
  registrationDialog.querySelector('.dialog-close').addEventListener('click', () => registrationDialog.close());
  registrationDialog.addEventListener('click', event => {
    const bounds = registrationDialog.getBoundingClientRect();
    if (event.target === registrationDialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) registrationDialog.close();
  });
  registrationDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
}

document.querySelectorAll('.topics-slider, .experts-slider, .reviews-slider').forEach(topicsSlider => {
  const section = topicsSlider.closest('section');
  const previous = section.querySelector('.topics-prev');
  const next = section.querySelector('.topics-next');
  const cards = [...topicsSlider.children];
  if (topicsSlider.matches('.topics-slider, .experts-slider')) {
    const updateControls = () => {
      previous.disabled = topicsSlider.scrollLeft <= 1;
      next.disabled = topicsSlider.scrollLeft >= topicsSlider.scrollWidth - topicsSlider.clientWidth - 1;
    };
    const move = direction => topicsSlider.scrollBy({
      left: direction * (cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(topicsSlider).gap)),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    topicsSlider.addEventListener('scroll', updateControls, { passive: true });
    new ResizeObserver(updateControls).observe(topicsSlider);
    updateControls();
    return;
  }
  const copyCards = () => cards.map(card => {
    const copy = card.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    return copy;
  });
  topicsSlider.prepend(...copyCards());
  topicsSlider.append(...copyCards());
  const stepSize = () => cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(topicsSlider).gap);
  let currentStep = 0;
  let settleTimer;
  const normalize = () => {
    const step = stepSize();
    const cycle = step * cards.length;
    let position = topicsSlider.scrollLeft;
    if (position < cycle) position += cycle;
    else if (position >= cycle * 2) position -= cycle;
    if (Math.abs(position - topicsSlider.scrollLeft) > 1) {
      topicsSlider.scrollTo({ left: position, behavior: 'instant' });
    }
    currentStep = Math.round(position / step);
  };
  const move = direction => {
    const step = stepSize();
    currentStep = Math.round(topicsSlider.scrollLeft / step) + direction;
    topicsSlider.scrollTo({ left: currentStep * step, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  topicsSlider.addEventListener('scroll', () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(normalize, 180);
  }, { passive: true });
  new ResizeObserver(() => {
    currentStep = cards.length + ((currentStep % cards.length) + cards.length) % cards.length;
    topicsSlider.scrollTo({ left: currentStep * stepSize(), behavior: 'instant' });
  }).observe(topicsSlider);
});

const historySlider = document.querySelector('.history-slider');
if (historySlider) {
  const section = historySlider.closest('section');
  const previous = section.querySelector('.topics-prev');
  const next = section.querySelector('.topics-next');
  const move = direction => {
    const step = historySlider.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(historySlider).gap);
    const end = historySlider.scrollWidth - historySlider.clientWidth;
    let target = historySlider.scrollLeft + direction * step;
    if (direction > 0 && historySlider.scrollLeft >= end - 2) target = 0;
    if (direction < 0 && historySlider.scrollLeft <= 2) target = end;
    historySlider.scrollTo({ left: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
}

const strip = document.querySelector('.photo-strip');
if (strip) {
  const firstPhotos = [...strip.querySelectorAll('img')];
  const secondPhotos = ['14-1.jpg', '14-2.jpg', '14-3.jpg', '14_4.jpg', '14-6.jpg'].map((file, index) => {
    const photo = new Image();
    photo.src = 'old/' + file;
    photo.alt = 'Прошедшее мероприятие: фото ' + (index + 1);
    photo.width = 460;
    photo.height = 240;
    return photo;
  });
  strip.replaceChildren();
  [firstPhotos, secondPhotos].forEach((photos, index) => {
    const row = document.createElement('div');
    row.className = 'photo-row' + (index === 1 ? ' photo-row-reverse' : '');
    const track = document.createElement('div');
    track.className = 'photo-track';
    const group = document.createElement('div');
    group.className = 'photo-group';
    photos.forEach(photo => {
      photo.loading = 'eager';
      group.append(photo);
    });
    const repeat = group.cloneNode(true);
    repeat.setAttribute('aria-hidden', 'true');
    repeat.querySelectorAll('img').forEach(photo => { photo.alt = ''; });
    track.append(group, repeat);
    row.append(track);
    strip.append(row);
  });
}

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


const historyAlbums = {
  'june-2026': ['old/15_1.jpg', 'old/15_2.jpg', 'old/15_3.jpg', 'old/15_4.jpg', 'old/15_5.jpg'],
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
