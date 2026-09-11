import path from "node:path";
import { randomBytes } from "node:crypto";
import { digest, readJson, writeJson, withLock } from "../cms/store.mjs";
const dir = path.resolve(
  process.env.CMS_DATA_DIR || path.join(import.meta.dirname, "../data/cms"),
);
withLock(dir, () => {
  if (readJson(path.join(dir, "admin.json"), null))
    throw new Error(
      "Администратор уже создан. Используйте вход в панель; существующий доступ не изменён.",
    );
  const token = randomBytes(32).toString("hex");
  writeJson(path.join(dir, "bootstrap.json"), {
    hash: digest(token),
    expiresAt: Date.now() + 48 * 3600000,
  });
  console.log(
    (process.env.SITE_ORIGIN || "https://prime-com.ru") +
      "/admin/#setup=" +
      token,
  );
});
