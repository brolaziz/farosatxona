import { getConfig } from "./config.js";
import { FarosatDatabase } from "./database.js";
import { localDate } from "./time.js";
import {
  formatAlreadyPlayed,
  formatLeaderboard,
  formatLevels,
  formatProfile,
  formatRoll,
  HELP_TEXT
} from "./messages.js";
import { TelegramClient } from "./telegram.js";

const config = getConfig();
const database = new FarosatDatabase(config.databasePath);
const telegram = new TelegramClient(config.token);
const controller = new AbortController();

function displayName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Noma’lum qahramon";
}

function commandFrom(text) {
  const match = text?.match(/^\/([\w]+)(?:@[\w]+)?(?:\s|$)/u);
  return match?.[1]?.toLocaleLowerCase("uz") ?? null;
}

async function handleMessage(message) {
  const command = commandFrom(message.text);
  if (!command || !message.from || message.from.is_bot) return;

  const user = message.from;
  const common = {
    chatId: message.chat.id,
    userId: user.id,
    displayName: displayName(user),
    username: user.username
  };
  let response;

  switch (command) {
    case "start":
    case "help":
      response = HELP_TEXT;
      break;
    case "farosat": {
      const result = database.play({ ...common, playDate: localDate(config.timeZone) });
      response = result.alreadyPlayed
        ? formatAlreadyPlayed({ ...common, player: result.player })
        : formatRoll({ ...common, player: result.player, roll: result.roll });
      break;
    }
    case "men":
      response = formatProfile({ ...common, player: database.getPlayer(common.chatId, common.userId) });
      break;
    case "top":
    case "leaderboard":
      response = formatLeaderboard(database.leaderboard(common.chatId), message.chat.title ?? "Shaxsiy chat");
      break;
    case "darajalar":
      response = formatLevels();
      break;
    default:
      return;
  }

  await telegram.sendMessage(message, response);
}

async function run() {
  await telegram.setCommands();
  console.log("Farosatxona ochildi. Ctrl+C bilan yoping.");
  let offset = 0;

  while (!controller.signal.aborted) {
    try {
      const updates = await telegram.getUpdates(offset, controller.signal);
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        if (!update.message) continue;
        try {
          await handleMessage(update.message);
        } catch (error) {
          console.error(`Update ${update.update_id} bajarilmadi:`, error);
        }
      }
    } catch (error) {
      if (controller.signal.aborted) break;
      console.error("Telegram bilan aloqa uzildi:", error.message);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
    }
  }
}

function shutdown(signal) {
  console.log(`\n${signal}: bot to‘xtatilmoqda...`);
  controller.abort();
  database.close();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

run().catch((error) => {
  console.error("Bot ishga tushmadi:", error);
  database.close();
  process.exitCode = 1;
});
