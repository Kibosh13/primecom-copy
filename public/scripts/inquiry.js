(() => {
  const dialog = document.getElementById('pc-inquiry');
  const trigger = document.querySelector('#g-header.pc-hero .pc-button');
  if (!dialog || !trigger) return;
  const form = document.getElementById('pc-inquiry-form');
  const status = document.getElementById('pc-inquiry-status');
  const submit = form.querySelector('[type="submit"]');
  const phone = form.elements.phone;
  let busy = false, requestId = '', originalOverflow = '';
  trigger.setAttribute('href', '#pc-inquiry');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'pc-inquiry');
  trigger.addEventListener('click', event => {
    event.preventDefault();
    originalOverflow = document.documentElement.style.overflow;
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
  });
  const close = () => dialog.close();
  dialog.querySelector('.pc-inquiry-close').addEventListener('click', close);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = originalOverflow;
    trigger.focus({preventScroll:true});
  });
  phone.addEventListener('input', () => phone.setCustomValidity(''));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || dialog.dataset.demo === 'true') return;
    const digits = phone.value.replace(/\D/g, '');
    phone.setCustomValidity(digits.length >= 10 && digits.length <= 15 && /^[+\d\s().-]+$/.test(phone.value) ? '' : 'Введите номер телефона: от 10 до 15 цифр.');
    if (!form.reportValidity()) return;
    busy = true; submit.disabled = true; submit.textContent = 'Отправляем…';
    status.textContent = ''; status.classList.remove('is-error');
    requestId ||= crypto.randomUUID();
    try {
      const response = await fetch(form.action, {
        method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
        credentials:'same-origin', signal:AbortSignal.timeout(30000),
        body:JSON.stringify({...Object.fromEntries(new FormData(form)), requestId})
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не удалось отправить запрос. Попробуйте ещё раз.');
      status.textContent = 'Спасибо! Ваш запрос принят. Мы свяжемся с вами по указанным контактам.';
      form.reset(); requestId = '';
      if (typeof window.ym === 'function') window.ym(112484093, 'reachGoal', 'contact_sent');
    } catch (error) {
      status.classList.add('is-error');
      status.textContent = error.name === 'TimeoutError' ? 'Ответ задерживается. Попробуйте отправить ещё раз — повторная заявка не будет создана.' : error.message;
    } finally {
      busy = false; submit.disabled = false; submit.textContent = 'Отправить запрос';
    }
  });
})();
