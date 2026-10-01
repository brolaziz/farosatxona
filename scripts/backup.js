import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadDotEnv } from "../src/config.js";
loadDotEnv();
const path = resolve(process.env.DATABASE_PATH || "./data/farosatxona.db");
if (!existsSync(path)) throw new Error("Baza topilmadi: " + path);
const directory = resolve(process.env.BACKUP_DIR || "./data/backups");
mkdirSync(directory, { recursive: true });
const target = resolve(
  directory,
  "farosat-" + new Date().toISOString().replaceAll(":", "-") + ".db",
);
const db = new DatabaseSync(path, { readOnly: true });
try {
  await backup(db, target);
  console.log("Zaxira saqlandi:", target);
} finally {
  db.close();
}
