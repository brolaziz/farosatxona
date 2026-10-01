import { getLevel, LEVELS } from "./levels.js";
import { localDate, previousDate, nextDayAt } from "./time.js";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { backup } from "node:sqlite";
import { HttpError } from "./auth.js";

export class FarosatService {
  constructor(database, telegram, config) {
    this.db = database;
    this.telegram = telegram;
    this.config = config;
    this.startedAt = Date.now();
    this.lastUpdate = null;
    this.refundLocks = new Set();
  }
  role(userId) {
    if (this.config.adminIds.has(String(userId)))
      return { role: "owner", chat_id: null };
    return (
      this.db.db
        .prepare("SELECT role,chat_id FROM admin_roles WHERE user_id=?")
        .get(String(userId)) || { role: "user", chat_id: null }
    );
  }
  authorize(user, permission = "read", chatId = null) {
    const role = this.role(user.id);
    const allowed = {
      read: ["owner", "admin", "moderator", "viewer"],
      manage: ["owner", "admin", "moderator"],
      finance: ["owner", "admin"],
      settings: ["owner", "admin"],
      owner: ["owner"],
    };
    if (!allowed[permission]?.includes(role.role))
      throw new HttpError(403, "Bu amal uchun ruxsat yo‘q.");
    if (role.chat_id && String(chatId) !== role.chat_id)
      throw new HttpError(
        403,
        "Faqat biriktirilgan guruhni boshqarish mumkin.",
      );
    return role;
  }
  groups(user) {
    return this.db.searchChats({ userId: user.id, limit: 500 }).items;
  }
  async membership(user, chatId) {
    const chat = this.db.getChat(chatId);
    if (
      !chat ||
      !["group", "supergroup"].includes(chat.type) ||
      !this.db.getPlayer(chatId, user.id)
    )
      throw new HttpError(403, "Avval shu guruhda /farosat yozing.");
    const member = await this.telegram.call("getChatMember", {
      chat_id: chat.chat_id,
      user_id: user.id,
    });
    if (
      ["left", "kicked"].includes(member.status) ||
      (member.status === "restricted" && !member.is_member)
    )
      throw new HttpError(403, "Siz bu guruhning a’zosi emassiz.");
    return chat;
  }
  async purchaseMembership(user, chatId) {
    const chat = await this.membership(user, chatId);
    const bot = await this.telegram.call("getChatMember", {
      chat_id: chat.chat_id,
      user_id: this.telegram.botId,
    });
    if (!["administrator", "creator"].includes(bot.status))
      throw new HttpError(
        400,
        "Xarid uchun guruhda botga admin huquqi bering.",
      );
    return chat;
  }
  profile(user, chatId) {
    const player = this.db.getPlayer(chatId, user.id);
    if (!player) throw new HttpError(404, "Guruhdagi profil topilmadi.");
    const levels = this.db.getSetting("levels", LEVELS);
    const level = getLevel(player.grams, levels),
      dailyLevel = getLevel(player.earned_grams, levels);
    const next = levels.find((l) => l.min > player.grams);
    const today = localDate(this.config.timeZone);
    const alreadyPlayed = Boolean(
      this.db.db
        .prepare(
          "SELECT 1 FROM daily_rolls WHERE chat_id=? AND user_id=? AND play_date=?",
        )
        .get(String(chatId), String(user.id), today),
    );
    const activeStreak = [today, previousDate(today)].includes(
      player.last_play_date,
    )
      ? player.streak
      : 0;
    return {
      player: { ...player, streak: activeStreak },
      level,
      dailyLevel,
      next,
      alreadyPlayed,
      nextPlayAt: nextDayAt(this.config.timeZone),
      serverTime: new Date().toISOString(),
      history: this.db.db
        .prepare(
          "SELECT * FROM ledger WHERE chat_id=? AND user_id=? ORDER BY id DESC LIMIT 50",
        )
        .all(String(chatId), String(user.id)),
      orders: this.db.db
        .prepare(
          "SELECT o.*,c.title AS chat_title FROM orders o LEFT JOIN chats c ON c.chat_id=o.chat_id WHERE o.user_id=? ORDER BY o.created_at DESC LIMIT 50",
        )
        .all(String(user.id)),
    };
  }
  async createInvoice(user, chatId, grams) {
    if (!this.config.supportUrl)
      throw new HttpError(400, "Do‘kon yordam manzili hali sozlanmagan.");
    await this.purchaseMembership(user, chatId);
    const order = this.db.createOrder(user.id, chatId, grams);
    const invoice = await this.telegram.call("createInvoiceLink", {
      title: order.grams + " gramm farosat",
      description:
        this.db.getChat(chatId).title +
        " guruhidagi hisobingiz uchun. 1 Star = 1 gramm.",
      payload: order.id,
      currency: "XTR",
      provider_token: "",
      prices: [{ label: "Farosat", amount: order.stars }],
    });
    this.db.setInvoice(order.id, invoice);
    return this.db.getOrder(order.id);
  }
  async refund(chargeId, actor, reason) {
    if (this.refundLocks.has(chargeId))
      throw new HttpError(409, "Qaytarish bajarilmoqda.");
    this.refundLocks.add(chargeId);
    try {
      const receipt = this.db.startRefund(chargeId, actor, reason);
      if (receipt.done) return { done: true };
      try {
        await this.telegram.call("refundStarPayment", {
          user_id: Number(receipt.user_id),
          telegram_payment_charge_id: chargeId,
        });
      } catch (error) {
        // Telegram may have completed a refund before our process persisted it.
        if (!/ALREADY_REFUNDED/i.test(error.message)) {
          this.db.db
            .prepare(
              "UPDATE refunds SET error=?,updated_at=CURRENT_TIMESTAMP WHERE charge_id=?",
            )
            .run(error.message, chargeId);
          throw error;
        }
      }
      this.db.finishRefund(chargeId);
      return { done: true };
    } finally {
      this.refundLocks.delete(chargeId);
    }
  }
  health() {
    const count = (table) =>
      this.db.db
        .prepare(
          "SELECT status,COUNT(*) AS count FROM " + table + " GROUP BY status",
        )
        .all();
    return {
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      lastUpdate: this.lastUpdate,
      lastBackup: this.db.getSetting("lastBackup", null),
      inbox: count("inbox"),
      outbox: count("outbox"),
      refunds: count("refunds"),
      database: this.db.db.prepare("PRAGMA quick_check").get().quick_check,
      webAppConfigured: Boolean(this.config.webAppUrl),
      botUsername: this.config.botUsername,
    };
  }
  async createBackup(actor = "system") {
    if (this.backingUp) throw new HttpError(409, "Zaxiralash bajarilmoqda.");
    this.backingUp = true;
    try {
      await mkdir(this.config.backupDir, { recursive: true });
      const file =
        "farosat-" + new Date().toISOString().replaceAll(":", "-") + ".db";
      await backup(this.db.db, resolve(this.config.backupDir, file));
      this.db.setSetting(
        "lastBackup",
        { file, at: new Date().toISOString() },
        actor,
      );
      return { file };
    } finally {
      this.backingUp = false;
    }
  }
  async reconcile(actor, offset = 0) {
    if (this.reconciling)
      throw new HttpError(409, "Solishtirish bajarilmoqda.");
    this.reconciling = true;
    try {
      const transactions = [];
      let nextOffset = offset,
        hasMore = true;
      for (let batch = 0; batch < 5 && hasMore; batch++) {
        const page = await this.telegram.call("getStarTransactions", {
          offset: nextOffset,
          limit: 100,
        });
        transactions.push(...page.transactions);
        nextOffset += page.transactions.length;
        hasMore = page.transactions.length === 100;
      }
      let recovered = 0,
        refunded = 0;
      const issues = [];
      // Incoming payments must be recovered before outgoing refunds of those payments.
      for (const transaction of transactions
        .filter((t) => t.source)
        .sort((a, b) => a.date - b.date)) {
        const partner = transaction.source;
        if (
          partner.type !== "user" ||
          partner.transaction_type !== "invoice_payment"
        )
          continue;
        const order = this.db.getOrder(partner.invoice_payload);
        if (
          !order ||
          String(partner.user?.id) !== order.user_id ||
          transaction.amount !== order.stars ||
          transaction.nanostar_amount
        ) {
          issues.push({
            id: transaction.id,
            amount: transaction.amount,
            reason: "Buyurtma ma’lumoti mos emas yoki topilmadi.",
          });
          continue;
        }
        try {
          const result = this.db.creditPayment(partner.user.id, {
            invoice_payload: order.id,
            currency: "XTR",
            total_amount: transaction.amount,
            telegram_payment_charge_id: transaction.id,
          });
          if (result.duplicateCharge)
            await this.refund(
              transaction.id,
              actor,
              "Takroriy to‘lovni solishtirish orqali qaytarish",
            );
          else if (!result.duplicate) {
            recovered++;
            this.db.enqueue(
              "receipt:" + transaction.id,
              partner.user.id,
              "✅ " +
                order.grams +
                " g xaridingiz hisobga tushdi. Buyurtma: " +
                order.id,
            );
          }
        } catch (error) {
          issues.push({
            id: transaction.id,
            amount: transaction.amount,
            reason: error.message,
          });
        }
      }
      for (const transaction of transactions.filter((t) => t.receiver)) {
        const partner = transaction.receiver;
        const receipt = this.db.db
          .prepare("SELECT * FROM receipts WHERE charge_id=?")
          .get(transaction.id);
        if (
          partner.type !== "user" ||
          !receipt ||
          String(partner.user?.id) !== receipt.user_id ||
          Math.abs(transaction.amount) !== receipt.stars ||
          receipt.status === "refunded"
        )
          continue;
        try {
          this.db.startRefund(
            receipt.charge_id,
            actor,
            "Telegram tranzaksiyalari bilan solishtirish",
          );
          this.db.finishRefund(receipt.charge_id);
          refunded++;
        } catch (error) {
          issues.push({
            id: transaction.id,
            amount: transaction.amount,
            reason: error.message,
          });
        }
      }
      const result = {
        checked: transactions.length,
        recovered,
        refunded,
        issues,
        nextOffset: hasMore ? nextOffset : null,
      };
      this.db.audit(actor, "payments:reconcile", null, result);
      return result;
    } finally {
      this.reconciling = false;
    }
  }
}
