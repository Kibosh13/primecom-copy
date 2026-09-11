import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { withFavicon } from "../branding.mjs";
import { withInquiryForm } from "../inquiry-ui.mjs";
import {
  pageModel,
  editPage,
  applyGlobals,
  defaultContacts,
  safeUrl,
  replacementFor,
} from "./model.mjs";
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + "." + randomUUID() + ".tmp";
  try {
    fs.writeFileSync(temp, JSON.stringify(value), { mode: 0o600 });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
export function withLock(dir, fn) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, ".write-lock");
  let fd;
  try {
    fd = fs.openSync(file, "wx", 0o600);
  } catch (e) {
    if (e.code === "EEXIST")
      throw Object.assign(
        new Error(
          "Другое изменение ещё сохраняется. Повторите через несколько секунд.",
        ),
        { status: 409 },
      );
    throw e;
  }
  try {
    return fn();
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(file);
  }
}
export class ContentStore {
  constructor(root, dataDir) {
    this.root = root;
    this.dir = dataDir;
    this.public = path.join(root, "public");
    this.routes = JSON.parse(
      fs.readFileSync(path.join(root, "routes.json"), "utf8"),
    );
    this.pages = new Map();
    const categories = {
      hydrogen: "Каталоги красок",
      micropul: "Micropul",
      "novosti-i-stati": "Новости и статьи",
      "o-kompanii": "О компании",
      oborudovanie: "Оборудование",
      produktsiya: "Продукция",
      "sredstva-dlya-obrabotki-poverkhnosti": "Химия для металла",
    };
    for (const [url, r] of Object.entries(this.routes)) {
      if (r.redirect) continue;
      const id = digest(r.file).slice(0, 16);
      if (!this.pages.has(id))
        this.pages.set(id, {
          id,
          file: r.file,
          url,
          title: r.title,
          category:
            url === "/"
              ? "Главная"
              : url.startsWith("/index.php")
                ? "Старые адреса"
                : categories[url.split("/")[1].replace(".html", "")] ||
                  "Другие страницы",
        });
    }
  }
  record(id) {
    const r = this.pages.get(id);
    if (!r)
      throw Object.assign(new Error("Страница не найдена"), { status: 404 });
    return r;
  }
  state(id) {
    this.record(id);
    return readJson(path.join(this.dir, "pages", id + ".json"), {
      version: 0,
      draft: null,
      published: null,
      history: [],
    });
  }
  html(id, { draft = false } = {}) {
    const s = this.state(id);
    return (
      (draft ? s.draft : null) ||
      s.published ||
      fs.readFileSync(path.join(this.root, this.record(id).file), "utf8")
    );
  }
  settings() {
    const saved = readJson(path.join(this.dir, "settings.json"), {});
    return {
      version: saved.version || 0,
      contacts: { ...defaultContacts, ...saved.contacts },
      mediaReplacements: saved.mediaReplacements || {},
    };
  }
  list() {
    return [...this.pages.values()].map((r) => {
      const s = this.state(r.id);
      const m = pageModel(this.html(r.id, { draft: true }));
      return {
        ...r,
        title: m.seo.title || r.title,
        description: m.seo.description,
        version: s.version,
        hasDraft: !!s.draft,
        updatedAt: s.updatedAt || null,
        seo: m.seo,
      };
    });
  }
  page(id) {
    const r = this.record(id),
      s = this.state(id),
      m = pageModel(this.html(id, { draft: true }));
    return {
      ...r,
      ...m,
      title: m.seo.title || r.title,
      version: s.version,
      hasDraft: !!s.draft,
      history: s.history.map(({ html, ...entry }) => entry),
    };
  }
  save(id, { version, changes = {}, seo, action = "draft", historyId }) {
    return withLock(this.dir, () => {
      const s = this.state(id);
      if (version !== s.version)
        throw Object.assign(
          new Error(
            "Другой редактор уже изменил страницу. Обновите её, чтобы не потерять правки.",
          ),
          { status: 409 },
        );
      if (action === "restore") {
        const old = s.history.find((h) => h.id === historyId);
        if (!old) throw new Error("Версия не найдена");
        s.draft = old.html;
      } else if (action === "discard") s.draft = null;
      else if (action === "draft" || action === "publish") {
        const html = editPage(this.html(id, { draft: true }), changes, seo);
        if (action === "publish") {
          s.history.unshift({
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            html: this.html(id),
          });
          s.history = s.history.slice(0, 20);
          s.published = html;
          s.draft = null;
        } else s.draft = html;
      } else throw new Error("Неизвестное действие");
      s.version++;
      s.updatedAt = new Date().toISOString();
      writeJson(path.join(this.dir, "pages", id + ".json"), s);
      return this.page(id);
    });
  }
  saveSettings(input) {
    return withLock(this.dir, () => {
      const current = this.settings();
      if (input.version !== current.version)
        throw Object.assign(
          new Error("Настройки изменились. Обновите страницу."),
          { status: 409 },
        );
      if (input.contacts) {
        for (const [k, v] of Object.entries(input.contacts)) {
          if (
            !Object.hasOwn(defaultContacts, k) ||
            typeof v !== "string" ||
            v.length > 1000 ||
            /[<>\x00-\x08]/.test(v)
          )
            throw new Error("Некорректные контактные данные");
          current.contacts[k] = v.trim();
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current.contacts.email))
          throw new Error("Введите корректную почту");
        if (!/^\+?[\d\s()-]{7,30}$/.test(current.contacts.phone))
          throw new Error("Введите корректный телефон");
      }
      for (const key of ["officeMap", "warehouseMap"])
        if (!safeUrl(current.contacts[key], { frame: true }))
          throw new Error("Карта должна использовать безопасный URL https");
      if (input.replace) {
        const { from, to } = input.replace;
        const known = new Set(this.media().map((x) => x.url));
        if (!known.has(from) || !known.has(to) || !to.startsWith("/uploads/"))
          throw new Error("Выберите исходное и загруженное изображение");
        if (
          from === to ||
          replacementFor(to, current.mediaReplacements) === from
        )
          throw new Error("Нельзя заменить изображение самим собой");
        current.mediaReplacements[from] = to;
      }
      if (input.undoReplacement) {
        if (typeof input.undoReplacement !== "string")
          throw new Error("Некорректное изображение");
        delete current.mediaReplacements[input.undoReplacement];
      }
      writeJson(
        path.join(
          this.dir,
          "history",
          "settings-" + Date.now() + "-" + randomUUID() + ".json",
        ),
        this.settings(),
      );
      current.version++;
      writeJson(path.join(this.dir, "settings.json"), current);
      return current;
    });
  }
  render(id, draft = false) {
    const settings = this.settings();
    return withFavicon(withInquiryForm(applyGlobals(
      this.html(id, { draft }),
      settings,
      Object.keys(settings.mediaReplacements).length
        ? String(settings.version)
        : "",
    )));
  }
  renderFile(file) {
    const id = digest(file).slice(0, 16);
    return this.pages.has(id) ? this.render(id) : null;
  }
  media() {
    const entries = [],
      index = readJson(path.join(this.dir, "uploads-index.json"), {});
    const walk = (dir, prefix) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name),
          url = prefix + "/" + e.name;
        if (e.isDirectory()) walk(f, url);
        else if (e.isFile() && /\.(png|jpe?g|webp|gif|svg)$/i.test(e.name))
          entries.push({
            url,
            name: index[e.name]?.name || e.name,
            size: fs.statSync(f).size,
            uploaded: prefix.startsWith("/uploads"),
            createdAt: index[e.name]?.createdAt || null,
          });
      }
    };
    walk(this.public, "");
    walk(path.join(this.dir, "uploads"), "/uploads");
    return entries.sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  }
  upload({ name, data }) {
    if (
      typeof name !== "string" ||
      typeof data !== "string" ||
      data.length > 12 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(data)
    )
      throw new Error("Некорректное изображение");
    const bytes = Buffer.from(data, "base64");
    if (bytes.length > 8 * 1024 * 1024 || bytes.length < 12)
      throw new Error("Размер изображения: от 12 байт до 8 МБ");
    let ext;
    if (
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      ext = "png";
    else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
      ext = "jpg";
    else if (/^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6))) ext = "gif";
    else if (
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    )
      ext = "webp";
    else throw new Error("Поддерживаются JPG, PNG, WebP и GIF");
    return withLock(this.dir, () => {
      const dir = path.join(this.dir, "uploads");
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const used = fs
        .readdirSync(dir)
        .reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0);
      if (used + bytes.length > 2 * 1024 ** 3)
        throw new Error("Достигнут лимит медиатеки 2 ГБ");
      const file = randomUUID() + "." + ext;
      fs.writeFileSync(path.join(dir, file), bytes, {
        flag: "wx",
        mode: 0o600,
      });
      const indexFile = path.join(this.dir, "uploads-index.json"),
        index = readJson(indexFile, {});
      index[file] = {
        name: name.replace(/[\x00-\x1f]/g, "").slice(0, 200),
        createdAt: new Date().toISOString(),
      };
      writeJson(indexFile, index);
      return {
        url: "/uploads/" + file,
        ...index[file],
        size: bytes.length,
        uploaded: true,
      };
    });
  }
  stylesheet(file) {
    let url;
    try {
      url = new URL(file, "https://prime-com.ru");
    } catch {
      throw new Error("Некорректный файл");
    }
    if (url.hostname !== "prime-com.ru") throw new Error("Некорректный файл");
    const p = decodeURIComponent(url.pathname);
    const full = path.resolve(this.public, "." + p);
    if (!full.startsWith(this.public + path.sep) || !full.endsWith(".css"))
      throw new Error("Некорректный файл");
    const content = fs.readFileSync(full, "utf8"),
      map = this.settings().mediaReplacements;
    return content.replace(
      /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,
      (match, q, value) => {
        if (/^(data:|#)/.test(value)) return match;
        let asset;
        try {
          asset = new URL(value, url);
        } catch {
          return match;
        }
        const local = asset.hostname === "prime-com.ru",
          key = decodeURIComponent(asset.pathname);
        const next = local
          ? map[key]
            ? replacementFor(key, map)
            : asset.pathname + asset.search + asset.hash
          : asset.href;
        return safeUrl(next, { image: true }) ? `url("${next}")` : match;
      },
    );
  }
  script(file) {
    const url = new URL(file, "https://prime-com.ru");
    const full = path.resolve(
      this.public,
      "." + decodeURIComponent(url.pathname),
    );
    if (
      url.hostname !== "prime-com.ru" ||
      !full.startsWith(this.public + path.sep) ||
      !full.endsWith(".js")
    )
      throw new Error("Некорректный файл");
    let content = fs.readFileSync(full, "utf8");
    const map = this.settings().mediaReplacements;
    for (const from of Object.keys(map))
      for (const variant of [from, encodeURI(from)])
        content = content.split(variant).join(replacementFor(from, map));
    return content;
  }
}
