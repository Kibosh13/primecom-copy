import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { passwordRecord, AdminAuth } from "../cms/auth.mjs";
import { writeJson, ContentStore, digest } from "../cms/store.mjs";
import { pageModel, editPage } from "../cms/model.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "primecom-cms-"));
const password = randomBytes(24).toString("base64url");
let server, base, cookie, csrf, pageId, initialVersion;
async function start() {
  server = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "0",
      HOST: "127.0.0.1",
      CMS_DATA_DIR: path.join(temp, "cms"),
      DATA_DIR: path.join(temp, "inquiries"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Server startup timeout")),
      15000,
    );
    server.stdout.on("data", (data) => {
      const match = String(data).match(/Local: (http:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    server.once("error", reject);
    server.once("exit", (code) => {
      if (code) reject(new Error("Server exited " + code));
    });
  });
}
async function request(
  route,
  body,
  { auth = true, origin = true, token = true } = {},
) {
  const headers = {};
  if (auth && cookie) headers.Cookie = cookie;
  if (body) {
    headers["Content-Type"] = "application/json";
    if (origin) headers.Origin = base;
    if (token && csrf) headers["X-CSRF-Token"] = csrf;
  }
  return fetch(base + route, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}
async function stop() {
  if (server && !server.killed) {
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
  }
}
before(async () => {
  writeJson(path.join(temp, "cms", "admin.json"), {
    username: "qa",
    ...passwordRecord(password),
    generation: "qa-generation",
  });
  await start();
});
after(async () => {
  await stop();
  fs.rmSync(temp, { recursive: true, force: true });
});
test("private APIs require authentication, same-origin requests and CSRF", async () => {
  assert.equal(
    (await request("/api/admin/pages", undefined, { auth: false })).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/admin/login",
        { username: "qa", password },
        { origin: false },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/admin/login", {
        username: "qa",
        password: "incorrect",
      })
    ).status,
    401,
  );
  const login = await request("/api/admin/login", { username: "qa", password });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie").split(";")[0];
  assert.match(login.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  csrf = (await login.json()).csrf;
  assert.equal(
    (
      await request(
        "/api/admin/settings",
        { version: 0, contacts: { email: "qa@example.invalid" } },
        { token: false },
      )
    ).status,
    403,
  );
  for (const url of [
    "/data/cms/admin.json",
    "/cms/auth.mjs",
    "/.git/config",
    "/content/admin.json",
  ])
    assert.ok([403, 404].includes((await request(url)).status));
  const admin = await request("/admin/");
  assert.equal(admin.status, 200);
  assert.match(
    admin.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  assert.match(admin.headers.get("x-robots-tag"), /noindex/);
});
test("draft, preview, publish, conflict protection, history and restart persistence", async () => {
  const pages = await (await request("/api/admin/pages")).json();
  assert.equal(pages.length, 75);
  pageId = pages.find((p) => p.url === "/produktsiya.html").id;
  let page = await (await request("/api/admin/page?id=" + pageId)).json();
  initialVersion = page.version;
  const field = page.fields.find(
    (f) =>
      f.type === "text" &&
      f.region === "Содержимое страницы" &&
      f.value.includes("Продукция для"),
  );
  const original = await (await request("/produktsiya.html")).text();
  assert.ok(!original.includes("Gantry Framework"));
  assert.ok(!original.includes("g-social-header"));
  assert.ok(!original.includes("g-logo-helium"));
  const changed = "Редактор проверен <script>alert(1)</script>";
  let saved = await request("/api/admin/page", {
    id: pageId,
    version: page.version,
    changes: { [field.id]: changed },
    seo: { title: "Тестовый SEO заголовок" },
    action: "draft",
  });
  assert.equal(saved.status, 200);
  page = await saved.json();
  assert.equal(page.hasDraft, true);
  assert.equal(await (await request("/produktsiya.html")).text(), original);
  const preview = await request("/api/admin/preview?id=" + pageId);
  assert.match(
    preview.headers.get("content-security-policy"),
    /sandbox allow-scripts/,
  );
  assert.match(await preview.text(), /Редактор проверен &lt;script&gt;/);
  assert.equal(
    (
      await request("/api/admin/page", {
        id: pageId,
        version: initialVersion,
        changes: {},
        action: "publish",
      })
    ).status,
    409,
  );
  page = await (
    await request("/api/admin/page", {
      id: pageId,
      version: page.version,
      changes: {},
      action: "publish",
    })
  ).json();
  assert.equal(page.hasDraft, false);
  assert.equal(page.history.length, 1);
  assert.match(
    await (await request("/produktsiya.html")).text(),
    /<title>Тестовый SEO заголовок<\/title>/,
  );
  await stop();
  await start();
  assert.equal((await request("/api/admin/session")).status, 200);
  assert.match(
    await (await request("/produktsiya.html")).text(),
    /Редактор проверен &lt;script&gt;/,
  );
  const restored = await (
    await request("/api/admin/page", {
      id: pageId,
      version: page.version,
      action: "restore",
      historyId: page.history[0].id,
    })
  ).json();
  assert.equal(restored.hasDraft, true);
  assert.ok(!restored.fields.some((f) => f.value === changed));
  assert.match(
    await (await request("/produktsiya.html")).text(),
    /Редактор проверен &lt;script&gt;/,
  );
});
test("contact changes update visible values, links and metadata", async () => {
  const settings = await (await request("/api/admin/settings")).json();
  const saved = await request("/api/admin/settings", {
    version: settings.version,
    contacts: { email: "qa@example.invalid", phone: "+7 (999) 111-22-33" },
  });
  assert.equal(saved.status, 200);
  const html = await (await request("/")).text();
  assert.match(html, /qa@example.invalid/);
  assert.match(html, /tel:\+79991112233/);
  assert.ok(!html.includes("info@prime-com.ru"));
  assert.ok(!html.includes("9680615"));
});
test("uploads reject active content; image replacement works and can be undone", async () => {
  assert.equal(
    (
      await request("/api/admin/upload", {
        name: "x.svg",
        data: Buffer.from('<svg onload="alert(1)"></svg>').toString("base64"),
      })
    ).status,
    400,
  );
  const upload = await request("/api/admin/upload", {
    name: "one.png",
    data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=",
  });
  assert.equal(upload.status, 201);
  const asset = await upload.json();
  assert.match(asset.url, /^\/uploads\/[a-f0-9-]+\.png$/);
  const image = await request(asset.url, undefined, { auth: false });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(image.headers.get("x-content-type-options"), "nosniff");
  let settings = await (await request("/api/admin/settings")).json();
  const old = "/templates/g5_helium/custom/images/logo.png";
  settings = await (
    await request("/api/admin/settings", {
      version: settings.version,
      replace: { from: old, to: asset.url },
    })
  ).json();
  assert.match(
    await (await request("/produktsiya.html")).text(),
    new RegExp(asset.url),
  );
  assert.equal(
    (
      await request("/api/admin/settings", {
        version: settings.version,
        undoReplacement: old,
      })
    ).status,
    200,
  );
  assert.ok(
    !(await (await request("/produktsiya.html")).text()).includes(asset.url),
  );
  assert.equal(
    (
      await request(
        "/cms-assets/style?file=" + encodeURIComponent("/../../cms/auth.mjs"),
      )
    ).status,
    400,
  );
});
test("editor rejects executable links and unknown fields", () => {
  const html =
      '<html><head><title>Test</title></head><body><a href="/">Link</a><img src="/x.png" alt="photo"></body></html>',
    model = pageModel(html),
    link = model.fields.find((f) => f.type === "url");
  assert.throws(() => editPage(html, { [link.id]: "javascript:alert(1)" }));
  assert.throws(() => editPage(html, { unknown: "x" }));
  assert.throws(() => editPage(html, {}, { canonical: "javascript:alert(1)" }));
});

test("ACME proof files are public while other hidden files stay private", async () => {
  const dir = path.join(root, "public/.well-known/acme-challenge");
  fs.mkdirSync(dir, { recursive: true });
  const token = "test-" + randomBytes(24).toString("base64url");
  const file = path.join(dir, token);
  fs.writeFileSync(file, "temporary-acme-proof", { flag: "wx" });
  try {
    const response = await request("/.well-known/acme-challenge/" + token);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "temporary-acme-proof");
    assert.equal((await request("/.well-known/acme-challenge/missing-proof")).status, 404);
    assert.equal((await request("/.well-known/acme-challenge/.env")).status, 403);
    assert.equal((await request("/.well-known/private-key.pem")).status, 403);
  } finally {
    fs.unlinkSync(file);
  }
});
test("one-time setup expires, cannot be reused, and never stores the plaintext token", () => {
  const dir = path.join(temp, "bootstrap-test"),
    auth = new AdminAuth(dir, true),
    token = randomBytes(32).toString("hex");
  writeJson(path.join(dir, "bootstrap.json"), {
    hash: digest(token),
    expiresAt: Date.now() - 1000,
  });
  assert.throws(() => auth.setup({}, { username: "admin", password, token }));
  writeJson(path.join(dir, "bootstrap.json"), {
    hash: digest(token),
    expiresAt: Date.now() + 100000,
  });
  const result = auth.setup({}, { username: "admin", password, token });
  assert.match(result.cookie, /Secure/);
  assert.equal(auth.configured(), true);
  assert.equal(fs.existsSync(path.join(dir, "bootstrap.json")), false);
  assert.throws(() => auth.setup({}, { username: "someone", password, token }));
  assert.ok(
    !fs.readFileSync(path.join(dir, "admin.json"), "utf8").includes(token),
  );
});
test("global media replacement includes CSS backgrounds and JavaScript, supports undo and rejects cycles", () => {
  const fixture = path.join(temp, "media-fixture"),
    data = path.join(temp, "media-state");
  fs.mkdirSync(path.join(fixture, "public", "images"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "public", "styles"));
  fs.mkdirSync(path.join(fixture, "pages"));
  fs.writeFileSync(
    path.join(fixture, "routes.json"),
    JSON.stringify({ "/": { file: "pages/index.html", title: "Test" } }),
  );
  fs.writeFileSync(
    path.join(fixture, "pages/index.html"),
    '<html><head><title>Test</title><link rel="stylesheet" href="/styles/main.css"><script src="/gallery.js"></script></head><body><img src="/images/original.png"></body></html>',
  );
  const image =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=";
  fs.writeFileSync(
    path.join(fixture, "public", "images", "original.png"),
    Buffer.from(image, "base64"),
  );
  fs.writeFileSync(
    path.join(fixture, "public", "styles", "main.css"),
    "body{background:url(../images/original.png)}",
  );
  fs.writeFileSync(
    path.join(fixture, "public", "gallery.js"),
    'const image="/images/original.png";',
  );
  const store = new ContentStore(fixture, data),
    one = store.upload({ name: "original-upload-name.png", data: image }),
    two = store.upload({ name: "second.png", data: image });
  assert.equal(
    store.media().find((a) => a.url === one.url).name,
    "original-upload-name.png",
  );
  let s = store.saveSettings({
    version: 0,
    replace: { from: "/images/original.png", to: one.url },
  });
  s = store.saveSettings({
    version: s.version,
    replace: { from: one.url, to: two.url },
  });
  assert.match(store.renderFile("pages/index.html"), new RegExp(two.url));
  assert.match(store.renderFile("pages/index.html"), /cms-assets\/script/);
  assert.match(store.stylesheet("/styles/main.css"), new RegExp(two.url));
  assert.match(store.script("/gallery.js"), new RegExp(two.url));
  assert.throws(() =>
    store.saveSettings({
      version: s.version,
      replace: { from: two.url, to: one.url },
    }),
  );
  store.saveSettings({ version: s.version, undoReplacement: one.url });
  assert.match(store.renderFile("pages/index.html"), new RegExp(one.url));
});
test("password rotation revokes previous sessions and logout removes access", async () => {
  const oldCookie = cookie,
    next = randomBytes(24).toString("base64url");
  const changed = await request("/api/admin/password", {
    currentPassword: password,
    password: next,
  });
  assert.equal(changed.status, 200);
  const newCookie = changed.headers.get("set-cookie").split(";")[0];
  csrf = (await changed.json()).csrf;
  assert.equal((await request("/api/admin/session")).status, 401);
  cookie = newCookie;
  assert.equal((await request("/api/admin/session")).status, 200);
  assert.equal((await request("/api/admin/logout", {})).status, 200);
  assert.equal((await request("/api/admin/session")).status, 401);
  assert.notEqual(cookie, oldCookie);
});
