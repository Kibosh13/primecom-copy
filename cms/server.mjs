import fs from "node:fs";
import path from "node:path";
import { ContentStore, readJson } from "./store.mjs";
import { AdminAuth } from "./auth.mjs";

export function createCms(root) {
  const production = process.env.NODE_ENV === "production",
    dir = path.resolve(
      process.env.CMS_DATA_DIR || path.join(root, "data", "cms"),
    );
  const store = new ContentStore(root, dir),
    auth = new AdminAuth(dir, production);
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };
  const json = (res, status, value, extra = {}) => {
    res.writeHead(status, {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      ...extra,
    });
    res.end(JSON.stringify(value));
  };
  function sameOrigin(req) {
    try {
      const origin = new URL(req.headers.origin);
      return (
        origin.host === req.headers.host &&
        origin.protocol === (production ? "https:" : "http:")
      );
    } catch {
      return false;
    }
  }
  async function body(req, limit = 1024 * 1024) {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      throw Object.assign(new Error("Ожидается JSON"), { status: 415 });
    let size = 0,
      parts = [];
    for await (const p of req) {
      size += p.length;
      if (size > limit)
        throw Object.assign(new Error("Слишком большой запрос"), {
          status: 413,
        });
      parts.push(p);
    }
    try {
      return JSON.parse(Buffer.concat(parts).toString());
    } catch {
      throw new Error("Некорректный запрос");
    }
  }
  const html = (res, text, preview = false) => {
    res.writeHead(200, {
      ...headers,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": preview
        ? "sandbox allow-scripts; frame-ancestors 'self'; form-action 'none'"
        : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; frame-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    res.end(text);
  };
  async function handle(req, res, url) {
    const p = url.pathname;
    if (
      !p.startsWith("/admin") &&
      !p.startsWith("/api/admin") &&
      !p.startsWith("/uploads/") &&
      !["/cms-assets/style", "/cms-assets/script"].includes(p)
    )
      return false;
    try {
      if (p.startsWith("/uploads/")) {
        if (!["GET", "HEAD"].includes(req.method)) {
          json(res, 405, { error: "Метод не поддерживается" });
          return true;
        }
        const name = p.slice("/uploads/".length);
        if (!/^[a-f0-9-]{36}\.(png|jpg|gif|webp)$/.test(name))
          throw Object.assign(new Error("Файл не найден"), { status: 404 });
        const file = path.join(dir, "uploads", name);
        if (!fs.existsSync(file))
          throw Object.assign(new Error("Файл не найден"), { status: 404 });
        res.writeHead(200, {
          "Content-Type": {
            png: "image/png",
            jpg: "image/jpeg",
            gif: "image/gif",
            webp: "image/webp",
          }[name.split(".").pop()],
          "Content-Length": fs.statSync(file).size,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=31536000, immutable",
        });
        if (req.method === "HEAD") res.end();
        else fs.createReadStream(file).pipe(res);
        return true;
      }
      if (p === "/cms-assets/style" || p === "/cms-assets/script") {
        if (!["GET", "HEAD"].includes(req.method))
          throw Object.assign(new Error("Метод не поддерживается"), {
            status: 405,
          });
        const css = p.endsWith("/style"),
          content = css
            ? store.stylesheet(url.searchParams.get("file") || "")
            : store.script(url.searchParams.get("file") || "");
        res.writeHead(200, {
          "Content-Type": css
            ? "text/css; charset=utf-8"
            : "text/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(req.method === "HEAD" ? "" : content);
        return true;
      }
      if (
        production &&
        req.headers["x-forwarded-proto"] !== "https" &&
        !req.socket.encrypted
      ) {
        res.writeHead(308, { Location: "https://prime-com.ru" + req.url });
        res.end();
        return true;
      }
      if (p === "/admin" || p === "/admin/") {
        if (req.method !== "GET") {
          json(res, 405, { error: "Метод не поддерживается" });
          return true;
        }
        html(
          res,
          fs.readFileSync(path.join(root, "admin", "index.html"), "utf8"),
        );
        return true;
      }
      if (p === "/admin/app.js" || p === "/admin/style.css") {
        if (!["GET", "HEAD"].includes(req.method))
          throw Object.assign(new Error("Метод не поддерживается"), {
            status: 405,
          });
        res.writeHead(200, {
          ...headers,
          "Content-Type": p.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : "text/css; charset=utf-8",
        });
        res.end(
          req.method === "HEAD"
            ? ""
            : fs.readFileSync(path.join(root, "admin", path.basename(p))),
        );
        return true;
      }
      if (p === "/api/admin/status" && req.method === "GET") {
        json(res, 200, { configured: auth.configured() });
        return true;
      }
      if (
        req.method === "POST" &&
        (p === "/api/admin/login" || p === "/api/admin/setup")
      ) {
        if (!sameOrigin(req))
          throw Object.assign(new Error("Недопустимый источник запроса"), {
            status: 403,
          });
        const input = await body(req, 10000);
        const result = p.endsWith("/login")
          ? auth.login(req, input)
          : auth.setup(req, input);
        json(res, 200, result.session, { "Set-Cookie": result.cookie });
        return true;
      }
      const session = auth.session(req);
      if (!session)
        throw Object.assign(new Error("Войдите в панель управления"), {
          status: 401,
        });
      if (req.method === "GET") {
        if (p === "/api/admin/session") json(res, 200, session);
        else if (p === "/api/admin/pages") json(res, 200, store.list());
        else if (p === "/api/admin/page")
          json(res, 200, store.page(url.searchParams.get("id")));
        else if (p === "/api/admin/settings") json(res, 200, store.settings());
        else if (p === "/api/admin/media") json(res, 200, store.media());
        else if (p === "/api/admin/preview")
          html(res, store.render(url.searchParams.get("id"), true), true);
        else if (p === "/api/admin/inquiries") {
          const file = path.join(
            path.resolve(process.env.DATA_DIR || path.join(root, "data")),
            "inquiries.jsonl",
          );
          const rows = fs.existsSync(file)
            ? fs
                .readFileSync(file, "utf8")
                .trim()
                .split("\n")
                .filter(Boolean)
                .slice(-200)
                .map((line) => JSON.parse(line))
                .reverse()
            : [];
          json(res, 200, rows);
        } else throw Object.assign(new Error("Не найдено"), { status: 404 });
      } else if (req.method === "POST") {
        if (!sameOrigin(req) || req.headers["x-csrf-token"] !== session.csrf)
          throw Object.assign(
            new Error("Проверка безопасности не пройдена. Обновите страницу."),
            { status: 403 },
          );
        const input = await body(
          req,
          p === "/api/admin/upload" ? 12 * 1024 * 1024 : 1024 * 1024,
        );
        if (p === "/api/admin/page")
          json(res, 200, store.save(input.id, input));
        else if (p === "/api/admin/settings")
          json(res, 200, store.saveSettings(input));
        else if (p === "/api/admin/upload") json(res, 201, store.upload(input));
        else if (p === "/api/admin/logout")
          json(res, 200, { ok: true }, { "Set-Cookie": auth.logout(req) });
        else if (p === "/api/admin/password") {
          const result = auth.changePassword(input);
          json(res, 200, result.session, { "Set-Cookie": result.cookie });
        } else throw Object.assign(new Error("Не найдено"), { status: 404 });
      } else
        throw Object.assign(new Error("Метод не поддерживается"), {
          status: 405,
        });
    } catch (error) {
      json(res, error.status || 400, {
        error: error.code
          ? "Не удалось выполнить действие. Проверьте данные или повторите позже."
          : error.message,
      });
    }
    return true;
  }
  return { handle, store };
}
