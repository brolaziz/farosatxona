import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv(path = resolve(".env")) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function getConfig() {
  loadDotEnv();
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN topilmadi. .env.example faylidan .env yarating.");
  const adminIds = new Set(
    (process.env.ADMIN_IDS || "")
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id))
  );
  return {
    token,
    adminIds,
    databasePath: process.env.DATABASE_PATH || "./data/farosatxona.db",
    timeZone: process.env.TZ || "Asia/Tashkent"
  };
}
