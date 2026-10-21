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
      const response = await fetch('../api/register', {
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

