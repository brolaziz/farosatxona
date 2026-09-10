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
  mention,
  escapeHtml
} from "./messages.js";
import { TelegramClient } from "./telegram.js";

const config = getConfig();
const database = new FarosatDatabase(config.databasePath);
const telegram = new TelegramClient(config.token);
const controller = new AbortController();

const ADMIN_MENU = {
  inline_keyboard: [
    [
      { text: "📊 Umumiy holat", callback_data: "admin:stats" },
      { text: "🏘 Guruhlar", callback_data: "admin:groups" }
    ],
    [{ text: "☢️ Barcha ballarni tozalash", callback_data: "admin:all:ask" }]
  ]
};

function backButton(target = "admin:main") {
  return [{ text: "⬅️ Orqaga", callback_data: target }];
}

function groupMenu(chatId) {
  return {
    inline_keyboard: [
      [{ text: "👥 A’zolar", callback_data: `admin:members:${chatId}` }],
      [{ text: "🧹 Guruh ballarini tozalash", callback_data: `admin:gclearask:${chatId}` }],
      backButton("admin:groups")
    ]
  };
}

function memberMenu(chatId, userId) {
  return {
    inline_keyboard: [
      [
        { text: "➖10 g", callback_data: `admin:adjust:${chatId}:${userId}:-10` },
        { text: "➕10 g", callback_data: `admin:adjust:${chatId}:${userId}:10` }
      ],
      [{ text: "🗑 A’zoni o‘chirish", callback_data: `admin:pdelask:${chatId}:${userId}` }],
      backButton(`admin:members:${chatId}`)
    ]
  };
}

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
    `Guruhlar: <b>${stats.totalChats}</b>`,
    `O‘yinchilar: <b>${stats.totalPlayers}</b>`,
    `Jami farosat: <b>${stats.totalGrams} g</b>`,
    `Jami urinish: <b>${stats.totalPlays}</b>`
  ].join("\n");
}

function formatGroup(databaseChat, stats) {
  const title = databaseChat?.title ?? databaseChat?.chat_id ?? "Noma’lum guruh";
  return [
    `🏠 <b>${escapeHtml(title)}</b>`,
    `A’zolar: <b>${stats.players}</b> · Farosat: <b>${stats.grams} g</b>`,
    `Urinishlar: <b>${stats.plays}</b>`
  ].join("\n");
}

function formatMember(player) {
  return [
    `👤 <b>${escapeHtml(player.display_name)}</b>`,
    `Farosat: <b>${player.grams} g</b>`,
    `Urinishlar: <b>${player.plays}</b>`
  ].join("\n");
}

function groupsKeyboard(chats) {
  return {
    inline_keyboard: [
      ...chats.map((chat) => [{
        text: `${chat.type === "private" ? "👤" : "🏠"} ${chat.title.slice(0, 30)} · ${chat.players}`,
        callback_data: `admin:group:${chat.chat_id}`
      }]),
      backButton()
    ]
  };
}

function membersKeyboard(chatId, players) {
  return {
    inline_keyboard: [
      ...players.map((player) => [{
        text: `👤 ${player.display_name.slice(0, 28)} · ${player.grams} g`,
        callback_data: `admin:member:${chatId}:${player.user_id}`
      }]),
      backButton(`admin:group:${chatId}`)
    ]
  };
}

async function handleCallback(query) {
  if (!query.message || !query.from) return;
  if (!isAdmin(query.from.id)) {
    await telegram.answerCallbackQuery(query.id, "Bu tugma Farosatxona mudiriga tegishli.", true);
    return;
  }

  const chatId = query.message.chat.id;
  const data = query.data ?? "";
  switch (data) {
    case "admin:main":
      await telegram.answerCallbackQuery(query.id, "Bosh menyu");
      await telegram.editMessage(query.message, "🔐 <b>Farosatxona boshqaruvi</b>", ADMIN_MENU);
      break;
    case "admin:stats":
      await telegram.answerCallbackQuery(query.id, "Yangilandi");
      await telegram.editMessage(query.message, formatAdminStats(database.stats(chatId)), ADMIN_MENU);
      break;
    case "admin:groups": {
      const chats = database.listChats();
      await telegram.answerCallbackQuery(query.id, `${chats.length} ta chat`);
      await telegram.editMessage(
        query.message,
        chats.length ? "🏘 <b>Guruhlar va chatlar</b>" : "🏜 Hali birorta guruh qayd etilmagan.",
        groupsKeyboard(chats)
      );
      break;
    }
    case "admin:all:ask":
      await telegram.answerCallbackQuery(query.id, "Tasdiqlash kerak");
      await telegram.editMessage(
        query.message,
        "☢️ <b>BARCHA guruhlardagi ballar va kunlik natijalar o‘chadi.</b>\nGuruhlar ro‘yxati saqlanadi. Ortga qaytarib bo‘lmaydi.",
        { inline_keyboard: [
          [{ text: "❌ Bekor qilish", callback_data: "admin:main" }],
          [{ text: "☢️ Ha, barchasini tozalash", callback_data: "admin:all:confirm" }]
        ] }
      );
      break;
    case "admin:all:confirm": {
      const removed = database.clearAllScores();
      console.log(`Admin ${query.from.id} barcha ballarni tozaladi:`, removed);
      await telegram.answerCallbackQuery(query.id, "Barcha ballar tozalandi");
      await telegram.editMessage(query.message, `🧹 <b>${removed.players}</b> kishi va <b>${removed.rolls}</b> natija o‘chirildi.`, ADMIN_MENU);
      break;
    }
    default:
      await handleAdminTarget(query, data);
  }
}

