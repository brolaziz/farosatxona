import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { FarosatDatabase } from "../src/database.js";
import { FarosatDatabase as LegacyDatabase } from "../src/legacy-database.js";
import { FarosatService } from "../src/service.js";
import { validateInitData, Sessions } from "../src/auth.js";
import { createServer } from "../src/server.js";
import { BotRunner, commandFrom } from "../src/bot.js";
import { localDate } from "../src/time.js";

const botToken = "123:TEST_ONLY";
function signed(
  user = { id: 7, first_name: "Ali" },
  authDate = Math.floor(Date.now() / 1000),
) {
  const params = new URLSearchParams({
    user: JSON.stringify(user),
    auth_date: String(authDate),
    query_id: "test",
  });
  const check = [...params]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => k + "=" + v)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}
function fixture(t) {
  const db = new FarosatDatabase(":memory:");
  t.after(() => db.close());
  for (const chatId of [-100, -200]) {
    db.rememberChat(chatId, "Guruh " + chatId, "supergroup");
    db.play({
      chatId,
      userId: 7,
      displayName: "Ali",
      playDate: localDate("Asia/Tashkent"),
      random: () => 0,
    });
  }
  db.rememberUser({ id: 7, first_name: "Ali" });
  const calls = [],
    config = {
      token: botToken,
      adminIds: new Set(["1"]),
      timeZone: "Asia/Tashkent",
      botUsername: "farosatbot",
      webAppUrl: "https://example.com",
      backupDir: join(tmpdir(), "farosat-test-backup"),
      supportUrl: "https://t.me/test_support",
    };
  const telegram = {
    botId: 99,
    call: async (method, body) => {
      calls.push({ method, body });
      if (method === "getChatMember")
        return { status: body.user_id === 99 ? "administrator" : "member" };
      if (method === "createInvoiceLink") return "https://t.me/$test";
      return true;
    },
    answerCallbackQuery: async () => true,
  };
  return {
    db,
    service: new FarosatService(db, telegram, config),
    telegram,
    config,
    calls,
  };
}
const payment = (order, charge = "charge-1") => ({
  invoice_payload: order.id,
  currency: "XTR",
  total_amount: order.stars,
  telegram_payment_charge_id: charge,
});
test("initData imzosi, muddati, qalbaki user va takroriy parametr tekshiriladi", () => {
  assert.equal(validateInitData(signed(), botToken).id, 7);
  assert.throws(() =>
    validateInitData(signed().replace("Ali", "Vali"), botToken),
  );
  assert.throws(() => validateInitData(signed(undefined, 1), botToken));
  assert.throws(() => validateInitData(signed({ id: -1 }), botToken));
  assert.throws(() => validateInitData(signed() + "&auth_date=1", botToken));
  assert.throws(() => validateInitData(signed(), "other-token"));
});
test("sessiya eskirgach ruxsat berilmaydi", () => {
  const sessions = new Sessions(),
    result = sessions.create({ id: 7 });
  assert.equal(sessions.get(result.token).id, 7);
  sessions.items.get(result.token).expires = 1;
  assert.throws(() => sessions.get(result.token));
});
test("1 Star aynan 1g, faqat tanlangan guruhga, takroriy charge bir marta", (t) => {
  const { db } = fixture(t),
    before = db.getPlayer(-100, 7).grams,
    other = db.getPlayer(-200, 7).grams;
  const order = db.createOrder(7, -100, 100);
  const first = db.creditPayment(7, payment(order)),
    second = db.creditPayment(7, payment(order));
  assert.equal(order.stars, 100);
  assert.equal(first.player.grams, before + 100);
  assert.equal(second.duplicate, true);
  assert.equal(db.getPlayer(-200, 7).grams, other);
  assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM receipts").get().n, 1);
  assert.equal(
    db.db
      .prepare("SELECT COUNT(*) AS n FROM ledger WHERE source='payment'")
      .get().n,
    1,
  );
});
test("wrong buyer/currency/amount va kasr miqdorlari qabul qilinmaydi", (t) => {
  const { db } = fixture(t),
    order = db.createOrder(7, -100, 25);
  for (const invalid of [
    { ...payment(order), currency: "USD" },
    { ...payment(order), total_amount: 24 },
  ])
    assert.throws(() => db.creditPayment(7, invalid));
  assert.throws(() => db.creditPayment(8, payment(order)));
  assert.throws(() => db.createOrder(7, -100, 1.5));
  assert.throws(() => db.createOrder(7, -100, "25"));
  assert.throws(() => db.createOrder(7, -999, 25));
  assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM receipts").get().n, 0);
});
test("pre-checkout tekshiruvigina gramm qo‘shmaydi va expiry tekshiriladi", (t) => {
  const { db } = fixture(t),
    order = db.createOrder(7, -100, 25),
    before = db.getPlayer(-100, 7).grams;
  const query = {
    from: { id: 7 },
    invoice_payload: order.id,
    currency: "XTR",
    total_amount: 25,
  };
  assert.equal(db.validateCheckout(query).id, order.id);
  assert.equal(db.getPlayer(-100, 7).grams, before);
  db.db
    .prepare("UPDATE orders SET expires_at='2000-01-01' WHERE id=?")
    .run(order.id);
  assert.throws(() => db.validateCheckout(query));
  // A confirmed late payment is still delivered even after expiry or shop closure.
  db.setSetting("shopEnabled", false, 1);
  db.creditPayment(7, payment(order));
  assert.equal(db.getPlayer(-100, 7).paid_grams, 25);
});
test("bitta orderga ikkinchi charge alohida tekshiriladi va kredit takrorlanmaydi", (t) => {
  const { db } = fixture(t),
    order = db.createOrder(7, -100, 100);
  db.creditPayment(7, payment(order));
  assert.equal(
    db.creditPayment(7, payment(order, "charge-2")).duplicateCharge,
    true,
  );
  assert.equal(
    db.creditPayment(7, payment(order, "charge-2")).duplicateCharge,
    true,
  );
  assert.equal(db.getPlayer(-100, 7).paid_grams, 100);
  db.startRefund("charge-2", 1, "Takroriy to‘lov");
  db.finishRefund("charge-2");
  assert.equal(db.getPlayer(-100, 7).paid_grams, 100);
});
test("minus, admin ayirishi va reset xarid balansini saqlaydi; qayta kunlik urinish yo‘q", (t) => {
  const { db } = fixture(t),
    order = db.createOrder(7, -100, 100);
  db.creditPayment(7, payment(order));
  db.adjustPlayer(-100, 7, -1000, 1, "Test");
  const roll = db.play({
    chatId: -100,
    userId: 7,
    displayName: "Ali",
    playDate: "2099-01-01",
    random: () => 0.99,
  });
  assert.equal(roll.player.grams, 100);
  assert.equal(roll.roll.delta, 0);
  db.clearChat(-100, 1);
  assert.equal(db.getPlayer(-100, 7).paid_grams, 100);
  assert.equal(
    db.play({
      chatId: -100,
      userId: 7,
      displayName: "Ali",
      playDate: "2099-01-01",
      random: () => 0,
    }).alreadyPlayed,
    true,
  );
  assert.equal(db.getPlayer(-100, 7).earned_grams, 0);
});
test("1000g xarid kunlik yutuq ehtimolini o‘zgartirmaydi", (t) => {
  const { db } = fixture(t),
    order = db.createOrder(7, -100, 1000);
  db.creditPayment(7, payment(order));
  const result = db.play({
    chatId: -100,
    userId: 7,
    displayName: "Ali",
    playDate: "2099-01-01",
    random: () => 0,
  });
  assert.equal(result.roll.oldLevel.key, "bronza");
  assert.equal(result.roll.delta, 1);
  assert.equal(result.player.paid_grams, 1000);
});
test("refund muvaffaqiyatdan keyin bir marta ayriladi va ledger mos keladi", async (t) => {
  const { db, service, calls } = fixture(t),
    order = db.createOrder(7, -100, 100);
  db.creditPayment(7, payment(order));
  await service.refund("charge-1", 1, "Xaridor so‘rovi");
  await service.refund("charge-1", 1, "Qayta");
  assert.equal(db.getPlayer(-100, 7).paid_grams, 0);
  assert.equal(calls.filter((c) => c.method === "refundStarPayment").length, 1);
  assert.equal(
    db.db
      .prepare("SELECT SUM(delta) AS n FROM ledger WHERE bucket='paid'")
      .get().n,
    0,
  );
  assert.equal(
    db.db
      .prepare("SELECT COUNT(*) AS n FROM ledger WHERE source='refund'")
      .get().n,
    1,
  );
});
test("refund aloqa uzilganda balans saqlanadi, qayta urinish allaqachon qaytarilganini tiklaydi", async (t) => {
  const { db, service, telegram } = fixture(t),
    order = db.createOrder(7, -100, 100);
  db.creditPayment(7, payment(order));
  telegram.call = async () => {
    throw new Error("Timeout");
  };
  await assert.rejects(service.refund("charge-1", 1, "Test"));
  assert.equal(db.getPlayer(-100, 7).paid_grams, 100);
  telegram.call = async () => {
    throw new Error("CHARGE_ALREADY_REFUNDED");
  };
  await service.refund("charge-1", 1, "Test");
  assert.equal(db.getPlayer(-100, 7).paid_grams, 0);
});
test("admin adjustments idempotent, sabab va oldingi/keyingi hisob auditga tushadi", (t) => {
  const { db } = fixture(t);
  db.adjustPlayer(-100, 7, 10, 1, "Sovrin", "same");
  db.adjustPlayer(-100, 7, 10, 1, "Sovrin", "same");
  assert.equal(db.getPlayer(-100, 7).grams, 11);
  const row = db.db.prepare("SELECT * FROM audit WHERE action='balance'").get();
  assert.equal(JSON.parse(row.details).reason, "Sovrin");
  assert.throws(() => db.adjustPlayer(-100, 7, 1.5));
});
test("statistika noyob odamlarni guruh profillaridan ajratadi va qidiruv TOP20 bilan cheklanmaydi", (t) => {
  const { db } = fixture(t);
  db.rememberChat(7, "Ali", "private");
  assert.equal(db.stats().uniqueUsers, 1);
  assert.equal(db.stats().totalPlayers, 2);
  assert.equal(db.stats().groups, 2);
  assert.equal(db.stats().privateChats, 1);
  for (let i = 10; i < 45; i++)
    db.play({
      chatId: -100,
      userId: i,
      displayName: "User " + i,
      playDate: "2099-01-01",
      random: () => 0,
    });
  assert.equal(db.searchPlayers({ q: "User 44" }).items[0].user_id, "44");
  assert.equal(db.searchPlayers({ limit: 20, offset: 20 }).items.length, 17);
});
test("eski bazaning migratsiyasi balans/seriya/kuni saqlaydi va qayta bajarilmaydi", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "farosat-migration-"));
  t.after(() => {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith("farosat-migration-"));
    rmSync(dir, { recursive: true, force: true });
  });
  const path = join(dir, "legacy.db"),
    old = new LegacyDatabase(path);
  old.rememberChat(-100, "Eski guruh", "supergroup");
  old.play({
    chatId: -100,
    userId: 7,
    displayName: "Ali",
    playDate: "2026-01-01",
    random: () => 0,
  });
  old.adjustPlayer(-100, 7, 500);
  old.close();
  let db = new FarosatDatabase(path);
  assert.equal(db.getPlayer(-100, 7).earned_grams, 501);
  assert.equal(db.getPlayer(-100, 7).streak, 1);
  assert.equal(
    db.db.prepare("SELECT COUNT(*) AS n FROM daily_rolls").get().n,
    1,
  );
  assert.equal(
    db.db.prepare("SELECT SUM(delta) AS n FROM ledger").get().n,
    501,
  );
  db.close();
  db = new FarosatDatabase(path);
  assert.equal(db.getPlayer(-100, 7).grams, 501);
  assert.equal(readdirSync(dir).filter((f) => f.endsWith(".bak")).length, 1);
  db.close();
});
test("inbox/outbox qayta kelgan update’ni bitta yozuv sifatida saqlaydi", (t) => {
  const { db } = fixture(t);
  db.receiveUpdates([{ update_id: 123, message: { text: "/farosat" } }]);
  db.receiveUpdates([{ update_id: 123, message: { text: "/farosat" } }]);
  db.enqueue("reply:123", 7, "Test");
  db.enqueue("reply:123", 7, "Test");
  assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM inbox").get().n, 1);
  assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM outbox").get().n, 1);
});
test("komanda boshqa botga atalgan bo‘lsa qabul qilinmaydi", () => {
  assert.equal(commandFrom("/farosat@OtherBot", "farosatbot"), null);
  assert.equal(commandFrom("/farosat@FarosatBot", "farosatbot"), "farosat");
});
test("bot non-command successful_payment’ni oladi, eski admin callback yozuvlarni o‘chirmaydi", async (t) => {
  const { db, service } = fixture(t),
    order = db.createOrder(7, -100, 100),
    runner = new BotRunner(service);
  await runner.handle({
    update_id: 10,
    message: {
      from: { id: 7, first_name: "Ali" },
      chat: { id: 7, type: "private" },
      successful_payment: payment(order),
    },
  });
  await runner.handle({
    update_id: 10,
    message: {
      from: { id: 7, first_name: "Ali" },
      chat: { id: 7, type: "private" },
      successful_payment: payment(order),
    },
  });
  assert.equal(db.getPlayer(-100, 7).paid_grams, 100);
  await runner.handle({
    callback_query: { id: "x", data: "admin:all:confirm", from: { id: 1 } },
  });
  assert.equal(db.getPlayer(-100, 7).paid_grams, 100);
});
test("pre-checkout membership xatosi to‘lovni rad qiladi", async (t) => {
  const { db, service, telegram, calls } = fixture(t),
    order = db.createOrder(7, -100, 25);
  telegram.call = async (method, body) => {
    calls.push({ method, body });
    return method === "getChatMember" ? { status: "left" } : true;
  };
  await new BotRunner(service).preCheckout({
    id: "checkout",
    from: { id: 7 },
    invoice_payload: order.id,
    currency: "XTR",
    total_amount: 25,
  });
  assert.equal(calls.at(-1).body.ok, false);
  assert.equal(db.getPlayer(-100, 7).paid_grams, 0);
});
async function webFixture(t) {
  const fixtureData = fixture(t),
    app = await createServer(fixtureData.service);
  t.after(() => app.close());
  const login = async (id) => {
    const result = await app.inject({
      method: "POST",
      url: "/api/session",
      payload: { initData: signed({ id, first_name: "Test" }) },
    });
    assert.equal(result.statusCode, 200);
    return { authorization: "Bearer " + result.json().token };
  };
  return { ...fixtureData, app, login };
}
test("production preview login yo‘q; qalbaki user/admin kirishi va autentifikatsiyasiz API yopiq", async (t) => {
  const { app, login } = await webFixture(t);
  const bad = await app.inject({
    method: "POST",
    url: "/api/session",
    payload: { mode: "admin" },
  });
  assert.equal(bad.statusCode, 401);
  assert.equal(
    (await app.inject({ url: "/api/admin/dashboard" })).statusCode,
    401,
  );
  const headers = await login(7);
  assert.equal(
    (await app.inject({ url: "/api/admin/dashboard", headers })).statusCode,
    403,
  );
  const encoded = await app.inject({ url: "/api/admin%2Fdashboard", headers });
  assert.notEqual(encoded.statusCode, 200);
});
test("guruh ID qalbakilashtirish va birovning buyurtmasini ko‘rish rad etiladi", async (t) => {
  const { db, app, login } = await webFixture(t),
    headers = await login(7),
    order = db.createOrder(7, -100, 25);
  assert.equal(
    (await app.inject({ url: "/api/me/profile?chatId=-999", headers }))
      .statusCode,
    403,
  );
  const other = await login(8);
  assert.equal(
    (await app.inject({ url: "/api/me/orders/" + order.id, headers: other }))
      .statusCode,
    404,
  );
});
test("moderator scope va viewer write vakolatlari serverda tekshiriladi", async (t) => {
  const { db, app, login } = await webFixture(t);
  db.db
    .prepare(
      "INSERT INTO admin_roles(user_id,role,chat_id) VALUES('2','moderator','-100'),('3','viewer',NULL)",
    )
    .run();
  const moderator = await login(2),
    viewer = await login(3);
  assert.equal(
    (await app.inject({ url: "/api/admin/players", headers: moderator }))
      .json()
      .items.every((p) => p.chat_id === "-100"),
    true,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/admin/adjust",
        headers: moderator,
        payload: {
          chatId: "-200",
          userId: "7",
          delta: 10,
          reason: "Test",
          requestId: "1",
        },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ url: "/api/admin/orders", headers: moderator }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/admin/adjust",
        headers: viewer,
        payload: {
          chatId: "-100",
          userId: "7",
          delta: 10,
          reason: "Test",
          requestId: "1",
        },
      })
    ).statusCode,
    403,
  );
});
test("reset tasdig‘i bir marta ishlaydi; paid saqlanadi; qayta farosat olinmaydi", async (t) => {
  const { db, app, login } = await webFixture(t),
    headers = await login(1),
    order = db.createOrder(7, -100, 25);
  db.creditPayment(7, payment(order));
  const confirmation = await app.inject({
    method: "POST",
    url: "/api/admin/confirmation",
    headers,
    payload: { action: "reset-group", chatId: "-100" },
  });
  const payload = { token: confirmation.json().token };
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/admin/reset",
        headers,
        payload,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/admin/reset",
        headers,
        payload,
      })
    ).statusCode,
    400,
  );
  assert.equal(db.getPlayer(-100, 7).paid_grams, 25);
  assert.equal(
    db.play({
      chatId: -100,
      userId: 7,
      displayName: "Ali",
      playDate: localDate("Asia/Tashkent"),
      random: () => 0,
    }).alreadyPlayed,
    true,
  );
});
test("kunlik bot va Web App uchun bitta limit va invoice’da Stars 100ga ko‘paytirilmaydi", async (t) => {
  const { db, app, login, calls } = await webFixture(t),
    headers = await login(7);
  const roll = await app.inject({
    method: "POST",
    url: "/api/me/play",
    headers,
    payload: { chatId: "-100" },
  });
  assert.equal(roll.json().alreadyPlayed, true);
  const invoice = await app.inject({
    method: "POST",
    url: "/api/me/orders",
    headers,
    payload: { chatId: "-100", grams: 25, acceptTerms: true },
  });
  assert.equal(invoice.statusCode, 200);
  assert.equal(
    calls.find((c) => c.method === "createInvoiceLink").body.prices[0].amount,
    25,
  );
  assert.equal(db.getPlayer(-100, 7).paid_grams, 0);
});
test("cheklov muddati, maintenance va do‘kon yopilishi amalda tekshiriladi", async (t) => {
  const { db } = fixture(t);
  db.db
    .prepare(
      "INSERT INTO restrictions(chat_id,user_id,kind,reason) VALUES('-100','7','shop','Test')",
    )
    .run();
  assert.throws(() => db.createOrder(7, -100, 10));
  db.db.prepare("UPDATE restrictions SET until_at='2000-01-01'").run();
  assert.equal(db.createOrder(7, -100, 10).grams, 10);
  db.setSetting("maintenance", true, 1);
  assert.throws(() =>
    db.play({
      chatId: -100,
      userId: 7,
      displayName: "Ali",
      playDate: "2099-01-01",
    }),
  );
  assert.throws(() => db.createOrder(7, -100, 10));
});
test("daraja sozlamasi noto‘g‘ri oraliqni rad qiladi; CSV formula himoyalangan", async (t) => {
  const { db, app, login } = await webFixture(t),
    headers = await login(1);
  const bad = await app.inject({
    method: "PATCH",
    url: "/api/admin/settings",
    headers,
    payload: { levels: [{ key: "x" }] },
  });
  assert.equal(bad.statusCode, 400);
  db.db.prepare("UPDATE players SET display_name='=1+1'").run();
  const file = await app.inject({ url: "/api/admin/export/players", headers });
  assert.equal(file.statusCode, 200);
  assert.match(file.body, /'=1\+1/);
});
