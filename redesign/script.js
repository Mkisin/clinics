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
    photo.src = '../old/' + file;
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
