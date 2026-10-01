import { getConfig } from "./config.js";
import { FarosatDatabase } from "./database.js";
import { TelegramClient } from "./telegram.js";
import { FarosatService } from "./service.js";
import { createServer } from "./server.js";
import { BotRunner } from "./bot.js";
import { acquireInstanceLock } from "./instance-lock.js";

const config = getConfig();
const release = acquireInstanceLock(config.databasePath);
process.once("exit", release);
if (config.webAppUrl && !config.webAppUrl.startsWith("https://"))
  throw new Error("WEB_APP_URL HTTPS bo‘lishi kerak.");
const database = new FarosatDatabase(config.databasePath);
const telegram = new TelegramClient(config.token);
const service = new FarosatService(database, telegram, config);
const app = await createServer(service);
await app.listen({ port: config.port, host: config.host });
console.log("Farosatxona API ochildi, port:", config.port);
const runner = new BotRunner(service);
let botPromise;
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  runner.stop();
  await botPromise;
  await app.close();
  database.close();
  release();
}
botPromise = runner.run().catch((error) => {
  console.error("Bot xatosi:", error.message);
  process.exitCode = 1;
  runner.stop();
  void shutdown().catch((shutdownError) => {
    console.error("To‘xtash xatosi:", shutdownError.message);
    release();
    process.exit(1);
  });
});
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
