import { getConfig } from "./config.js";
import { FarosatDatabase } from "./database.js";
import { localDate } from "./time.js";
import {
  formatAlreadyPlayed,
  formatLeaderboard,
  formatLevels,
  formatProfile,
  formatRoll,
  HELP_TEXT,
  mention
} from "./messages.js";
import { TelegramClient } from "./telegram.js";

const config = getConfig();
const database = new FarosatDatabase(config.databasePath);
const telegram = new TelegramClient(config.token);
const controller = new AbortController();

const ADMIN_MENU = {
  inline_keyboard: [
    [{ text: "📊 Statistika", callback_data: "admin:stats" }],
    [{ text: "🧹 Shu guruhni tozalash", callback_data: "admin:clear:ask" }]
  ]
};

const CLEAR_CONFIRMATION = {
  inline_keyboard: [[
    { text: "❌ Bekor qilish", callback_data: "admin:cancel" },
    { text: "🗑 Ha, tozalash", callback_data: "admin:clear:confirm" }
  ]]
};

function displayName(user) {
  return user.first_name || user.username || "Noma’lum";
}

function commandFrom(text) {
  const match = text?.match(/^\/([\w]+)(?:@[\w]+)?(?:\s|$)/u);
  return match?.[1]?.toLocaleLowerCase("uz") ?? null;
}

function isAdmin(userId) {
  return config.adminIds.has(String(userId));
}

function formatAdminStats(stats) {
  return [
    "📊 <b>Farosatxona hisoboti</b>",
    `Shu guruh: <b>${stats.players}</b> kishi · <b>${stats.grams} g</b> · <b>${stats.plays}</b> urinish`,
    `Barcha guruhlar: <b>${stats.totalPlayers}</b> kishi · <b>${stats.totalChats}</b> guruh`
  ].join("\n");
}

async function handleCallback(query) {
  if (!query.message || !query.from) return;
  if (!isAdmin(query.from.id)) {
    await telegram.answerCallbackQuery(query.id, "Bu tugma Farosatxona mudiriga tegishli.", true);
    return;
  }

  const chatId = query.message.chat.id;
  switch (query.data) {
    case "admin:stats":
      await telegram.answerCallbackQuery(query.id, "Yangilandi");
      await telegram.editMessage(query.message, formatAdminStats(database.stats(chatId)), ADMIN_MENU);
      break;
    case "admin:clear:ask":
      await telegram.answerCallbackQuery(query.id, "Tasdiqlash kerak");
      await telegram.editMessage(
        query.message,
        "⚠️ <b>Shu guruhdagi barcha ballar va kunlik natijalar o‘chadi.</b>\nBu amalni ortga qaytarib bo‘lmaydi.",
        CLEAR_CONFIRMATION
      );
      break;
    case "admin:clear:confirm": {
      const removed = database.clearChat(chatId);
      console.log(`Admin ${query.from.id} chat ${chatId} bazasini tozaladi:`, removed);
      await telegram.answerCallbackQuery(query.id, "Baza tozalandi");
      await telegram.editMessage(
        query.message,
        `🧹 Baza tozalandi: <b>${removed.players}</b> kishi, <b>${removed.rolls}</b> natija o‘chirildi.`,
        ADMIN_MENU
      );
      break;
    }
    case "admin:cancel":
      await telegram.answerCallbackQuery(query.id, "Bekor qilindi");
      await telegram.editMessage(query.message, "🔐 <b>Farosatxona boshqaruvi</b>", ADMIN_MENU);
      break;
    default:
      await telegram.answerCallbackQuery(query.id, "Noma’lum buyruq");
  }
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
    case "id":
      response = `🪪 ${mention(user.id, displayName(user))}, Telegram ID raqamingiz: <code>${user.id}</code>`;
      break;
    case "admin":
      if (!isAdmin(user.id)) {
        response = config.adminIds.size === 0
          ? `🔒 Admin hali belgilanmagan. /id orqali raqamingizni oling va Railway’da <code>ADMIN_IDS</code> ga yozing.`
          : "🚪 Bu eshik faqat Farosatxona mudiriga ochiladi.";
      } else {
        response = "🔐 <b>Farosatxona boshqaruvi</b>";
      }
      break;
    default:
      return;
  }

  await telegram.sendMessage(message, response, command === "admin" && isAdmin(user.id) ? ADMIN_MENU : undefined);
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
        try {
          if (update.message) await handleMessage(update.message);
          if (update.callback_query) await handleCallback(update.callback_query);
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
