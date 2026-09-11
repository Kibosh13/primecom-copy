export function withInquiryForm(html, {base = '/', demo = false} = {}) {
  if (!/\bpc-hero\b/.test(html) || html.includes('id="pc-inquiry"')) return html;
  const form = `<dialog id="pc-inquiry" class="pc-inquiry ym-hide-content" aria-labelledby="pc-inquiry-title" data-demo="${demo}">
  <button type="button" class="pc-inquiry-close" aria-label="Закрыть форму">×</button>
  <p class="pc-inquiry-eyebrow">ТД ПраймКом</p>
  <h2 id="pc-inquiry-title">Уточнить ассортимент</h2>
  <p class="pc-inquiry-intro">Расскажите, какие материалы вам нужны. Мы проверим наличие и свяжемся с вами.</p>
  ${demo ? '<p class="pc-inquiry-demo">Демонстрация: отправка заявок отключена.</p>' : ''}
  <form id="pc-inquiry-form" ${demo ? '' : 'action="/api/contact" method="post"'}>
    <input type="hidden" name="form" value="assortment">
    <div class="pc-inquiry-fields">
      <label for="pc-inquiry-name">Имя<input class="ym-disable-keys" id="pc-inquiry-name" name="name" autocomplete="name" required minlength="2" maxlength="100" placeholder="Как к вам обращаться"></label>
      <label for="pc-inquiry-email">Почта<input class="ym-disable-keys" id="pc-inquiry-email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="name@example.ru"></label>
      <label for="pc-inquiry-phone">Номер телефона<input class="ym-disable-keys" id="pc-inquiry-phone" name="phone" type="tel" autocomplete="tel" required maxlength="40" placeholder="+7 (___) ___-__-__"></label>
      <label for="pc-inquiry-message">Ваш запрос<textarea class="ym-disable-keys" id="pc-inquiry-message" name="message" rows="4" required minlength="10" maxlength="5000" placeholder="Материал, цвет, объём или ваш вопрос"></textarea></label>
    </div>
    <div class="pc-inquiry-trap" aria-hidden="true"><label>Сайт<input name="website" tabindex="-1" autocomplete="off"></label></div>
    <p class="pc-inquiry-note">Все поля обязательны. Контактные данные нужны, чтобы ответить на ваш запрос.</p>
    <p id="pc-inquiry-status" class="pc-inquiry-status" role="status" aria-live="polite"></p>
    <button class="pc-inquiry-submit" type="submit" ${demo ? 'disabled' : ''}>Отправить запрос</button>
  </form>
</dialog>`;
  return html.replace(/<\/head>/i, `<link rel="stylesheet" href="${base}styles/inquiry.css?v=20260911"><script defer src="${base}scripts/inquiry.js?v=20260911"></script>\n</head>`)
    .replace(/<\/body>/i, form + '\n</body>');
}
