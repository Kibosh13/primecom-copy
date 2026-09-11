const $ = (q, root = document) => root.querySelector(q),
  $$ = (q, root = document) => [...root.querySelectorAll(q)];
const e = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  home: "M3 10 12 3l9 7v10H3ZM9 20v-7h6v7",
  pages: "M6 3h9l4 4v14H6ZM14 3v5h5M9 12h7M9 16h7",
  media: "M3 4h18v16H3ZM3 16l5-5 4 4 4-6 5 7M8 8h.01",
  seo: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6",
  contacts:
    "M4 3h16v18H4ZM9 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0M7 18v-2c0-4 10-4 10 0v2",
  inquiries: "M3 5h18v14H3Zm0 0 9 8 9-8",
  settings:
    "m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  open: "M14 3h7v7m0-7-11 11M11 4H4v16h16v-7",
  logout: "M9 3H4v18h5m5-15 6 6-6 6m-6-6h12",
  menu: "M3 6h18M3 12h18M3 18h18",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
  save: "M4 3h14l3 3v15H3V3ZM7 3v6h10V3M7 21v-8h10v8",
};
const icon = (n) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n] || paths.pages}"/></svg>`;
const sections = [
  ["home", "Обзор"],
  ["pages", "Страницы"],
  ["media", "Медиатека"],
  ["seo", "SEO"],
  ["contacts", "Контакты"],
  ["inquiries", "Заявки"],
  ["settings", "Настройки"],
];
const state = {
  session: null,
  pages: [],
  media: [],
  settings: null,
  page: null,
  changes: {},
  seo: null,
  dirty: false,
  tab: "text",
  region: "Содержимое страницы",
  query: "",
  mediaLimit: 24,
};
const date = (v) =>
  v
    ? new Date(v).toLocaleString("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Исходная версия";
const replacementFor = (value, map) => {
  const seen = new Set();
  while (map[value] && !seen.has(value)) {
    seen.add(value);
    value = map[value];
  }
  return value;
};
const bytes = (v) =>
  v > 1024 ** 2
    ? (v / 1024 ** 2).toFixed(1) + " МБ"
    : Math.round(v / 1024) + " КБ";
let toastTimer,
  setupToken = new URLSearchParams(location.hash.slice(1)).get("setup");
if (setupToken) history.replaceState(null, "", location.pathname);
function toast(text, error = false) {
  const t = $("#toast");
  t.textContent = text;
  t.className = "show" + (error ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ""), 6000);
}
async function api(url, body) {
  const res = await fetch("/api/admin/" + url, {
    method: body ? "POST" : "GET",
    headers: body
      ? {
          "Content-Type": "application/json",
          "X-CSRF-Token": state.session?.csrf || "",
        }
      : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const result = await res.json();
  if (!res.ok) {
    if (res.status === 401 && state.session) {
      state.session = null;
      await loginView();
    }
    throw new Error(result.error || "Не удалось выполнить действие");
  }
  return result;
}
async function task(button, fn) {
  const text = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.textContent = "Подождите…";
  }
  try {
    return await fn();
  } catch (err) {
    toast(err.message, true);
  } finally {
    if (button && button.isConnected) {
      button.disabled = false;
      button.innerHTML = text;
    }
  }
}
function field(
  label,
  name,
  value,
  { type = "text", area = false, note = "", max = 5000 } = {},
) {
  return `<label class="field"><span class="field-label">${e(label)}</span>${area ? `<textarea name="${e(name)}" maxlength="${max}">${e(value)}</textarea>` : `<input type="${type}" name="${e(name)}" value="${e(value)}" maxlength="${max}" ${type === "password" ? 'autocomplete="new-password"' : ""}>`}${note ? `<span class="field-note">${e(note)}</span>` : ""}</label>`;
}
async function loginView() {
  const status = await api("status");
  const setup = !status.configured && !!setupToken;
  $("#app").innerHTML =
    `<div class="login-wrap"><section class="login-brand"><div class="brand"><img src="/templates/g5_helium/custom/images/logo.png" alt=""><div><strong>ПраймКом</strong><small>Управление сайтом</small></div></div><h1>Контент меняется.<br>Качество остаётся.</h1><p>Страницы, изображения, контакты и поисковое оформление — в одной панели управления.</p><div class="login-caption">Торговый Дом «ПраймКом»</div></section><section class="login-side"><form class="login-form"><h2>${setup ? "Создайте доступ" : "Вход в панель"}</h2><p>${setup ? "Задайте логин и свой пароль. Одноразовая ссылка перестанет действовать после первого входа." : "Войдите, чтобы управлять содержимым сайта."}</p>${!status.configured && !setup ? '<div class="note">Для первого входа нужна персональная ссылка настройки доступа, выданная владельцу сайта.</div>' : `${field("Логин", "username", setup ? "admin" : "", { max: 80 })}${field("Пароль", "password", "", { type: "password", max: 128, note: setup ? "Не менее 12 символов." : "" })}${setup ? field("Повторите пароль", "confirm", "", { type: "password", max: 128 }) : ""}<p class="error" role="alert"></p><button class="primary" type="submit">${setup ? "Создать доступ и войти" : "Войти"} ${icon("arrow")}</button>`}<p class="footer-help"><a href="/">← Вернуться на сайт</a></p></form></section></div>`;
  const form = $("form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (setup && values.password !== values.confirm) {
      $(".error", form).textContent = "Пароли не совпадают";
      return;
    }
    const button = $("button[type=submit]", form);
    button.disabled = true;
    try {
      state.session = await api(setup ? "setup" : "login", {
        ...values,
        token: setupToken,
      });
      setupToken = null;
      await start();
    } catch (err) {
      $(".error", form).textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
  if (!setup && $("input[name=password]"))
    $("input[name=password]").autocomplete = "current-password";
}
function shell(active) {
  $("#app").innerHTML =
    `<aside class="sidebar"><a class="brand" href="#home"><img src="/templates/g5_helium/custom/images/logo.png" alt=""><div><strong>ПраймКом</strong><small>Управление сайтом</small></div></a><p class="nav-label">Рабочее пространство</p><nav>${sections.map(([id, label]) => `<a href="#${id}" class="${id === active ? "active" : ""}">${icon(id)}${label}</a>`).join("")}</nav><div class="sidebar-footer">Основной сайт<br><a href="/" target="_blank" rel="noopener">prime-com.ru ↗</a></div></aside><button class="nav-backdrop" aria-label="Закрыть меню"></button><main class="main"><header class="topbar"><div class="topbar-left"><button class="quiet mobile-menu" aria-label="Открыть меню">${icon("menu")}</button><span class="live-dot"></span><span>Панель управления сайтом</span></div><div class="account"><span class="avatar">${e(state.session.username.slice(0, 1).toUpperCase())}</span><span class="username">${e(state.session.username)}</span><button class="quiet small" id="logout">${icon("logout")} Выйти</button></div></header><div class="content" id="content"></div></main>`;
  $(".mobile-menu").onclick = () => $(".sidebar").classList.toggle("open");
  $(".nav-backdrop").onclick = () => $(".sidebar").classList.remove("open");
  $("#logout").onclick = (event) =>
    task(event.currentTarget, async () => {
      if (state.dirty && !confirm("Выйти без сохранения изменений?")) return;
      await api("logout", {});
      state.session = null;
      state.dirty = false;
      await loginView();
    });
}
function head(title, sub, buttons = "") {
  return `<div class="page-head"><div><h1>${e(title)}</h1><p>${e(sub)}</p></div>${buttons ? `<div class="actions">${buttons}</div>` : ""}</div>`;
}
const empty = (title, text = "") =>
  `<div class="empty"><strong>${e(title)}</strong>${e(text)}</div>`;
function overview() {
  const drafts = state.pages.filter((p) => p.hasDraft),
    recent = [...state.pages]
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .slice(0, 6),
    home = state.pages.find((p) => p.url === "/");
  $("#content").innerHTML =
    head(
      "Обзор сайта",
      "Всё для актуального и аккуратного сайта.",
      `<a class="button" href="/" target="_blank" rel="noopener">Открыть сайт ${icon("open")}</a><a class="button primary" href="#page=${home.id}">Редактировать главную</a>`,
    ) +
    `<div class="stat-grid">${[
      ["Страниц сайта", state.pages.length, "pages"],
      ["Черновиков", drafts.length, "save"],
      ["Изображений", state.media.length, "media"],
    ]
      .map(
        ([name, count, i]) =>
          `<div class="card stat"><div><span>${name}</span><strong>${count}</strong></div><div class="stat-icon">${icon(i)}</div></div>`,
      )
      .join(
        "",
      )}</div><div class="overview-grid"><section class="card"><div class="card-head"><h2>Страницы сайта</h2><a href="#pages">Все страницы →</a></div>${recent.map((p) => `<a class="row-link" href="#page=${p.id}"><div><strong>${e(p.title)}</strong><small>${e(p.url)}</small></div><span class="badge ${p.hasDraft ? "draft" : ""}">${p.hasDraft ? "Черновик" : "На сайте"}</span></a>`).join("")}</section><section class="card card-pad"><h2>Как обновить страницу</h2>${[
      ["Выберите страницу", "Откройте нужный раздел через список или поиск."],
      ["Внесите изменения", "Обновите тексты, изображения, ссылки и SEO."],
      [
        "Проверьте и опубликуйте",
        "Сохраните черновик, откройте предпросмотр и нажмите «Опубликовать».",
      ],
    ]
      .map(
        ([title, text], i) =>
          `<div class="step"><span class="step-num">${i + 1}</span><div><strong>${title}</strong><p>${text}</p></div></div>`,
      )
      .join(
        "",
      )}<p class="footer-help">Предыдущие публикации доступны на вкладке «История» каждой страницы.</p></section></div>`;
}
function pagesView(seoOnly = false) {
  const cats = [...new Set(state.pages.map((p) => p.category))].sort();
  $("#content").innerHTML =
    head(
      seoOnly ? "SEO и поисковое оформление" : "Страницы сайта",
      seoOnly
        ? "Заголовки, описания, canonical и изображения для социальных сетей."
        : "Выберите страницу, чтобы изменить её содержимое.",
    ) +
    `<div class="card"><div class="toolbar"><input id="page-search" type="search" placeholder="Найти страницу по названию или адресу" aria-label="Поиск страниц"><select id="page-category" aria-label="Раздел сайта"><option value="">Все разделы</option>${cats.map((c) => `<option value="${e(c)}">${e(c)}</option>`).join("")}</select></div><div class="table-wrap"><table><thead><tr><th>Страница</th><th>${seoOnly ? "Описание" : "Статус"}</th><th></th></tr></thead><tbody id="page-rows"></tbody></table></div></div>`;
  const render = () => {
    const q = $("#page-search").value.toLowerCase(),
      cat = $("#page-category").value,
      rows = state.pages.filter(
        (p) =>
          (p.title + " " + p.url).toLowerCase().includes(q) &&
          (!cat || p.category === cat),
      );
    $("#page-rows").innerHTML = rows.length
      ? rows
          .map(
            (p) =>
              `<tr><td class="title-cell"><strong>${e(p.title)}</strong><small>${e(p.url)}</small></td><td>${seoOnly ? `<small>${e(p.description?.slice(0, 135) || "Описание не задано")}</small>` : `<span class="badge ${p.hasDraft ? "draft" : ""}">${p.hasDraft ? "Есть черновик" : "На сайте"}</span>`}</td><td><a class="button small" href="#page=${p.id}${seoOnly ? "&tab=seo" : ""}">Изменить</a></td></tr>`,
          )
          .join("")
      : `<tr><td colspan="3">${empty("Страницы не найдены", "Попробуйте другое название.")}</td></tr>`;
  };
  $("#page-search").oninput = render;
  $("#page-category").onchange = render;
  render();
}
function dirty() {
  state.dirty = true;
  const el = $("#edit-state");
  if (el) {
    el.textContent = "Есть несохранённые изменения";
    el.classList.add("dirty");
  }
}
function currentValue(f) {
  const change = state.changes[f.id];
  return typeof change === "object" ? change.value : (change ?? f.value);
}
async function editor(id, tab = "text") {
  state.page = await api("page?id=" + encodeURIComponent(id));
  state.changes = {};
  state.seo = { ...state.page.seo };
  state.dirty = false;
  state.tab = tab;
  state.region = "Содержимое страницы";
  state.query = "";
  renderEditor();
}
function renderEditor() {
  const p = state.page;
  $("#content").innerHTML =
    `<a class="crumb" href="#pages">← Все страницы</a><div class="page-head editor-head"><div><h1>${e(p.title)}</h1><p><a href="${e(p.url)}" target="_blank" rel="noopener">${e(p.url)} ↗</a></p><div class="edit-state ${state.dirty ? "dirty" : ""}" id="edit-state">${state.dirty ? "Есть несохранённые изменения" : p.hasDraft ? "Черновик сохранён. Изменения ещё не опубликованы." : "На сайте опубликована текущая версия."}</div></div><div class="actions editor-actions"><button id="preview">Предпросмотр</button><button id="save-draft">${icon("save")} Сохранить черновик</button><button class="primary" id="publish">Опубликовать</button></div></div><div class="tabs" role="tablist">${[
      ["text", "Тексты"],
      ["image", "Изображения"],
      ["url", "Ссылки"],
      ["seo", "SEO"],
      ["history", "История"],
    ]
      .map(
        ([id, label]) =>
          `<button role="tab" aria-selected="${state.tab === id}" class="${state.tab === id ? "active" : ""}" data-tab="${id}">${label}</button>`,
      )
      .join("")}</div><section id="editor-panel"></section>`;
  $$("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        state.tab = b.dataset.tab;
        state.query = "";
        renderEditor();
      }),
  );
  $("#save-draft").onclick = (ev) =>
    task(ev.currentTarget, () => savePage("draft"));
  $("#publish").onclick = (ev) =>
    task(ev.currentTarget, () => savePage("publish"));
  $("#preview").onclick = (ev) =>
    task(ev.currentTarget, async () => {
      if (state.dirty) await savePage("draft", false);
      const panel = $("#editor-panel");
      panel.innerHTML = `<div class="note">Предпросмотр сохранённого черновика. Посетители увидят изменения после публикации. <button class="small" id="back-editor">Вернуться к редактированию</button></div><iframe class="preview-frame" sandbox="allow-scripts" title="Предпросмотр страницы" src="/api/admin/preview?id=${p.id}&v=${state.page.version}"></iframe>`;
      $("#back-editor").onclick = renderEditor;
    });
  renderEditorPanel();
}
async function savePage(action, redraw = true) {
  const result = await api("page", {
    id: state.page.id,
    version: state.page.version,
    changes: state.changes,
    seo: state.seo,
    action,
  });
  state.page = result;
  state.changes = {};
  state.seo = { ...result.seo };
  state.dirty = false;
  state.pages = await api("pages");
  if (redraw) renderEditor();
  toast(
    action === "publish"
      ? "Изменения опубликованы на сайте"
      : "Черновик сохранён",
  );
}
function renderEditorPanel() {
  const panel = $("#editor-panel"),
    p = state.page;
  if (state.tab === "seo") {
    panel.innerHTML = `<div class="seo-grid"><div class="card card-pad">${field("Заголовок страницы (title)", "title", state.seo.title, { max: 250, note: "Ориентир: до 60 символов. Это не ограничение публикации." })}${field("Описание (description)", "description", state.seo.description, { area: true, max: 1500, note: "Краткое описание для поисковой выдачи. Ориентир: до 160 символов." })}${field("Ключевые слова", "keywords", state.seo.keywords)}${field("Основной адрес (canonical)", "canonical", state.seo.canonical, { note: "Полный адрес этой страницы. Можно оставить пустым." })}<label class="field"><span class="field-label">Индексация страницы</span><select name="robots">${["index, follow", "noindex, follow", "noindex, nofollow"].map((v) => `<option ${state.seo.robots === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><h3>Социальные сети</h3>${field("Заголовок карточки", "ogTitle", state.seo.ogTitle)}${field("Описание карточки", "ogDescription", state.seo.ogDescription, { area: true })}${field("Изображение карточки — URL", "ogImage", state.seo.ogImage)}<button id="og-pick">Выбрать изображение</button></div><aside><div class="search-preview"><div class="domain">prime-com.ru › ${e(p.url.split("/").filter(Boolean).slice(0, 1).join(""))}</div><h3 id="search-title"></h3><p id="search-description"></p></div><p class="preview-note">Приблизительный вид в поисковой выдаче. Поисковая система может выбрать другой текст.</p></aside></div>`;
    const preview = () => {
      $("#search-title").textContent = state.seo.title || "Заголовок страницы";
      $("#search-description").textContent =
        state.seo.description ||
        "Добавьте описание, чтобы кратко рассказать о странице.";
    };
    $$("[name]", panel).forEach(
      (input) =>
        (input.oninput = () => {
          state.seo[input.name] = input.value;
          dirty();
          preview();
        }),
    );
    $("#og-pick").onclick = () =>
      pickMedia((asset) => {
        state.seo.ogImage = encodeURI(asset.url);
        dirty();
        renderEditorPanel();
      });
    preview();
    return;
  }
  if (state.tab === "history") {
    panel.innerHTML = `<div class="note">Здесь хранятся 20 предыдущих публикаций. Восстановление создаёт черновик: текущая страница на сайте останется прежней до публикации.</div>${p.hasDraft ? '<button class="danger" id="discard-draft">Отменить сохранённый черновик</button><br><br>' : ""}<div class="card">${p.history.length ? p.history.map((h) => `<div class="history-row"><div><strong>${date(h.createdAt)}</strong><small>Версия перед публикацией изменений</small></div><button class="small" data-restore="${h.id}">Восстановить в черновик</button></div>`).join("") : empty("История пока пуста", "Она появится после первой публикации из панели.")}</div>`;
    $$("[data-restore]").forEach(
      (b) =>
        (b.onclick = () =>
          task(b, async () => {
            if (
              state.dirty &&
              !confirm("Заменить несохранённые изменения выбранной версией?")
            )
              return;
            state.page = await api("page", {
              id: p.id,
              version: p.version,
              action: "restore",
              historyId: b.dataset.restore,
            });
            state.changes = {};
            state.seo = { ...state.page.seo };
            state.dirty = false;
            renderEditor();
            toast("Версия восстановлена в черновик");
          })),
    );
    if ($("#discard-draft"))
      $("#discard-draft").onclick = (ev) =>
        task(ev.currentTarget, async () => {
          if (
            !confirm(
              "Отменить изменения черновика? Опубликованная страница не изменится.",
            )
          )
            return;
          await api("page", {
            id: p.id,
            version: p.version,
            action: "discard",
          });
          await editor(p.id, "history");
        });
    return;
  }
  const fields = p.fields.filter((f) => f.type === state.tab),
    regions = [...new Set(fields.map((f) => f.region))];
  if (!regions.includes(state.region))
    state.region = regions[0] || "Содержимое страницы";
  panel.innerHTML = `<div class="editor-tools"><select id="field-region" aria-label="Область страницы">${regions.map((r) => `<option ${r === state.region ? "selected" : ""}>${e(r)}</option>`).join("")}</select><input id="field-search" type="search" value="${e(state.query)}" placeholder="Найти текст или изображение" aria-label="Поиск полей страницы"></div><div id="fields"></div>`;
  const draw = () => {
    state.region = $("#field-region").value;
    state.query = $("#field-search").value;
    const shown = fields.filter(
      (f) =>
        f.region === state.region &&
        [f.label, currentValue(f), f.section]
          .join(" ")
          .toLowerCase()
          .includes(state.query.toLowerCase()),
    );
    const box = $("#fields");
    if (!shown.length) {
      box.innerHTML = empty("Здесь пока нет подходящих полей");
      return;
    }
    if (state.tab === "image")
      box.innerHTML = `<div class="image-edit-grid">${shown.map((f) => `<div class="card image-edit"><div class="image-box"><img src="${e(encodeURI(currentValue(f)))}" alt=""></div><strong>${e(f.label)}</strong><p class="field-note">${e(f.section)}</p><label class="field"><span class="field-label">Адрес изображения</span><input data-field="${e(f.id)}" value="${e(currentValue(f))}"></label>${f.alt !== null ? `<label class="field"><span class="field-label">Описание изображения (alt)</span><input data-alt="${e(f.id)}" value="${e(state.changes[f.id]?.alt ?? f.alt)}"></label>` : ""}<button class="small" data-pick="${e(f.id)}">Выбрать изображение</button></div>`).join("")}</div>`;
    else {
      const groups = new Map();
      shown.forEach((f) => {
        if (!groups.has(f.section)) groups.set(f.section, []);
        groups.get(f.section).push(f);
      });
      box.innerHTML = [...groups]
        .map(
          ([section, items], i) =>
            `<details class="field-group" ${i < 2 || state.query ? "open" : ""}><summary>${e(section)} <small>${items.length} полей</small></summary><div class="field-body">${items.map((f, index) => `<label class="field"><span class="field-label">${e(f.label)} <small>${index + 1}</small></span>${f.type === "text" && currentValue(f).length > 90 ? `<textarea data-field="${e(f.id)}">${e(currentValue(f))}</textarea>` : `<input data-field="${e(f.id)}" value="${e(currentValue(f))}">`}</label>`).join("")}</div></details>`,
        )
        .join("");
    }
    $$("[data-field]", box).forEach(
      (input) =>
        (input.oninput = () => {
          const f = p.fields.find((f) => f.id === input.dataset.field);
          state.changes[f.id] =
            f.type === "image"
              ? { value: input.value, alt: state.changes[f.id]?.alt ?? f.alt }
              : input.value;
          dirty();
        }),
    );
    $$("[data-alt]", box).forEach(
      (input) =>
        (input.oninput = () => {
          const f = p.fields.find((f) => f.id === input.dataset.alt);
          state.changes[f.id] = { value: currentValue(f), alt: input.value };
          dirty();
        }),
    );
    $$("[data-pick]", box).forEach(
      (b) =>
        (b.onclick = () =>
          pickMedia((asset) => {
            const f = p.fields.find((f) => f.id === b.dataset.pick);
            state.changes[f.id] = {
              value: encodeURI(asset.url),
              alt: state.changes[f.id]?.alt ?? f.alt,
            };
            dirty();
            draw();
          })),
    );
  };
  $("#field-region").onchange = draw;
  $("#field-search").oninput = draw;
  draw();
}
async function uploadFile(file) {
  if (!file) return null;
  if (file.size > 8 * 1024 * 1024)
    throw new Error("Изображение должно быть не больше 8 МБ");
  const data = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
  const asset = await api("upload", { name: file.name, data });
  state.media = await api("media");
  return asset;
}
function mediaTile(asset, attr = "data-image") {
  const replacement = state.settings?.mediaReplacements?.[asset.url]
    ? replacementFor(asset.url, state.settings.mediaReplacements)
    : null;
  return `<button class="media-item" ${attr}="${e(asset.url)}"><img loading="lazy" src="${e(encodeURI(replacement || asset.url))}" alt=""><span class="media-caption"><strong>${e(asset.name)}</strong><small>${bytes(asset.size)}${replacement ? " · Заменено" : asset.uploaded ? " · Загружено" : ""}</small></span></button>`;
}
async function pickMedia(onPick, uploadedOnly = false) {
  state.media = await api("media");
  const d = $("#media-dialog");
  d.innerHTML = `<div class="dialog-head"><h2>Выбрать изображение</h2><button class="quiet" id="close-picker">Закрыть</button></div><div class="dialog-search"><input type="search" id="picker-search" placeholder="Поиск по названию" aria-label="Поиск в медиатеке"><label class="field"><span class="field-note">Или загрузите JPG, PNG, WebP или GIF, до 8 МБ</span><input type="file" id="picker-upload" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Загрузить изображение"></label></div><div class="media-grid" id="picker-grid"></div><div class="media-controls"><span class="muted" id="picker-count"></span><button id="picker-more" class="small">Показать ещё</button></div>`;
  let limit = 24;
  const draw = () => {
    const q = $("#picker-search").value.toLowerCase(),
      items = state.media.filter(
        (a) =>
          (!uploadedOnly || a.uploaded) && a.name.toLowerCase().includes(q),
      );
    $("#picker-grid").innerHTML =
      items
        .slice(0, limit)
        .map((a) => mediaTile(a, "data-pick-asset"))
        .join("") || empty("Нет изображений", "Загрузите новое изображение.");
    $("#picker-count").textContent =
      `${Math.min(limit, items.length)} из ${items.length}`;
    $("#picker-more").hidden = limit >= items.length;
    $$("[data-pick-asset]", d).forEach(
      (b) =>
        (b.onclick = () => {
          const asset = state.media.find((a) => a.url === b.dataset.pickAsset);
          d.close();
          onPick(asset);
        }),
    );
  };
  $("#close-picker").onclick = () => d.close();
  $("#picker-search").oninput = () => {
    limit = 24;
    draw();
  };
  $("#picker-more").onclick = () => {
    limit += 24;
    draw();
  };
  $("#picker-upload").onchange = (ev) =>
    task(ev.target, async () => {
      const asset = await uploadFile(ev.target.files[0]);
      if (asset) {
        d.close();
        onPick(asset);
      }
    });
  draw();
  if (!d.open) d.showModal();
}
function mediaView() {
  state.mediaLimit = 24;
  $("#content").innerHTML =
    head(
      "Медиатека",
      "Загружайте изображения и заменяйте их на отдельных страницах или сразу по всему сайту.",
      `<label class="button primary">${icon("upload")} Загрузить изображение<input type="file" id="media-upload" accept="image/jpeg,image/png,image/webp,image/gif" hidden></label>`,
    ) +
    `<div class="card"><div class="toolbar"><input type="search" id="media-search" placeholder="Поиск изображений" aria-label="Поиск изображений"><select id="media-filter" aria-label="Источник изображений"><option value="all">Все изображения</option><option value="uploaded">Загруженные</option><option value="replaced">Заменённые на сайте</option></select></div><div class="media-grid" id="media-grid"></div><div class="media-controls"><span id="media-count" class="muted"></span><button id="media-more">Показать ещё</button></div></div><p class="footer-help">Замена через медиатеку применяется ко всем использованиям исходного изображения, включая фоны. Исходный файл сохраняется: замену можно отменить.</p>`;
  const draw = () => {
    const q = $("#media-search").value.toLowerCase(),
      filter = $("#media-filter").value,
      items = state.media.filter(
        (a) =>
          a.name.toLowerCase().includes(q) &&
          (filter === "all" ||
            (filter === "uploaded" && a.uploaded) ||
            (filter === "replaced" && state.settings.mediaReplacements[a.url])),
      );
    $("#media-grid").innerHTML =
      items
        .slice(0, state.mediaLimit)
        .map((a) => mediaTile(a))
        .join("") || empty("Изображения не найдены");
    $("#media-count").textContent =
      `${Math.min(state.mediaLimit, items.length)} из ${items.length}`;
    $("#media-more").hidden = state.mediaLimit >= items.length;
    $$("[data-image]").forEach(
      (b) =>
        (b.onclick = () =>
          mediaDetail(state.media.find((a) => a.url === b.dataset.image))),
    );
  };
  $("#media-search").oninput = () => {
    state.mediaLimit = 24;
    draw();
  };
  $("#media-filter").onchange = () => {
    state.mediaLimit = 24;
    draw();
  };
  $("#media-more").onclick = () => {
    state.mediaLimit += 24;
    draw();
  };
  $("#media-upload").onchange = (ev) =>
    task(ev.target, async () => {
      const asset = await uploadFile(ev.target.files[0]);
      if (asset) {
        toast("Изображение добавлено в медиатеку");
        draw();
      }
    });
  draw();
}
function mediaDetail(asset) {
  const d = $("#media-dialog"),
    replacement = state.settings.mediaReplacements[asset.url]
      ? replacementFor(asset.url, state.settings.mediaReplacements)
      : null;
  d.innerHTML = `<div class="dialog-head"><h2>Изображение</h2><button class="quiet" id="close-detail">Закрыть</button></div><div class="dialog-body"><img class="detail-image" src="${e(encodeURI(replacement || asset.url))}" alt=""><h3>${e(asset.name)}</h3><p>${e(asset.url)} · ${bytes(asset.size)}</p><p class="muted">Чтобы заменить изображение только на одной странице, откройте её редактор. Кнопка ниже заменит все использования этого файла на сайте.</p><div class="actions"><button class="primary" id="replace-everywhere">Заменить во всём сайте</button>${replacement ? '<button id="undo-image">Вернуть исходное изображение</button>' : ""}<a class="button" href="${e(encodeURI(replacement || asset.url))}" target="_blank" rel="noopener">Открыть оригинал ↗</a></div></div>`;
  $("#close-detail").onclick = () => d.close();
  $("#replace-everywhere").onclick = () => {
    d.close();
    pickMedia(
      (next) =>
        task(null, async () => {
          state.settings = await api("settings", {
            version: state.settings.version,
            replace: { from: asset.url, to: next.url },
          });
          mediaView();
          toast("Изображение заменено на сайте");
        }),
      true,
    );
  };
  if ($("#undo-image"))
    $("#undo-image").onclick = (ev) =>
      task(ev.currentTarget, async () => {
        state.settings = await api("settings", {
          version: state.settings.version,
          undoReplacement: asset.url,
        });
        d.close();
        mediaView();
        toast("Исходное изображение восстановлено");
      });
  if (!d.open) d.showModal();
}
const contactLabels = {
  company: "Название компании",
  email: "Электронная почта",
  phone: "Основной телефон",
  mobile: "Мобильный телефон",
  fax: "Факс",
  office: "Адрес офиса",
  warehouse: "Адрес склада",
  officeMap: "Карта офиса — адрес виджета",
  warehouseMap: "Карта склада — адрес виджета",
};
function contactsView() {
  const c = state.settings.contacts;
  $("#content").innerHTML =
    head(
      "Контактная информация",
      "Общие контакты компании на всех страницах сайта.",
    ) +
    `<form id="contacts-form"><section class="card card-pad form-section"><h2>Компания</h2><div class="form-grid">${["company", "email"].map((k) => field(contactLabels[k], k, c[k], { type: k === "email" ? "email" : "text" })).join("")}</div></section><section class="card card-pad form-section"><h2>Телефоны</h2><div class="form-grid">${["phone", "mobile", "fax"].map((k) => field(contactLabels[k], k, c[k], { max: 60 })).join("")}</div></section><section class="card card-pad form-section"><h2>Офис и склад</h2><div class="form-grid">${[
      "office",
      "warehouse",
      "officeMap",
      "warehouseMap",
    ]
      .filter((k) => Object.hasOwn(c, k))
      .map((k) =>
        field(contactLabels[k], k, c[k], { area: !k.endsWith("Map") }),
      )
      .join(
        "",
      )}</div></section><div class="form-footer"><p>Сохранённые контакты сразу появятся на сайте. Особые контакты внутри статей можно изменить в редакторе страницы.</p><button class="primary" type="submit">Сохранить контакты</button></div></form>`;
  $$("input,textarea", $("#contacts-form")).forEach(
    (input) => (input.oninput = dirty),
  );
  $("#contacts-form").onsubmit = (ev) => {
    ev.preventDefault();
    task($("button[type=submit]", ev.target), async () => {
      state.settings = await api("settings", {
        version: state.settings.version,
        contacts: Object.fromEntries(new FormData(ev.target)),
      });
      state.dirty = false;
      toast("Контакты обновлены на сайте");
    });
  };
}
async function inquiriesView() {
  const rows = await api("inquiries");
  $("#content").innerHTML =
    head(
      "Заявки с сайта",
      "Последние 200 сообщений, сохранённых через контактную форму.",
    ) +
    `<div class="note">Заявки сохраняются здесь. Автоматическая пересылка на почту пока не подключена.</div>${rows.length ? rows.map((row) => `<article class="card inquiry"><div class="inquiry-head"><div><h3>${e(row.subject)}</h3><small>${e(row.name)} · <a href="mailto:${e(row.email)}">${e(row.email)}</a></small></div><small>${date(row.createdAt)}</small></div><p>${e(row.message)}</p></article>`).join("") : `<div class="card">${empty("Новых заявок пока нет", "Сообщения посетителей появятся в этом разделе.")}</div>`}`;
}
function settingsView() {
  $("#content").innerHTML =
    head("Настройки доступа", "Управление учётной записью администратора.") +
    `<section class="card card-pad password-wrap"><h2>Сменить пароль</h2><p class="muted">Логин: <strong>${e(state.session.username)}</strong>. После смены пароля остальные сеансы будут завершены.</p><form id="password-form">${field("Текущий пароль", "currentPassword", "", { type: "password", max: 128 })}${field("Новый пароль", "password", "", { type: "password", max: 128, note: "От 12 до 128 символов." })}${field("Повторите новый пароль", "confirm", "", { type: "password", max: 128 })}<button class="primary" type="submit">Обновить пароль</button></form></section><p class="footer-help">Изменения контента и изображения хранятся отдельно от исходного кода и сохраняются при обновлении сайта. Предыдущие публикации доступны в истории страниц.</p>`;
  $("[name=currentPassword]").autocomplete = "current-password";
  $("#password-form").onsubmit = (ev) => {
    ev.preventDefault();
    task($("button[type=submit]", ev.target), async () => {
      const data = Object.fromEntries(new FormData(ev.target));
      if (data.password !== data.confirm)
        throw new Error("Пароли не совпадают");
      state.session = await api("password", data);
      ev.target.reset();
      toast("Пароль обновлён");
    });
  };
}
let previousHash = location.hash;
async function route() {
  if (!state.session) return;
  const hash = location.hash.slice(1) || "home";
  if (
    state.dirty &&
    location.hash !== previousHash &&
    !confirm("Перейти без сохранения изменений?")
  ) {
    history.replaceState(null, "", location.pathname + previousHash);
    return;
  }
  previousHash = location.hash;
  state.dirty = false;
  const params = new URLSearchParams(hash);
  const pageId = params.get("page"),
    active = pageId ? "pages" : hash;
  shell(active);
  $("#content").innerHTML = '<div class="loading">Загрузка…</div>';
  try {
    if (pageId) await editor(pageId, params.get("tab") || "text");
    else if (hash === "pages" || hash === "seo") pagesView(hash === "seo");
    else if (hash === "media") mediaView();
    else if (hash === "contacts") contactsView();
    else if (hash === "inquiries") await inquiriesView();
    else if (hash === "settings") settingsView();
    else overview();
  } catch (err) {
    $("#content").innerHTML = empty("Не удалось открыть раздел", err.message);
  }
}
async function start() {
  [state.pages, state.media, state.settings] = await Promise.all([
    api("pages"),
    api("media"),
    api("settings"),
  ]);
  await route();
}
window.addEventListener("hashchange", () => route());
window.addEventListener("beforeunload", (event) => {
  if (state.dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
try {
  state.session = await api("session");
  await start();
} catch {
  await loginView();
}
