import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, renameSync, unlinkSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { loadDotEnv } from "../src/config.js";
import { acquireInstanceLock } from "../src/instance-lock.js";
loadDotEnv();
const source = process.argv[2];
if (!source || !process.argv.includes("--confirm"))
  throw new Error(
    "Botni to‘xtating. node scripts/restore.js <backup.db> --confirm",
  );
const target = resolve(process.env.DATABASE_PATH || "./data/farosatxona.db"),
  snapshot = resolve(source);
if (snapshot === target || !existsSync(snapshot))
  throw new Error("Zaxira fayli noto‘g‘ri.");
mkdirSync(dirname(target), { recursive: true });
const release = acquireInstanceLock(target);
let current, incoming;
try {
  incoming = new DatabaseSync(snapshot, { readOnly: true });
  if (incoming.prepare("PRAGMA quick_check").get().quick_check !== "ok")
    throw new Error("Zaxira yaxlitligi buzilgan.");
  for (const table of ["players", "chats", "daily_rolls"]) {
    if (
      !incoming
        .prepare("SELECT name FROM sqlite_master WHERE name=?")
        .get(table)
    )
      throw new Error("Bu Farosatxona bazasi emas.");
  }
  if (existsSync(target)) {
    current = new DatabaseSync(target);
    for (const table of ["orders", "receipts", "refunds"]) {
      if (
        !current
          .prepare("SELECT name FROM sqlite_master WHERE name=?")
          .get(table)
      )
        continue;
      if (
        !incoming
          .prepare("SELECT name FROM sqlite_master WHERE name=?")
          .get(table)
      ) {
        if (current.prepare("SELECT COUNT(*) AS n FROM " + table).get().n)
          throw new Error("Zaxirada to‘lov jadvallari yo‘q.");
        continue;
      }
      const key = table === "orders" ? "id" : "charge_id";
      for (const row of current.prepare("SELECT * FROM " + table).all()) {
        const restored = incoming
          .prepare("SELECT * FROM " + table + " WHERE " + key + "=?")
          .get(row[key]);
        if (
          !restored ||
          restored.status !== row.status ||
          (row.stars !== undefined && restored.stars !== row.stars)
        )
          throw new Error(
            "Zaxira yangi yoki o‘zgargan to‘lovlarni yo‘qotadi. Yangiroq nusxani tanlang.",
          );
      }
    }
    await backup(current, target + ".before-restore-" + Date.now() + ".bak");
    current.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    current.close();
    current = null;
  }
  const temporary = target + ".restoring";
  await backup(incoming, temporary);
  // The exact named target was checked and the instance lock prevents live writers.
  for (const sidecar of [target + "-wal", target + "-shm"])
    if (existsSync(sidecar)) unlinkSync(sidecar);
  renameSync(temporary, target);
  console.log("Baza tiklandi:", target);
} finally {
  current?.close();
  incoming?.close();
  release();
}