async function handleAdminTarget(query, data) {
  const parts = data.split(":");
  const action = parts[1];
  const chatId = parts[2];
  const userId = parts[3];

  if (action === "group") {
    const chat = database.getChat(chatId) ?? { chat_id: chatId, title: chatId };
    await telegram.answerCallbackQuery(query.id, "Guruh ochildi");
    await telegram.editMessage(query.message, formatGroup(chat, database.stats(chatId)), groupMenu(chatId));
    return;
  }

  if (action === "members") {
    const players = database.leaderboard(chatId, 20);
    await telegram.answerCallbackQuery(query.id, `${players.length} ta a’zo`);
    await telegram.editMessage(
      query.message,
      players.length ? "👥 <b>A’zolar</b>" : "🏜 Bu guruhda hali o‘yinchi yo‘q.",
      membersKeyboard(chatId, players)
    );
    return;
  }

  if (action === "member") {
    const player = database.getPlayer(chatId, userId);
    await telegram.answerCallbackQuery(query.id, player ? "A’zo ochildi" : "A’zo topilmadi");
    await telegram.editMessage(
      query.message,
      player ? formatMember(player) : "Bu a’zo bazada qolmagan.",
      player ? memberMenu(chatId, userId) : membersKeyboard(chatId, database.leaderboard(chatId, 20))
    );
    return;
  }

  if (action === "adjust") {
    const delta = Number(parts[4]);
    const player = Number.isFinite(delta) ? database.adjustPlayer(chatId, userId, delta) : null;
    await telegram.answerCallbackQuery(query.id, player ? `${delta > 0 ? "+" : ""}${delta} g` : "A’zo topilmadi");
    await telegram.editMessage(
      query.message,
      player ? formatMember(player) : "Bu a’zo bazada qolmagan.",
      player ? memberMenu(chatId, userId) : membersKeyboard(chatId, database.leaderboard(chatId, 20))
    );
    return;
  }

  if (action === "pdelask") {
    const player = database.getPlayer(chatId, userId);
    await telegram.answerCallbackQuery(query.id, "Tasdiqlash kerak");
    await telegram.editMessage(
      query.message,
      `⚠️ <b>${escapeHtml(player?.display_name ?? "Bu a’zo")}</b> va uning barcha natijalari o‘chirilsinmi?`,
      { inline_keyboard: [[
        { text: "❌ Yo‘q", callback_data: `admin:member:${chatId}:${userId}` },
        { text: "🗑 Ha", callback_data: `admin:pdelconfirm:${chatId}:${userId}` }
      ]] }
    );
    return;
  }

  if (action === "pdelconfirm") {
    const removed = database.deletePlayer(chatId, userId);
    await telegram.answerCallbackQuery(query.id, "A’zo o‘chirildi");
    await telegram.editMessage(
      query.message,
      `🗑 A’zo va <b>${removed.rolls}</b> natija o‘chirildi.`,
      membersKeyboard(chatId, database.leaderboard(chatId, 20))
    );
    return;
  }

  if (action === "gclearask") {
    const chat = database.getChat(chatId);
    await telegram.answerCallbackQuery(query.id, "Tasdiqlash kerak");
    await telegram.editMessage(
      query.message,
      `⚠️ <b>${escapeHtml(chat?.title ?? chatId)}</b> guruhidagi barcha ballar o‘chirilsinmi?`,
      { inline_keyboard: [[
        { text: "❌ Yo‘q", callback_data: `admin:group:${chatId}` },
        { text: "🧹 Ha", callback_data: `admin:gclearconfirm:${chatId}` }
      ]] }
    );
    return;
  }

  if (action === "gclearconfirm") {
    const removed = database.clearChat(chatId);
    console.log(`Admin ${query.from.id} chat ${chatId} bazasini tozaladi:`, removed);
    await telegram.answerCallbackQuery(query.id, "Guruh tozalandi");
    await telegram.editMessage(
      query.message,
      `🧹 <b>${removed.players}</b> a’zo va <b>${removed.rolls}</b> natija o‘chirildi.`,
      groupMenu(chatId)
    );
    return;
  }

  await telegram.answerCallbackQuery(query.id, "Noma’lum buyruq");
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
  database.rememberChat(
    message.chat.id,
    message.chat.title || displayName(user),
    message.chat.type || "unknown"
  );
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
