import assert from "node:assert/strict";
import test from "node:test";
import { FarosatDatabase } from "../src/database.js";
import { getLevel, rollFarosat } from "../src/levels.js";
import { escapeHtml, formatAlreadyPlayed, formatRoll } from "../src/messages.js";
import { localDate, previousDate } from "../src/time.js";

test("daraja chegaralari to‘g‘ri ishlaydi", () => {
  assert.equal(getLevel(0).key, "bronza");
  assert.equal(getLevel(199).key, "bronza");
  assert.equal(getLevel(200).key, "kumush");
  assert.equal(getLevel(400).key, "oltin");
  assert.equal(getLevel(1000).key, "afsonaviy");
});

test("random natija musbat va manfiy bo‘la oladi", () => {
  const positive = rollFarosat(100, sequence([0, 0]));
  const negative = rollFarosat(100, sequence([0.99, 0]));
  assert.equal(positive.delta, 1);
  assert.equal(negative.delta, -1);
});

test("farosat noldan pastga tushmaydi", () => {
  const result = rollFarosat(0, sequence([0.99, 0.99]));
  assert.equal(result.newGrams, 0);
  assert.equal(result.delta, 0);
});

test("bir foydalanuvchi bir kunda faqat bir marta o‘ynaydi", () => {
  const db = new FarosatDatabase(":memory:");
  const input = { chatId: -100, userId: 7, displayName: "Ali", playDate: "2026-09-10", random: sequence([0, 0]) };
  const first = db.play(input);
  const second = db.play(input);
  assert.equal(first.alreadyPlayed, false);
  assert.equal(second.alreadyPlayed, true);
  assert.equal(db.getPlayer(-100, 7).plays, 1);
  db.close();
});

test("ketma-ket kunlar seriya beradi, tanaffus esa uni buzadi", () => {
  const db = new FarosatDatabase(":memory:");
  const base = { chatId: -100, userId: 8, displayName: "Vali", random: sequence([0, 0, 0, 0]) };
  assert.equal(db.play({ ...base, playDate: "2026-09-08" }).player.streak, 1);
  assert.equal(db.play({ ...base, playDate: "2026-09-09" }).player.streak, 2);
  assert.equal(db.play({ ...base, playDate: "2026-09-11" }).player.streak, 1);
  db.close();
});

test("admin statistikani ko‘radi va faqat tanlangan guruhni tozalaydi", () => {
  const db = new FarosatDatabase(":memory:");
  const common = { userId: 9, displayName: "Ali", playDate: "2026-09-10", random: sequence([0, 0]) };
  db.play({ ...common, chatId: -100 });
  db.play({ ...common, chatId: -200 });
  assert.equal(db.stats(-100).players, 1);
  assert.equal(db.stats(-100).totalChats, 2);
  assert.deepEqual(db.clearChat(-100), { players: 1, rolls: 1 });
  assert.equal(db.stats(-100).players, 0);
  assert.equal(db.stats(-200).players, 1);
  db.close();
});

test("sana timezone bo‘yicha hisoblanadi", () => {
  const instant = new Date("2026-09-09T20:30:00Z");
  assert.equal(localDate("Asia/Tashkent", instant), "2026-09-10");
  assert.equal(previousDate("2026-03-01"), "2026-02-28");
});

test("Telegram HTML matni himoyalanadi", () => {
  assert.equal(escapeHtml('<Ali & "Vali">'), "&lt;Ali &amp; &quot;Vali&quot;&gt;");
});

test("birinchi luqma Farosatxona uslubida yoziladi", () => {
  const roll = rollFarosat(0, sequence([0, 0]));
  const text = formatRoll({ userId: 1, displayName: "Ali", player: { streak: 1 }, roll }, () => 0);
  assert.match(text, /Farosatxona sizga/);
  assert.match(text, /\+1 g/);
  assert.match(text, /Keyingi luqma ertaga/);
  assert.doesNotMatch(text, /Bronza|Ketma-ket/);
});

test("takroriy urinish kunlik luqma berilganini aytadi", () => {
  const text = formatAlreadyPlayed({ userId: 1, displayName: "Ali", player: { grams: 8 } }, () => 0);
  assert.match(text, /bugungi luqmangiz berilgan/);
  assert.match(text, /Ko‘p bosishdan farosat ko‘paymaydi/);
});

function sequence(values) {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}
