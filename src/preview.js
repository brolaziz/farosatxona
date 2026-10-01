import { FarosatDatabase } from "./database.js";
import { FarosatService } from "./service.js";
import { createServer } from "./server.js";
import { localDate, previousDate } from "./time.js";

// Isolated, loopback-only preview. No token, production data or Telegram network calls.
const database = new FarosatDatabase(":memory:");
const config = {
  token: "preview",
  adminIds: new Set(["1001"]),
  timeZone: "Asia/Tashkent",
  botUsername: "farosatxona_demo",
  webAppUrl: "",
  supportUrl: "",
  backupDir: "./data/preview-backups",
};
const telegram = {
  botId: 999,
  call: async (method, body) => {
    if (method === "getChatMember")
      return { status: body.user_id === 999 ? "administrator" : "member" };
    if (method === "getMyStarBalance")
      return { amount: database.stats().stars };
    if (method === "getStarTransactions")
      return {
        transactions: database.db
          .prepare(
            "SELECT charge_id AS id,stars AS amount,strftime('%s',created_at) AS date FROM receipts ORDER BY created_at DESC LIMIT 100",
          )
          .all(),
      };
    throw new Error("Namoyishda Telegram’ga yuborish o‘chirilgan.");
  },
};
const groupNames = [
  "Dasturchilar davrasi",
  "Farosat ahli",
  "Toshkent yoshlari",
  "IT Community Uzbekistan",
  "Choyxona №7",
  "Kitobxonlar klubi",
  "Startup Central",
  "Universitet guruhimiz",
];
const names = [
  "Aziza",
  "Sardor",
  "Madina",
  "Javohir",
  "Shahzoda",
  "Bekzod",
  "Dilnoza",
  "Diyor",
  "Mohira",
  "Akmal",
  "Sevinch",
  "Sanjar",
  "Zarina",
  "Abbos",
  "Shoxrux",
  "Malika",
];
for (let i = 0; i < groupNames.length; i++) {
  const chatId = String(-100100001 - i);
  database.rememberChat(chatId, groupNames[i], "supergroup");
  database.db
    .prepare("UPDATE chats SET bot_status='administrator' WHERE chat_id=?")
    .run(chatId);
  for (let j = 0; j < 21; j++) {
    const id = j === 0 ? 1001 : j === 1 ? 2002 : 3000 + j + i * 12,
      name =
        j === 0 ? "Sardor" : j === 1 ? "Aziza" : names[(j + i) % names.length];
    database.rememberUser({
      id,
      first_name: name,
      username: name.toLowerCase() + "_uz",
    });
    let day = localDate("Asia/Tashkent");
    const dates = [];
    for (let d = 0; d < 30; d++) {
      dates.unshift(day);
      day = previousDate(day);
    }
    for (let d = 0; d < dates.length; d++) {
      if (j > 8 && (j + d + i) % 4 === 0) continue;
      if (j === 1 && d === dates.length - 1) continue;
      database.play({
        chatId,
        userId: id,
        displayName: name,
        username: name.toLowerCase() + "_uz",
        playDate: dates[d],
        random: () => ((j * 7 + d * 3 + i * 11) % 90) / 100,
      });
    }
    database.adjustPlayer(
      chatId,
      id,
      (20 - j) * 36 + i * 13,
      1001,
      "Namoyish boshlang‘ich hisob",
      "demo:" + chatId + ":" + id,
    );
    if (j % 4 === 0 || j === 1) {
      const order = database.createOrder(
        id,
        chatId,
        [25, 50, 100, 250, 500][(j + i) % 5],
      );
      database.creditPayment(id, {
        invoice_payload: order.id,
        currency: "XTR",
        total_amount: order.stars,
        telegram_payment_charge_id: "demo-charge-" + order.id,
      });
      database.db
        .prepare(
          "UPDATE receipts SET created_at=datetime('now',?) WHERE order_id=?",
        )
        .run("-" + ((j + i) % 22) + " days", order.id);
    }
  }
}
database.rememberChat(1001, "Sardor", "private");
database.rememberChat(2002, "Aziza", "private");
database.db
  .prepare("INSERT INTO admin_roles(user_id,role) VALUES('456789','viewer')")
  .run();
const service = new FarosatService(database, telegram, config);
const app = await createServer(service, { preview: true });
await app.listen({
  host: "127.0.0.1",
  port: Number(process.env.PREVIEW_PORT || 3000),
});
console.log("Namoyish: http://127.0.0.1:" + (process.env.PREVIEW_PORT || 3000));
async function stop() {
  await app.close();
  database.close();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
