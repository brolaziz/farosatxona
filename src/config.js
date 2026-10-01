import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadDotEnv(path = resolve(".env")) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function getConfig() {
  loadDotEnv();
  const token = process.env.BOT_TOKEN;
  if (!token)
    throw new Error(
      "BOT_TOKEN topilmadi. .env.example faylidan .env yarating.",
    );
  const adminIds = new Set(
    (process.env.ADMIN_IDS || "")
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id)),
  );
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT 1–65535 oralig‘ida bo‘lishi kerak.");
  const timeZone = process.env.TZ || "Asia/Tashkent";
  new Intl.DateTimeFormat("en", { timeZone });
  for (const key of ["WEB_APP_URL", "SUPPORT_URL"]) {
    if (process.env[key] && !/^https:\/\//.test(process.env[key]))
      throw new Error(key + " HTTPS manzil bo‘lishi kerak.");
  }
  return {
    token,
    adminIds,
    databasePath: process.env.DATABASE_PATH || "./data/farosatxona.db",
    timeZone,
    port,
    host: process.env.HOST || "0.0.0.0",
    webAppUrl: process.env.WEB_APP_URL || "",
    botUsername: (process.env.BOT_USERNAME || "").replace(/^@/, ""),
    supportUrl: process.env.SUPPORT_URL || "",
    backupDir: process.env.BACKUP_DIR || "./data/backups",
    autoBackup: process.env.AUTO_BACKUP !== "false",
  };
}
