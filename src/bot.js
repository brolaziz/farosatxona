import { setTimeout as delay } from "node:timers/promises";
import { localDate } from "./time.js";
import { LEVELS } from "./levels.js";
import {
  formatAlreadyPlayed,
  formatRoll,
  formatProfile,
  formatLeaderboard,
  formatLevels,
  escapeHtml,
  HELP_TEXT,
} from "./messages.js";

export const TERMS =
  "1 Telegram Star = 1 gramm farosat. Xarid faqat tanlangan guruhdagi hisobga tushadi. Xarid grammiga kunlik minus va reset ta’sir qilmaydi. Kunlik omad ishlab topilgan farosatga bog‘liq. Xarid muvaffaqiyatli to‘lov tasdiqlangach bajariladi. Muammo bo‘lsa /paysupport orqali buyurtma raqamini yuboring. Qaytarish operator tomonidan tekshiriladi va to‘liq to‘lov bo‘yicha bajariladi.";
export function commandFrom(text, username) {
  const match = text?.match(/^\/([\w]+)(?:@([\w]+))?(?:\s|$)/u);
  if (
    !match ||
    (match[2] && match[2].toLowerCase() !== username?.toLowerCase())
  )
    return null;
  return match[1].toLowerCase();
}
export class BotRunner {
  constructor(service) {
    this.service = service;
    this.db = service.db;
    this.telegram = service.telegram;
    this.config = service.config;
    this.controller = new AbortController();
  }
  markup(chatId, admin = false) {
    if (!this.config.webAppUrl) return undefined;
    const url = new URL(this.config.webAppUrl);
    if (chatId && String(chatId).startsWith("-"))
      url.searchParams.set("group", String(chatId));
    if (admin) url.searchParams.set("view", "admin");
    if (chatId && String(chatId).startsWith("-")) {
      if (!this.config.botUsername) return undefined;
      return {
        inline_keyboard: [
          [
            {
              text: "🌑 Qora bozor",
              url:
                "https://t.me/" +
                this.config.botUsername +
                "?startapp=group_" +
                String(chatId).replace("-", ""),
            },
          ],
        ],
      };
    }
    return {
      inline_keyboard: [
        [
          {
            text: admin ? "🔐 Boshqaruvni ochish" : "🌑 Farosatxonani ochish",
            web_app: { url: url.href },
          },
        ],
      ],
    };
  }
  async preCheckout(query) {
    try {
      const order = this.db.validateCheckout(query);
      const member = await this.telegram.call(
        "getChatMember",
        { chat_id: order.chat_id, user_id: query.from.id },
        { timeoutMs: 3000 },
      );
      if (
        ["left", "kicked"].includes(member.status) ||
        (member.status === "restricted" && !member.is_member)
      )
        throw new Error("Guruh a’zoligi tugagan.");
      await this.telegram.call(
        "answerPreCheckoutQuery",
        { pre_checkout_query_id: query.id, ok: true },
        { timeoutMs: 3000 },
      );
    } catch (error) {
      await this.telegram.call(
        "answerPreCheckoutQuery",
        {
          pre_checkout_query_id: query.id,
          ok: false,
          error_message: error.message.slice(0, 180),
        },
        { timeoutMs: 3000 },
      );
    }
  }
  async handle(update) {
    if (update.pre_checkout_query) {
      await this.preCheckout(update.pre_checkout_query);
      return;
    }
    if (update.my_chat_member) {
      const event = update.my_chat_member;
      this.db.rememberChat(
        event.chat.id,
        event.chat.title || "Shaxsiy chat",
        event.chat.type,
      );
      this.db.db
        .prepare("UPDATE chats SET bot_status=? WHERE chat_id=?")
        .run(event.new_chat_member.status, String(event.chat.id));
      return;
    }
    if (update.callback_query) {
      await this.telegram.answerCallbackQuery(
        update.callback_query.id,
        "Boshqaruv Web App’ga ko‘chirildi. /admin yozing.",
        true,
      );
      return;
    }
    const message = update.message;
    if (!message) return;
    if (message.migrate_to_chat_id) {
      this.db.migrateChat(message.chat.id, message.migrate_to_chat_id);
      return;
    }
    if (message.migrate_from_chat_id) {
      if (this.db.getChat(message.migrate_from_chat_id))
        this.db.migrateChat(message.migrate_from_chat_id, message.chat.id);
      return;
    }
    if (message.refunded_payment) {
      const receipt = this.db.db
        .prepare("SELECT * FROM receipts WHERE charge_id=?")
        .get(message.refunded_payment.telegram_payment_charge_id);
      if (
        receipt &&
        message.refunded_payment.currency === "XTR" &&
        message.refunded_payment.total_amount === receipt.stars
      ) {
        this.db.startRefund(
          receipt.charge_id,
          "telegram",
          "Telegram tasdiqlagan qaytarish",
        );
        this.db.finishRefund(receipt.charge_id);
      }
      return;
    }
    if (!message.from || message.from.is_bot) return;
    this.db.rememberUser(message.from);
    if (message.successful_payment) {
      const result = this.db.creditPayment(
        message.from.id,
        message.successful_payment,
      );
      if (result.refunded) return;
      if (result.duplicateCharge) {
        await this.service.refund(
          message.successful_payment.telegram_payment_charge_id,
          "system",
          "Takroriy buyurtma uchun ikkinchi to‘lov",
        );
        return;
      }
      this.db.enqueue(
        "receipt:" + message.successful_payment.telegram_payment_charge_id,
        message.from.id,
        "✅ <b>" +
          result.order.grams +
          " g</b> farosat qo‘shildi.\nGuruh: " +
          escapeHtml(
            this.db.getChat(result.order.chat_id)?.title ||
              result.order.chat_id,
          ) +
          "\nBuyurtma: <code>" +
          result.order.id +
          "</code>",
        this.markup(message.from.id),
      );
      return;
    }
    const command = commandFrom(message.text, this.config.botUsername);
    if (!command) return;
    this.db.rememberChat(
      message.chat.id,
      message.chat.title || message.from.first_name || "Shaxsiy chat",
      message.chat.type,
    );
    const common = {
      chatId: message.chat.id,
      userId: message.from.id,
      displayName:
        message.from.first_name || message.from.username || "O‘yinchi",
      username: message.from.username,
    };
    let response, markup;
    switch (command) {
      case "start":
      case "help":
        response = HELP_TEXT;
        markup = this.markup(message.chat.id);
        break;
      case "farosat": {
        try {
          const result = this.db.play({
            ...common,
            playDate: localDate(this.config.timeZone),
          });
          response = result.alreadyPlayed
            ? formatAlreadyPlayed({ ...common, player: result.player })
            : formatRoll({ ...common, ...result });
          if (
            !result.alreadyPlayed &&
            result.roll.oldLevel.key !== result.roll.newLevel.key
          )
            response +=
              "\n" +
              result.roll.newLevel.emoji +
              " Kunlik daraja: <b>" +
              result.roll.newLevel.name +
              "</b>";
        } catch (error) {
          response = escapeHtml(error.message);
        }
        break;
      }
      case "men":
        response = formatProfile({
          ...common,
          player: this.db.getPlayer(common.chatId, common.userId),
          levels: this.db.getSetting("levels", LEVELS),
        });
        markup = this.markup(message.chat.id);
        break;
      case "top":
      case "leaderboard":
        response = formatLeaderboard(
          this.db.leaderboard(common.chatId),
          message.chat.title || "Shaxsiy chat",
          this.db.getSetting("levels", LEVELS),
        );
        break;
      case "darajalar":
        response = formatLevels(this.db.getSetting("levels", LEVELS));
        break;
      case "id":
        response = "🪪 Telegram ID: <code>" + message.from.id + "</code>";
        break;
      case "terms":
        response = escapeHtml(TERMS);
        break;
      case "paysupport":
        response =
          "Xarid bo‘yicha yordam uchun buyurtma raqamini yuboring." +
          (this.config.supportUrl
            ? "\n" + escapeHtml(this.config.supportUrl)
            : "\nHozir bot ma’muriga murojaat qiling.");
        break;
      case "bozor":
        response = this.config.webAppUrl
          ? "🌑 <b>Qora bozor</b>\n1 ⭐ = 1 g farosat. Xaridda guruhni tanlang."
          : "Do‘kon hali ochilmagan.";
        markup = this.markup(message.chat.id);
        break;
      case "admin": {
        const role = this.service.role(message.from.id);
        if (role.role === "user") {
          response = "🔒 Bu bo‘lim faqat ma’muriyat uchun.";
          break;
        }
        if (message.chat.type !== "private") {
          response = "🔐 Boshqaruvni botning shaxsiy chatida oching.";
          if (this.config.botUsername)
            markup = {
              inline_keyboard: [
                [
                  {
                    text: "Boshqaruvga o‘tish",
                    url:
                      "https://t.me/" +
                      this.config.botUsername +
                      "?start=admin",
                  },
                ],
              ],
            };
        } else {
          response = this.config.webAppUrl
            ? "🔐 <b>Farosatxona boshqaruvi</b>"
            : "Web App manzili hali sozlanmagan.";
          markup = this.markup(message.chat.id, true);
        }
        break;
      }
      default:
        return;
    }
    if (
      command === "start" &&
      /\sadmin$/.test(message.text) &&
      this.service.role(message.from.id).role !== "user"
    ) {
      response = "🔐 <b>Farosatxona boshqaruvi</b>";
      markup = this.markup(message.chat.id, true);
    }
    this.db.enqueue(
      "reply:" + update.update_id,
      message.chat.id,
      response,
      markup,
      message.message_thread_id,
    );
  }
  async poll() {
    let offset = this.db.db
      .prepare("SELECT COALESCE(MAX(update_id)+1,0) AS n FROM inbox")
      .get().n;
    while (!this.controller.signal.aborted) {
      try {
        const updates = await this.telegram.getUpdates(
          offset,
          this.controller.signal,
        );
        this.db.receiveUpdates(updates);
        for (const update of updates) {
          offset = Math.max(offset, update.update_id + 1);
          if (update.pre_checkout_query) {
            const claim = this.db.db
              .prepare(
                "UPDATE inbox SET status='processing' WHERE update_id=? AND status='pending'",
              )
              .run(update.update_id);
            if (!claim.changes) continue;
            try {
              await this.preCheckout(update.pre_checkout_query);
              this.db.db
                .prepare("UPDATE inbox SET status='done' WHERE update_id=?")
                .run(update.update_id);
            } catch (error) {
              this.failInbox(update.update_id, error, 1);
            }
          }
        }
        this.service.lastUpdate = new Date().toISOString();
      } catch (error) {
        if (!this.controller.signal.aborted) {
          console.error(error.message);
          await delay(2000, undefined, {
            signal: this.controller.signal,
          }).catch(() => {});
        }
      }
    }
  }
  failInbox(id, error, attempts) {
    const checkout = this.db.db
      .prepare(
        "SELECT json_extract(payload,'$.pre_checkout_query') AS value FROM inbox WHERE update_id=?",
      )
      .get(id)?.value;
    const failed = Boolean(checkout) || attempts >= 10 || error.code === 400;
    this.db.db
      .prepare(
        "UPDATE inbox SET status=?,attempts=?,error=?,next_at=? WHERE update_id=?",
      )
      .run(
        failed ? "failed" : "pending",
        attempts,
        error.message,
        Date.now() + Math.min(300000, 1000 * 2 ** attempts),
        id,
      );
    if (failed)
      for (const owner of this.config.adminIds)
        this.db.enqueue(
          "error:" + id,
          owner,
          "⚠️ Update " +
            id +
            " bajarilmadi. Admin Web App → Tizim holatini tekshiring.",
        );
  }
  async incoming() {
    while (!this.controller.signal.aborted) {
      const rows = this.db.db
        .prepare(
          "SELECT * FROM inbox WHERE status='pending' AND next_at<=? ORDER BY (json_extract(payload,'$.pre_checkout_query') IS NOT NULL) DESC,update_id LIMIT 20",
        )
        .all(Date.now());
      for (const row of rows) {
        const claim = this.db.db
          .prepare(
            "UPDATE inbox SET status='processing' WHERE update_id=? AND status='pending'",
          )
          .run(row.update_id);
        if (!claim.changes) continue;
        try {
          await this.handle(JSON.parse(row.payload));
          this.db.db
            .prepare(
              "UPDATE inbox SET status='done',error=NULL WHERE update_id=?",
            )
            .run(row.update_id);
        } catch (error) {
          this.failInbox(row.update_id, error, row.attempts + 1);
        }
      }
      await delay(200, undefined, { signal: this.controller.signal }).catch(
        () => {},
      );
    }
  }
  scheduleBroadcasts() {
    const sql = this.db.db;
    for (const job of sql
      .prepare(
        "SELECT * FROM broadcasts WHERE status='scheduled' AND datetime(scheduled_at)<=datetime('now')",
      )
      .all()) {
      this.db.transaction(() => {
        const ids = new Set();
        if (["groups", "all"].includes(job.audience))
          for (const c of sql
            .prepare(
              "SELECT chat_id FROM chats WHERE type IN('group','supergroup') AND bot_status NOT IN('left','kicked')",
            )
            .all())
            ids.add(c.chat_id);
        if (["users", "all"].includes(job.audience))
          for (const u of sql
            .prepare("SELECT chat_id FROM chats WHERE type='private'")
            .all())
            ids.add(u.chat_id);
        for (const id of ids)
          this.db.enqueue(
            "broadcast:" + job.id + ":" + id,
            id,
            escapeHtml(job.text),
          );
        sql
          .prepare("UPDATE broadcasts SET status='queued' WHERE id=?")
          .run(job.id);
      });
    }
  }
  async outgoing() {
    let nextSetup = 0,
      nextBackup = 0;
    while (!this.controller.signal.aborted) {
      if (Date.now() >= nextSetup) {
        try {
          await this.telegram.setCommands();
          if (this.config.webAppUrl)
            await this.telegram.call(
              "setChatMenuButton",
              {
                menu_button: {
                  type: "web_app",
                  text: "Farosatxona",
                  web_app: { url: this.config.webAppUrl },
                },
              },
              { signal: this.controller.signal },
            );
          nextSetup = Date.now() + 3600000;
        } catch (error) {
          console.error("Bot menyusi:", error.message);
          nextSetup = Date.now() + 60000;
        }
      }
      if (this.config.autoBackup && Date.now() >= nextBackup) {
        const last = this.db.getSetting("lastBackup", null);
        if (!last || Date.now() - Date.parse(last.at) > 86400000)
          await this.service
            .createBackup()
            .catch((error) => console.error("Zaxira:", error.message));
        nextBackup = Date.now() + 3600000;
      }
      this.scheduleBroadcasts();
      const rows = this.db.db
        .prepare(
          "SELECT * FROM outbox WHERE status='pending' AND next_at<=? ORDER BY id LIMIT 15",
        )
        .all(Date.now());
      for (const row of rows) {
        try {
          await this.telegram.call(
            "sendMessage",
            {
              chat_id: row.chat_id,
              text: row.text,
              parse_mode: "HTML",
              link_preview_options: { is_disabled: true },
              ...(row.markup ? { reply_markup: JSON.parse(row.markup) } : {}),
              ...(row.thread_id ? { message_thread_id: row.thread_id } : {}),
            },
            { signal: this.controller.signal },
          );
          this.db.db
            .prepare("UPDATE outbox SET status='done',error=NULL WHERE id=?")
            .run(row.id);
        } catch (error) {
          if (error.migrateTo) {
            this.db.migrateChat(row.chat_id, error.migrateTo);
            this.db.db
              .prepare("UPDATE outbox SET chat_id=? WHERE id=?")
              .run(String(error.migrateTo), row.id);
          }
          this.db.db
            .prepare(
              "UPDATE outbox SET status=?,attempts=attempts+1,error=?,next_at=? WHERE id=?",
            )
            .run(
              [400, 403].includes(error.code) || row.attempts >= 10
                ? "failed"
                : "pending",
              error.message,
              Date.now() + Math.min(300000, 1000 * 2 ** row.attempts),
              row.id,
            );
        }
        await delay(60, undefined, { signal: this.controller.signal }).catch(
          () => {},
        );
      }
      for (const row of this.db.db
        .prepare(
          "SELECT charge_id,actor,reason FROM refunds WHERE status='pending' AND datetime(updated_at)<datetime('now','-1 minute') LIMIT 5",
        )
        .all()) {
        await this.service
          .refund(row.charge_id, row.actor, row.reason)
          .catch(() => {});
      }
      await delay(500, undefined, { signal: this.controller.signal }).catch(
        () => {},
      );
    }
  }
  async run() {
    this.db.db
      .prepare("UPDATE inbox SET status='pending' WHERE status='processing'")
      .run();
    let me;
    while (!this.controller.signal.aborted && !me) {
      try {
        me = await this.telegram.call(
          "getMe",
          {},
          { signal: this.controller.signal },
        );
      } catch (error) {
        console.error("Telegram ulanishi:", error.message);
        if (error.code === 401 || error.code === 404) throw error;
        await delay(5000, undefined, { signal: this.controller.signal }).catch(
          () => {},
        );
      }
    }
    if (!me) return;
    this.telegram.botId = me.id;
    this.config.botUsername = me.username;
    const workers = [this.poll(), this.incoming(), this.outgoing()];
    try {
      await Promise.all(workers);
    } finally {
      this.stop();
      await Promise.allSettled(workers);
    }
  }
  stop() {
    this.controller.abort();
  }
}
