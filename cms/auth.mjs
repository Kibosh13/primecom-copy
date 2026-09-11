import fs from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { digest, readJson, writeJson, withLock } from "./store.mjs";
const lifetime = 8 * 60 * 60 * 1000;
export function passwordRecord(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error("Пароль должен содержать от 12 до 128 символов");
  const salt = randomBytes(24).toString("hex");
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}
export function passwordMatches(password, record) {
  if (typeof password !== "string" || password.length > 128) return false;
  const actual = scryptSync(password, record?.salt || "invalid-login", 64);
  const expected = Buffer.from(record?.hash || "00".repeat(64), "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export class AdminAuth {
  constructor(dir, production) {
    this.dir = dir;
    this.production = production;
    this.cookieName = production ? "__Host-primecom-admin" : "primecom-admin";
    this.configFile = path.join(dir, "admin.json");
  }
  configured() {
    return !!readJson(this.configFile, null);
  }
  cookie(token, maxAge = 28800) {
    return `${this.cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.production ? "; Secure" : ""}`;
  }
  token(req) {
    return (
      (req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim().split("="))
        .find(([k]) => k === this.cookieName)?.[1] || ""
    );
  }
  session(req) {
    const token = this.token(req);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const data = readJson(
      path.join(this.dir, "sessions", digest(token) + ".json"),
      null,
    );
    const config = readJson(this.configFile, null);
    return data &&
      config &&
      data.expiresAt > Date.now() &&
      data.generation === config.generation
      ? data
      : null;
  }
  createSession() {
    const config = readJson(this.configFile, null),
      token = randomBytes(32).toString("hex"),
      session = {
        username: config.username,
        generation: config.generation,
        csrf: randomBytes(32).toString("hex"),
        expiresAt: Date.now() + lifetime,
      };
    writeJson(
      path.join(this.dir, "sessions", digest(token) + ".json"),
      session,
    );
    return { session, cookie: this.cookie(token) };
  }
  limit(req, username) {
    return withLock(this.dir, () => {
      const file = path.join(this.dir, "login-attempts.json"),
        now = Date.now(),
        entries = readJson(file, []).filter((x) => x.at > now - 900000);
      const key = digest(String(username).toLowerCase());
      if (
        entries.length >= 40 ||
        entries.filter((x) => x.key === key).length >= 10
      )
        throw Object.assign(
          new Error("Слишком много попыток. Повторите вход через 15 минут."),
          { status: 429 },
        );
      entries.push({ key, at: now });
      writeJson(file, entries);
    });
  }
  login(req, body) {
    this.limit(req, body.username);
    const config = readJson(this.configFile, null);
    if (
      !passwordMatches(body.password, config) ||
      body.username !== config?.username
    )
      throw Object.assign(new Error("Неверный логин или пароль"), {
        status: 401,
      });
    return this.createSession();
  }
  setup(req, body) {
    this.limit(req, "setup");
    return withLock(this.dir, () => {
      if (this.configured()) throw new Error("Администратор уже настроен");
      const boot = readJson(path.join(this.dir, "bootstrap.json"), null);
      if (
        !boot ||
        boot.expiresAt < Date.now() ||
        typeof body.token !== "string" ||
        digest(body.token) !== boot.hash
      )
        throw new Error("Ссылка первого входа недействительна или истекла");
      if (!/^[a-zA-Z0-9_.@-]{3,80}$/.test(body.username || ""))
        throw new Error(
          "Логин: 3–80 латинских букв, цифр или символов . _ @ -",
        );
      writeJson(this.configFile, {
        username: body.username,
        ...passwordRecord(body.password),
        generation: randomBytes(16).toString("hex"),
      });
      fs.unlinkSync(path.join(this.dir, "bootstrap.json"));
      return this.createSession();
    });
  }
  logout(req) {
    const token = this.token(req);
    if (/^[a-f0-9]{64}$/.test(token)) {
      const file = path.join(this.dir, "sessions", digest(token) + ".json");
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    return this.cookie("", 0);
  }
  changePassword(body) {
    return withLock(this.dir, () => {
      const config = readJson(this.configFile, null);
      if (!passwordMatches(body.currentPassword, config))
        throw new Error("Текущий пароль неверен");
      writeJson(this.configFile, {
        username: config.username,
        ...passwordRecord(body.password),
        generation: randomBytes(16).toString("hex"),
      });
      return this.createSession();
    });
  }
}
