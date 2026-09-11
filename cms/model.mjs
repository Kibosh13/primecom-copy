import { parse, serialize } from "parse5";

export const attr = (n, key) =>
  n.attrs?.find((a) => a.name === key)?.value || "";
export function setAttr(n, key, value) {
  n.attrs ||= [];
  const a = n.attrs.find((a) => a.name === key);
  if (a) a.value = String(value);
  else n.attrs.push({ name: key, value: String(value) });
}
export const textContent = (n) =>
  n.nodeName === "#text"
    ? n.value
    : (n.childNodes || []).map(textContent).join("");
export function replacementFor(value, map) {
  const seen = new Set();
  while (map[value] && !seen.has(value)) {
    seen.add(value);
    value = map[value];
  }
  return value;
}
export function walk(n, fn, ids = []) {
  fn(n, ids);
  for (const [i, c] of (n.childNodes || []).entries()) walk(c, fn, [...ids, i]);
}
const skip = new Set([
  "script",
  "style",
  "noscript",
  "svg",
  "template",
  "head",
]);
const tagLabels = {
  h1: "Заголовок H1",
  h2: "Заголовок H2",
  h3: "Заголовок H3",
  p: "Абзац",
  li: "Пункт списка",
  td: "Ячейка таблицы",
  th: "Заголовок таблицы",
  a: "Текст ссылки",
  button: "Кнопка",
  label: "Подпись поля",
};
function region(n) {
  for (let p = n; p; p = p.parentNode) {
    const id = attr(p, "id");
    if (id === "g-navigation" || id === "g-offcanvas") return "Шапка и меню";
    if (id === "g-footer") return "Подвал";
  }
  return "Содержимое страницы";
}
function nearestLabel(n) {
  for (let p = n.parentNode; p; p = p.parentNode)
    if (tagLabels[p.tagName]) return tagLabels[p.tagName];
  return "Текст";
}
function blocked(n) {
  for (let p = n.parentNode; p; p = p.parentNode)
    if (skip.has(p.tagName)) return true;
  return false;
}
function find(doc, predicate) {
  let result;
  walk(doc, (n) => {
    if (!result && predicate(n)) result = n;
  });
  return result;
}
function metadata(doc, name, property = false) {
  return attr(
    find(
      doc,
      (n) =>
        n.tagName === "meta" &&
        attr(n, property ? "property" : "name").toLowerCase() === name,
    ) || {},
    "content",
  );
}
export function pageModel(html) {
  const doc = parse(html),
    fields = [];
  let section = "Начало страницы";
  walk(doc, (n, path) => {
    if (blocked(n)) return;
    if (/^h[1-4]$/.test(n.tagName))
      section = textContent(n).trim().slice(0, 100) || section;
    const id = path.join("."),
      common = { region: region(n), section };
    if (n.nodeName === "#text" && n.value.trim())
      fields.push({
        ...common,
        id: "t:" + id,
        type: "text",
        label: nearestLabel(n),
        value: n.value.trim(),
      });
    if (n.tagName === "img")
      fields.push({
        ...common,
        id: "i:" + id,
        type: "image",
        label: attr(n, "alt") || "Изображение",
        value: attr(n, "src"),
        alt: attr(n, "alt"),
      });
    if (n.tagName === "a" && attr(n, "href"))
      fields.push({
        ...common,
        id: "u:" + id,
        type: "url",
        label:
          textContent(n).trim().slice(0, 100) ||
          attr(n, "aria-label") ||
          "Ссылка",
        value: attr(n, "href"),
      });
    if (n.tagName === "iframe")
      fields.push({
        ...common,
        id: "f:" + id,
        type: "url",
        label: attr(n, "title") || "Встроенная карта / видео",
        value: attr(n, "src"),
      });
    for (const key of ["placeholder", "title", "aria-label"])
      if (n.tagName && attr(n, key))
        fields.push({
          ...common,
          id: `a:${id}:${key}`,
          type: "text",
          label: key === "placeholder" ? "Подсказка поля" : "Подпись элемента",
          value: attr(n, key),
        });
    if (
      n.tagName === "input" &&
      ["submit", "button", "reset"].includes(attr(n, "type"))
    )
      fields.push({
        ...common,
        id: `a:${id}:value`,
        type: "text",
        label: "Кнопка",
        value: attr(n, "value"),
      });
    const style = attr(n, "style");
    if (n.tagName && /url\(/i.test(style)) {
      for (const [i, m] of [
        ...style.matchAll(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/gi),
      ].entries())
        fields.push({
          ...common,
          id: `b:${id}:${i}`,
          type: "image",
          label: "Фоновое изображение",
          value: m[1].trim(),
          alt: null,
        });
    }
  });
  const titleNode = find(doc, (n) => n.tagName === "title");
  return {
    fields,
    seo: {
      title: titleNode ? textContent(titleNode) : "",
      description: metadata(doc, "description"),
      keywords: metadata(doc, "keywords"),
      canonical: attr(
        find(
          doc,
          (n) => n.tagName === "link" && attr(n, "rel") === "canonical",
        ) || {},
        "href",
      ),
      robots: metadata(doc, "robots") || "index, follow",
      ogTitle: metadata(doc, "og:title", true),
      ogDescription: metadata(doc, "og:description", true),
      ogImage: metadata(doc, "og:image", true),
    },
  };
}
export function safeUrl(value, { image = false, frame = false } = {}) {
  if (
    typeof value !== "string" ||
    value.length > 2500 ||
    /[\x00-\x20\\<>"']/u.test(value)
  )
    return false;
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//"))
    return !value.split(/[/?#]/).includes("..");
  if (
    !image &&
    !frame &&
    (/^(mailto:|tel:)/i.test(value) || value.startsWith("#"))
  )
    return true;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" || (!image && !frame && u.protocol === "http:")
    );
  } catch {
    return false;
  }
}
function putMeta(doc, name, value, property = false) {
  const head = find(doc, (n) => n.tagName === "head"),
    key = property ? "property" : "name";
  let n = find(doc, (n) => n.tagName === "meta" && attr(n, key) === name);
  if (!n) {
    n = {
      nodeName: "meta",
      tagName: "meta",
      attrs: [],
      namespaceURI: "http://www.w3.org/1999/xhtml",
      parentNode: head,
      childNodes: [],
    };
    head.childNodes.push(n);
    setAttr(n, key, name);
  }
  setAttr(n, "content", value);
}
export function editPage(html, changes, seo) {
  const model = pageModel(html),
    doc = parse(html),
    nodes = new Map();
  walk(doc, (n, p) => nodes.set(p.join("."), n));
  if (!changes || typeof changes !== "object" || Array.isArray(changes))
    throw new Error("Некорректные поля страницы");
  const known = new Map(model.fields.map((f) => [f.id, f]));
  for (const [id, input] of Object.entries(changes)) {
    const f = known.get(id);
    if (!f) throw new Error("Страница изменилась. Обновите редактор.");
    const value = typeof input === "object" ? input?.value : input;
    if (typeof value !== "string" || value.length > 50000)
      throw new Error("Слишком длинный текст");
    const [type, key, extra] = id.split(":"),
      n = nodes.get(key);
    if (f.type === "image" && !safeUrl(value, { image: true }))
      throw new Error("Некорректный адрес изображения");
    if (f.type === "url" && !safeUrl(value, { frame: type === "f" }))
      throw new Error("Недопустимый адрес ссылки");
    if (type === "t")
      n.value =
        (n.value.match(/^\s*/)?.[0] || "") +
        value +
        (n.value.match(/\s*$/)?.[0] || "");
    if (type === "a") setAttr(n, extra, value);
    if (type === "u") setAttr(n, "href", value);
    if (type === "f") setAttr(n, "src", value);
    if (type === "i") {
      setAttr(n, "src", value);
      n.attrs = n.attrs.filter(
        (a) => a.name !== "srcset" && a.name !== "data-src",
      );
      if (input.alt !== undefined)
        setAttr(n, "alt", String(input.alt).slice(0, 1000));
    }
    if (type === "b") {
      let i = 0;
      setAttr(
        n,
        "style",
        attr(n, "style").replace(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/gi, (m) =>
          i++ === Number(extra) ? `url("${value}")` : m,
        ),
      );
    }
  }
  if (seo) {
    for (const [key, value] of Object.entries(seo))
      if (
        typeof value !== "string" ||
        value.length > 5000 ||
        !Object.hasOwn(model.seo, key)
      )
        throw new Error("Некорректные SEO-поля");
    if (seo.canonical && !safeUrl(seo.canonical))
      throw new Error("Некорректный canonical");
    if (seo.ogImage && !safeUrl(seo.ogImage, { image: true }))
      throw new Error("Некорректное изображение для соцсетей");
    const title = find(doc, (n) => n.tagName === "title");
    if (seo.title !== undefined)
      title.childNodes = [
        { nodeName: "#text", value: seo.title, parentNode: title },
      ];
    for (const key of ["description", "keywords", "robots"])
      if (seo[key] !== undefined) putMeta(doc, key, seo[key]);
    for (const [key, name] of Object.entries({
      ogTitle: "og:title",
      ogDescription: "og:description",
      ogImage: "og:image",
    }))
      if (seo[key] !== undefined) putMeta(doc, name, seo[key], true);
    if (seo.canonical !== undefined) {
      let n = find(
        doc,
        (n) => n.tagName === "link" && attr(n, "rel") === "canonical",
      );
      if (!n) {
        const head = find(doc, (n) => n.tagName === "head");
        n = {
          nodeName: "link",
          tagName: "link",
          attrs: [],
          namespaceURI: "http://www.w3.org/1999/xhtml",
          parentNode: head,
          childNodes: [],
        };
        head.childNodes.push(n);
        setAttr(n, "rel", "canonical");
      }
      setAttr(n, "href", seo.canonical);
    }
  }
  return serialize(doc);
}
export const defaultContacts = {
  company: "ООО «Торговый Дом „ПраймКом“»",
  email: "info@prime-com.ru",
  phone: "+7 (495) 968-06-15",
  mobile: "8 (916) 627-22-15",
  fax: "+7 (499) 557-04-60",
  office: "Москва, ул. Руставели, д. 14, стр. 6, офис 14",
  warehouse: "Москва, Бирюлёво Западное, ул. Никопольская, д. 4, стр. 1",
  warehouseMap: "https://yandex.ru/map-widget/v1/-/CBUJvOsY~C",
  officeMap:
    "https://yandex.ru/map-widget/v1/?ll=37.597872%2C55.813172&z=17&mode=search&text=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0%2C%20%D1%83%D0%BB%D0%B8%D1%86%D0%B0%20%D0%A0%D1%83%D1%81%D1%82%D0%B0%D0%B2%D0%B5%D0%BB%D0%B8%2C%2014%2C%20%D1%81%D1%82%D1%80%D0%BE%D0%B5%D0%BD%D0%B8%D0%B5%206",
};
export function applyGlobals(html, settings, cssVersion = "") {
  const contacts = { ...defaultContacts, ...settings.contacts },
    replacements = settings.mediaReplacements || {};
  const doc = parse(html);
  const replace = (value) => {
    for (const key of Object.keys(defaultContacts))
      if (contacts[key] !== defaultContacts[key]) {
        if (["phone", "mobile", "fax"].includes(key)) {
          const digits = defaultContacts[key].replace(/\D/g, "");
          const pattern = new RegExp(
            "(?<!\\d)\\+?[78][\\s()–-]*" +
              digits.slice(1).split("").join("[\\s()–-]*") +
              "(?!\\d)",
            "g",
          );
          value = value.replace(pattern, () => contacts[key]);
        } else value = value.split(defaultContacts[key]).join(contacts[key]);
      }
    return value;
  };
  const media = (value) => {
    try {
      const u = new URL(value, "https://prime-com.ru"),
        key = decodeURIComponent(u.pathname);
      return ["prime-com.ru", "www.prime-com.ru"].includes(u.hostname) &&
        replacements[key]
        ? replacementFor(key, replacements)
        : value;
    } catch {
      return value;
    }
  };
  walk(doc, (n) => {
    if (n.nodeName === "#text" && !blocked(n)) n.value = replace(n.value);
    for (const a of n.attrs || []) {
      a.value = replace(a.value);
      if (a.name === "href" && a.value.startsWith("tel:"))
        a.value = "tel:" + a.value.slice(4).replace(/[^+\d]/g, "");
      if (
        a.name === "href" &&
        a.value.startsWith("https://yandex.ru/maps/?text=")
      )
        for (const key of ["office", "warehouse"])
          if (contacts[key] !== defaultContacts[key])
            a.value = a.value.replace(
              encodeURIComponent(defaultContacts[key]),
              encodeURIComponent(contacts[key]),
            );
      for (const key of ["phone", "mobile", "fax"])
        if (
          a.value.toLowerCase() ===
            `tel:+${defaultContacts[key].replace(/\D/g, "")}` ||
          a.value.toLowerCase() ===
            `tel:${defaultContacts[key].replace(/[^+\d]/g, "")}`
        )
          a.value = "tel:" + contacts[key].replace(/[^+\d]/g, "");
      if (["src", "href", "poster", "data-src"].includes(a.name))
        a.value = media(a.value);
      if (a.name === "srcset")
        a.value = a.value
          .split(",")
          .map((item) => {
            const [url, ...size] = item.trim().split(/\s+/);
            return [media(url), ...size].join(" ");
          })
          .join(", ");
      if (a.name === "style")
        a.value = a.value.replace(
          /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,
          (_, q, url) => `url("${media(url)}")`,
        );
    }
    if (
      cssVersion &&
      n.tagName === "link" &&
      attr(n, "rel") === "stylesheet" &&
      attr(n, "href").startsWith("/")
    )
      setAttr(
        n,
        "href",
        "/cms-assets/style?file=" +
          encodeURIComponent(attr(n, "href")) +
          "&v=" +
          cssVersion,
      );
    if (cssVersion && n.tagName === "script" && attr(n, "src").startsWith("/"))
      setAttr(
        n,
        "src",
        "/cms-assets/script?file=" +
          encodeURIComponent(attr(n, "src")) +
          "&v=" +
          cssVersion,
      );
    if (n.tagName === "script" && !attr(n, "src"))
      for (const c of n.childNodes || [])
        if (c.nodeName === "#text")
          for (const from of Object.keys(replacements))
            for (const variant of [from, encodeURI(from)])
              c.value = c.value
                .split(variant)
                .join(replacementFor(from, replacements));
  });
  return serialize(doc);
}
