const historyAlbums = {
  'june-2026': ['../old/15_1.jpg', '../old/15_2.jpg', '../old/15_3.jpg', '../old/15_4.jpg', '../old/15_5.jpg'],
  'december-2025': ['../old/11_1.jpg', '../old/11_2.jpg', '../old/11_3.jpg', '../old/11_4.jpg', '../old/11_5.jpg'],
  'june-2025': ['../old/12_1.png', '../old/12-2.png', '../old/12_3.png', '../old/12-4.png', '../old/12_5.png'],
  'december-2024': ['../old/13_1.jpeg', '../old/13_2.jpeg', '../old/13-3.jpeg', '../old/13_4.jpeg', '../old/13_5.jpeg'],
  'june-2024': ['../old/14-1.jpg', '../old/14-2.jpg', '../old/14-3.jpg', '../old/14_4.jpg', '../old/14-6.jpg'],
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
