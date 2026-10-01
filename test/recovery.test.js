import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, basename, resolve, join } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { FarosatDatabase } from "../src/database.js";
import { FarosatService } from "../src/service.js";
import { acquireInstanceLock } from "../src/instance-lock.js";
import { nextDayAt } from "../src/time.js";
import { BotRunner } from "../src/bot.js";

function directory(t) {
  const path = mkdtempSync(join(tmpdir(), "farosat-recovery-"));
  t.after(() => {
    assert.equal(dirname(resolve(path)), resolve(tmpdir()));
    assert.ok(basename(path).startsWith("farosat-recovery-"));
    rmSync(path, { recursive: true, force: true });
  });
  return path;
}
function store(path = ":memory:") {
  const db = new FarosatDatabase(path);
  db.rememberChat(-100, "Sinov", "supergroup");
  db.rememberUser({ id: 7, first_name: "Ali" });
  db.play({
    chatId: -100,
    userId: 7,
    displayName: "Ali",
    playDate: "2026-10-01",
    random: () => 0,
  });
  return db;
}
const pay = (order) => ({
  invoice_payload: order.id,
  currency: "XTR",
  total_amount: order.stars,
  telegram_payment_charge_id: "charge-" + order.id,
});
const config = {
  adminIds: new Set(["1"]),
  backupDir: ".",
  botUsername: "test",
  timeZone: "Asia/Tashkent",
};
test("worker qulaganda qolgan workerlar to‘xtamaguncha baza yopilmaydi", async () => {
  const db = store();
  const runner = new BotRunner(
    new FarosatService(
      db,
      { call: async () => ({ id: 99, username: "test" }) },
      config,
    ),
  );
  let stopped = 0;
  runner.poll = async () => {
    throw new Error("Worker crash");
  };
  const waitForStop = () =>
    new Promise((resolve) => {
      runner.controller.signal.addEventListener(
        "abort",
        () => {
          stopped++;
          resolve();
        },
        { once: true },
      );
    });
  runner.incoming = waitForStop;
  runner.outgoing = waitForStop;
  try {
    await assert.rejects(runner.run(), /Worker crash/);
    assert.equal(stopped, 2);
    assert.equal(runner.controller.signal.aborted, true);
    assert.equal(db.db.prepare("PRAGMA quick_check").get().quick_check, "ok");
  } finally {
    db.close();
  }
});
test("kredit yozilishi yarim yo‘lda uzilsa receipt/ledger/balans birga rollback bo‘ladi", () => {
  const db = store();
  try {
    const order = db.createOrder(7, -100, 100),
      saved = db.addLedger;
    db.addLedger = () => {
      throw new Error("Simulated crash");
    };
    assert.throws(() => db.creditPayment(7, pay(order)));
    assert.equal(db.getOrder(order.id).status, "pending");
    assert.equal(db.getPlayer(-100, 7).paid_grams, 0);
    assert.equal(
      db.db.prepare("SELECT COUNT(*) AS n FROM receipts").get().n,
      0,
    );
    db.addLedger = saved;
    db.creditPayment(7, pay(order));
    assert.equal(db.getPlayer(-100, 7).paid_grams, 100);
  } finally {
    db.close();
  }
});
test("diskdagi to‘lov qayta ochilganda yo‘qolmaydi va yana kredit berilmaydi", (t) => {
  const path = join(directory(t), "state.db");
  let db = store(path),
    order = db.createOrder(7, -100, 100);
  db.creditPayment(7, pay(order));
  db.close();
  db = new FarosatDatabase(path);
  try {
    assert.equal(db.creditPayment(7, pay(order)).duplicate, true);
    assert.equal(db.getPlayer(-100, 7).paid_grams, 100);
  } finally {
    db.close();
  }
});
test("Telegram tranzaksiyalari qolib ketgan xaridni tiklaydi va tekshirilgan refundni bajaradi", async () => {
  const db = store(),
    order = db.createOrder(7, -100, 100);
  const source = {
    type: "user",
    transaction_type: "invoice_payment",
    user: { id: 7 },
    invoice_payload: order.id,
  };
  let transactions = [
    { id: pay(order).telegram_payment_charge_id, amount: 100, date: 1, source },
  ];
  const telegram = { call: async () => ({ transactions }) },
    service = new FarosatService(db, telegram, config);
  try {
    const first = await service.reconcile(1);
    assert.equal(first.recovered, 1);
    assert.equal(db.getPlayer(-100, 7).paid_grams, 100);
    assert.equal((await service.reconcile(1)).recovered, 0);
    transactions.push({
      id: pay(order).telegram_payment_charge_id,
      amount: -100,
      date: 2,
      receiver: { type: "user", user: { id: 7 } },
    });
    assert.equal((await service.reconcile(1)).refunded, 1);
    assert.equal(db.getPlayer(-100, 7).paid_grams, 0);
    assert.equal((await service.reconcile(1)).refunded, 0);
  } finally {
    db.close();
  }
});
test("mos bo‘lmagan tranzaksiya qo‘shilmaydi, operatorga issue ko‘rsatiladi", async () => {
  const db = store(),
    order = db.createOrder(7, -100, 100);
  const service = new FarosatService(
    db,
    {
      call: async () => ({
        transactions: [
          {
            id: "x",
            amount: 99,
            date: 1,
            source: {
              type: "user",
              transaction_type: "invoice_payment",
              user: { id: 7 },
              invoice_payload: order.id,
            },
          },
        ],
      }),
    },
    config,
  );
  try {
    assert.equal((await service.reconcile(1)).issues.length, 1);
    assert.equal(db.getPlayer(-100, 7).paid_grams, 0);
  } finally {
    db.close();
  }
});
test("instance lock parallel botni rad qiladi va bo‘shatilgach yana olinadi", (t) => {
  const path = join(directory(t), "state.db"),
    release = acquireInstanceLock(path);
  assert.throws(() => acquireInstanceLock(path));
  release();
  const again = acquireInstanceLock(path);
  again();
  assert.equal(existsSync(path + ".lock"), false);
});
test(
  "Linux konteyner qayta ishlatgan PID eski lockni tirik deb hisoblamaydi",
  { skip: process.platform !== "linux" },
  (t) => {
    const path = join(directory(t), "state.db");
    writeFileSync(
      path + ".lock",
      JSON.stringify({ pid: process.pid, identity: "old-boot:0" }),
    );
    const release = acquireInstanceLock(path);
    assert.ok(JSON.parse(readFileSync(path + ".lock", "utf8")).identity);
    assert.throws(() => acquireInstanceLock(path));
    release();
  },
);
test("lock bo‘shatish boshqa nusxaning yangi lockini o‘chirmaydi", (t) => {
  const path = join(directory(t), "state.db"),
    release = acquireInstanceLock(path);
  writeFileSync(
    path + ".lock",
    JSON.stringify({ pid: process.pid, id: "replacement" }),
  );
  release();
  assert.equal(existsSync(path + ".lock"), true);
});
test("backup yaxlit, CLI restore oldidan nusxa oladi va live instance’ni rad qiladi", async (t) => {
  const dir = directory(t),
    path = join(dir, "state.db"),
    snapshot = join(dir, "snapshot.db"),
    db = store(path);
  await backup(db.db, snapshot);
  db.close();
  const env = { ...process.env, DATABASE_PATH: path };
  const release = acquireInstanceLock(path);
  const blocked = spawnSync(
    process.execPath,
    ["scripts/restore.js", snapshot, "--confirm"],
    { env, encoding: "utf8" },
  );
  assert.notEqual(blocked.status, 0);
  release();
  const restored = spawnSync(
    process.execPath,
    ["scripts/restore.js", snapshot, "--confirm"],
    { env, encoding: "utf8" },
  );
  assert.equal(restored.status, 0, restored.stderr);
  const check = new DatabaseSync(path);
  assert.equal(check.prepare("PRAGMA quick_check").get().quick_check, "ok");
  check.close();
});
test("restore yangi xarid yoki refund holatini yo‘qotadigan snapshot’ni rad qiladi", async (t) => {
  const dir = directory(t),
    path = join(dir, "state.db"),
    snapshot = join(dir, "snapshot.db"),
    db = store(path);
  await backup(db.db, snapshot);
  const order = db.createOrder(7, -100, 100);
  db.creditPayment(7, pay(order));
  db.close();
  const restored = spawnSync(
    process.execPath,
    ["scripts/restore.js", snapshot, "--confirm"],
    { env: { ...process.env, DATABASE_PATH: path }, encoding: "utf8" },
  );
  assert.notEqual(restored.status, 0);
  assert.match(restored.stderr, /to‘lovlarni yo‘qotadi/);
  const current = new FarosatDatabase(path);
  assert.equal(current.getPlayer(-100, 7).paid_grams, 100);
  current.close();
});
test("kun o‘zgarishi Tashkent va DST vaqt zonalarida to‘g‘ri", () => {
  assert.equal(
    nextDayAt("Asia/Tashkent", new Date("2026-10-01T17:00:00Z")),
    "2026-10-01T19:00:00.000Z",
  );
  assert.equal(
    nextDayAt("America/New_York", new Date("2026-03-08T06:00:00Z")),
    "2026-03-09T04:00:00.000Z",
  );
});
test("guruh superguruhga aylanganda balans va order yangi chatga ko‘chadi", () => {
  const db = store(),
    order = db.createOrder(7, -100, 100);
  try {
    db.creditPayment(7, pay(order));
    db.migrateChat(-100, -200);
    assert.equal(db.getPlayer(-200, 7).paid_grams, 100);
    assert.equal(db.getOrder(order.id).chat_id, "-200");
    assert.equal(db.getChat(-100), undefined);
    assert.equal(db.getPlayer(-100, 7), undefined);
  } finally {
    db.close();
  }
});
test("failed update tashlab yuborilmaydi, xato va retry vaqti saqlanadi", () => {
  const db = store(),
    runner = new BotRunner(new FarosatService(db, {}, config));
  try {
    db.receiveUpdates([{ update_id: 123, message: { text: "/farosat" } }]);
    runner.failInbox(123, new Error("Network"), 1);
    const row = db.db.prepare("SELECT * FROM inbox WHERE update_id=123").get();
    assert.equal(row.status, "pending");
    assert.equal(row.error, "Network");
    assert.ok(row.next_at > Date.now());
    runner.failInbox(123, new Error("Network"), 10);
    assert.equal(
      db.db.prepare("SELECT status FROM inbox WHERE update_id=123").get()
        .status,
      "failed",
    );
  } finally {
    db.close();
  }
});
test("e’lonlar auditoriya va vaqt bo‘yicha bir marta navbatga tushadi", () => {
  const db = store(),
    runner = new BotRunner(new FarosatService(db, {}, config));
  try {
    db.rememberChat(7, "Ali", "private");
    db.db
      .prepare(
        "INSERT INTO broadcasts(id,actor,text,audience,scheduled_at) VALUES('past','1','<test>','groups','2000-01-01'),('future','1','Test','all','2099-01-01')",
      )
      .run();
    runner.scheduleBroadcasts();
    runner.scheduleBroadcasts();
    const rows = db.db.prepare("SELECT * FROM outbox").all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].chat_id, "-100");
    assert.equal(rows[0].text, "&lt;test&gt;");
  } finally {
    db.close();
  }
});
