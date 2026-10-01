import { existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { FarosatDatabase as LegacyDatabase } from "./legacy-database.js";
import { LEVELS, rollFarosat } from "./levels.js";
import { previousDate } from "./time.js";

export function integer(value, min = 0, max = 1_000_000_000) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error("Butun son va ruxsat etilgan miqdorni kiriting.");
  return value;
}
export class FarosatDatabase extends LegacyDatabase {
  constructor(path) {
    FarosatDatabase.backupBeforeMigration(path);
    super(path);
    this.path = path === ":memory:" ? path : resolve(path);
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_rolls_date ON daily_rolls(play_date); CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at DESC); CREATE INDEX IF NOT EXISTS idx_receipts_order ON receipts(order_id)",
    );
  }
  transaction(fn) {
    if (this.db.isTransaction) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  migrate() {
    this.db.exec(
      "PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT DEFAULT CURRENT_TIMESTAMP)",
    );
    if (
      this.db
        .prepare("SELECT version FROM schema_migrations WHERE version=2")
        .get()
    )
      return;
    super.migrate();
    this.transaction(() => {
      const add = (table, name, declaration) => {
        if (
          !this.db
            .prepare("PRAGMA table_info(" + table + ")")
            .all()
            .some((c) => c.name === name)
        )
          this.db.exec(
            "ALTER TABLE " + table + " ADD COLUMN " + name + " " + declaration,
          );
      };
      add(
        "players",
        "earned_grams",
        "INTEGER NOT NULL DEFAULT 0 CHECK(earned_grams>=0)",
      );
      add(
        "players",
        "paid_grams",
        "INTEGER NOT NULL DEFAULT 0 CHECK(paid_grams>=0)",
      );
      add("players", "archived", "INTEGER NOT NULL DEFAULT 0");
      add("chats", "game_enabled", "INTEGER NOT NULL DEFAULT 1");
      add("chats", "shop_enabled", "INTEGER NOT NULL DEFAULT 1");
      add("chats", "bot_status", "TEXT NOT NULL DEFAULT 'unknown'");
      this.db.exec(
        "CREATE TABLE users(user_id TEXT PRIMARY KEY,display_name TEXT NOT NULL,username TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE admin_roles(user_id TEXT PRIMARY KEY,role TEXT NOT NULL,chat_id TEXT); CREATE TABLE restrictions(chat_id TEXT NOT NULL,user_id TEXT NOT NULL,kind TEXT NOT NULL,reason TEXT NOT NULL,until_at TEXT,PRIMARY KEY(chat_id,user_id,kind)); CREATE TABLE ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,chat_id TEXT NOT NULL,user_id TEXT NOT NULL,bucket TEXT NOT NULL,delta INTEGER NOT NULL,source TEXT NOT NULL,source_key TEXT UNIQUE,actor TEXT,reason TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,chat_id TEXT,details TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,chat_id TEXT NOT NULL,grams INTEGER NOT NULL CHECK(grams>0),stars INTEGER NOT NULL CHECK(stars=grams),status TEXT NOT NULL DEFAULT 'pending',invoice_url TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL,paid_at TEXT); CREATE TABLE receipts(charge_id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),user_id TEXT NOT NULL,stars INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'credited',created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE refunds(charge_id TEXT PRIMARY KEY REFERENCES receipts(charge_id),status TEXT NOT NULL DEFAULT 'pending',reason TEXT NOT NULL,actor TEXT NOT NULL,error TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE inbox(update_id INTEGER PRIMARY KEY,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,source_key TEXT UNIQUE,chat_id TEXT NOT NULL,text TEXT NOT NULL,markup TEXT,thread_id INTEGER,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE broadcasts(id TEXT PRIMARY KEY,actor TEXT NOT NULL,text TEXT NOT NULL,audience TEXT NOT NULL,scheduled_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'scheduled',created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE confirmations(token TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,chat_id TEXT,expires_at INTEGER NOT NULL); CREATE INDEX idx_ledger_user ON ledger(chat_id,user_id,id DESC); CREATE INDEX idx_inbox_pending ON inbox(status,next_at); CREATE INDEX idx_outbox_pending ON outbox(status,next_at);",
      );
      this.db.exec(
        "UPDATE players SET earned_grams=grams; INSERT OR IGNORE INTO users(user_id,display_name,username) SELECT user_id,display_name,username FROM players; INSERT INTO ledger(chat_id,user_id,bucket,delta,source,source_key,reason) SELECT chat_id,user_id,'earned',grams,'legacy','legacy:'||chat_id||':'||user_id,'Boshlang‘ich qoldiq' FROM players WHERE grams>0; INSERT INTO schema_migrations(version) VALUES(2);",
      );
    });
  }
  static backupBeforeMigration(path) {
    if (path === ":memory:" || !existsSync(path)) return;
    const db = new LegacyDatabase(path);
    if (
      db.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE name='schema_migrations'",
        )
        .get() &&
      db.db
        .prepare("SELECT version FROM schema_migrations WHERE version=2")
        .get()
    ) {
      db.close();
      return;
    }
    db.db.exec("PRAGMA wal_checkpoint(FULL)");
    db.close();
    copyFileSync(path, path + ".before-v2-" + Date.now() + ".bak");
  }
  rememberUser(user) {
    this.db
      .prepare(
        "INSERT INTO users(user_id,display_name,username) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,username=excluded.username,updated_at=CURRENT_TIMESTAMP",
      )
      .run(
        String(user.id),
        user.first_name || user.display_name || user.username || "Noma’lum",
        user.username ?? null,
      );
  }
  ensurePlayer(chatId, userId, name, username) {
    this.db
      .prepare(
        "INSERT INTO players(chat_id,user_id,display_name,username) VALUES(?,?,?,?) ON CONFLICT(chat_id,user_id) DO UPDATE SET display_name=excluded.display_name,username=excluded.username,archived=0",
      )
      .run(String(chatId), String(userId), name, username ?? null);
  }
  getPlayer(chatId, userId, includeArchived = false) {
    return this.db
      .prepare(
        "SELECT * FROM players WHERE chat_id=? AND user_id=?" +
          (includeArchived ? "" : " AND archived=0"),
      )
      .get(String(chatId), String(userId));
  }
  addLedger(
    chatId,
    userId,
    bucket,
    delta,
    source,
    key,
    actor = null,
    reason = "",
  ) {
    this.db
      .prepare(
        "INSERT INTO ledger(chat_id,user_id,bucket,delta,source,source_key,actor,reason) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        String(chatId),
        String(userId),
        bucket,
        delta,
        source,
        key,
        actor === null ? null : String(actor),
        reason,
      );
  }
  audit(actor, action, chatId, details) {
    this.db
      .prepare(
        "INSERT INTO audit(actor,action,chat_id,details) VALUES(?,?,?,?)",
      )
      .run(
        String(actor),
        action,
        chatId === null ? null : String(chatId),
        JSON.stringify(details),
      );
  }
  getSetting(key, fallback) {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get(key);
    return row ? JSON.parse(row.value) : fallback;
  }
  setSetting(key, value, actor) {
    this.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(key, JSON.stringify(value));
      this.audit(actor, "settings:" + key, null, { value });
    });
  }
  checkRestriction(chatId, userId, kind) {
    const row = this.db
      .prepare(
        "SELECT * FROM restrictions WHERE chat_id=? AND user_id=? AND kind=? AND (until_at IS NULL OR datetime(until_at)>datetime('now'))",
      )
      .get(String(chatId), String(userId), kind);
    if (row) throw new Error("Vaqtincha cheklangan: " + row.reason);
  }
  play({
    chatId,
    userId,
    displayName,
    username,
    playDate,
    random = Math.random,
  }) {
    const chat = String(chatId),
      user = String(userId);
    if (
      this.getSetting("maintenance", false) ||
      this.getChat(chat)?.game_enabled === 0
    )
      throw new Error("O‘yin vaqtincha to‘xtatilgan.");
    this.checkRestriction(chat, user, "game");
    return this.transaction(() => {
      this.ensurePlayer(chat, user, displayName, username);
      const player = this.getPlayer(chat, user);
      const existing = this.db
        .prepare(
          "SELECT delta,grams_after FROM daily_rolls WHERE chat_id=? AND user_id=? AND play_date=?",
        )
        .get(chat, user, playDate);
      if (existing) return { alreadyPlayed: true, player, roll: existing };
      const roll = rollFarosat(
        player.earned_grams,
        random,
        this.getSetting("levels", LEVELS),
      );
      const total = roll.newGrams + player.paid_grams;
      const streak =
        player.last_play_date === previousDate(playDate)
          ? player.streak + 1
          : 1;
      this.db
        .prepare(
          "UPDATE players SET earned_grams=?,grams=?,streak=?,best_streak=?,last_play_date=?,plays=plays+1,updated_at=CURRENT_TIMESTAMP WHERE chat_id=? AND user_id=?",
        )
        .run(
          roll.newGrams,
          total,
          streak,
          Math.max(player.best_streak, streak),
          playDate,
          chat,
          user,
        );
      this.db
        .prepare(
          "INSERT INTO daily_rolls(chat_id,user_id,play_date,delta,grams_after) VALUES(?,?,?,?,?)",
        )
        .run(chat, user, playDate, roll.delta, total);
      this.addLedger(
        chat,
        user,
        "earned",
        roll.delta,
        "daily",
        "daily:" + chat + ":" + user + ":" + playDate,
      );
      return {
        alreadyPlayed: false,
        player: this.getPlayer(chat, user),
        roll: { ...roll, oldGrams: player.grams, newGrams: total },
      };
    });
  }
  leaderboard(chatId, limit = 10, bucket = "total", offset = 0) {
    const column = bucket === "earned" ? "earned_grams" : "grams";
    return this.db
      .prepare(
        "SELECT *,RANK() OVER(ORDER BY " +
          column +
          " DESC) AS rank FROM players WHERE chat_id=? AND archived=0 ORDER BY " +
          column +
          " DESC,updated_at ASC LIMIT ? OFFSET ?",
      )
      .all(String(chatId), limit, offset);
  }
  listChats(limit = 20) {
    return this.searchChats({ limit }).items;
  }
  searchChats({ q = "", limit = 20, offset = 0, type = "", userId } = {}) {
    const where =
      " WHERE (c.title LIKE ? OR c.chat_id LIKE ?)" +
      (type ? " AND c.type=?" : "") +
      (userId
        ? " AND c.chat_id IN(SELECT chat_id FROM players WHERE user_id=? AND archived=0) AND c.type IN('group','supergroup')"
        : "");
    const args = [
      "%" + q + "%",
      "%" + q + "%",
      ...(type ? [type] : []),
      ...(userId ? [String(userId)] : []),
    ];
    return {
      items: this.db
        .prepare(
          "SELECT c.*,COUNT(p.user_id) AS players,COALESCE(SUM(p.grams),0) AS grams,COALESCE(SUM(p.plays),0) AS plays FROM chats c LEFT JOIN players p ON p.chat_id=c.chat_id AND p.archived=0" +
            where +
            " GROUP BY c.chat_id ORDER BY c.updated_at DESC LIMIT ? OFFSET ?",
        )
        .all(...args, limit, offset),
      total: this.db
        .prepare("SELECT COUNT(*) AS n FROM chats c" + where)
        .get(...args).n,
    };
  }
  searchPlayers({ q = "", chatId = "", limit = 20, offset = 0 } = {}) {
    const where =
      " WHERE p.archived=0 AND (p.display_name LIKE ? OR p.username LIKE ? OR p.user_id LIKE ?)" +
      (chatId ? " AND p.chat_id=?" : "");
    const args = [
      "%" + q + "%",
      "%" + q + "%",
      "%" + q + "%",
      ...(chatId ? [String(chatId)] : []),
    ];
    return {
      items: this.db
        .prepare(
          "SELECT p.*,c.title AS chat_title FROM players p LEFT JOIN chats c ON c.chat_id=p.chat_id" +
            where +
            " ORDER BY p.grams DESC,p.user_id LIMIT ? OFFSET ?",
        )
        .all(...args, limit, offset),
      total: this.db
        .prepare("SELECT COUNT(*) AS n FROM players p" + where)
        .get(...args).n,
    };
  }
  stats(chatId) {
    const selected = this.db
      .prepare(
        "SELECT COUNT(*) AS players,COALESCE(SUM(grams),0) AS grams,COALESCE(SUM(plays),0) AS plays FROM players WHERE chat_id=? AND archived=0",
      )
      .get(String(chatId));
    const all = this.db
      .prepare(
        "SELECT COUNT(*) AS players,COUNT(DISTINCT user_id) AS users,COALESCE(SUM(grams),0) AS grams,COALESCE(SUM(plays),0) AS plays,COALESCE(SUM(paid_grams),0) AS paid FROM players WHERE archived=0",
      )
      .get();
    const chats = this.db
      .prepare(
        "SELECT COUNT(*) AS chats,SUM(type IN('group','supergroup')) AS groups,SUM(type='private') AS private FROM chats",
      )
      .get();
    const sales = this.db
      .prepare(
        "SELECT COALESCE(SUM(stars),0) AS stars,COUNT(*) AS purchases FROM receipts WHERE status='credited'",
      )
      .get();
    return {
      ...selected,
      totalPlayers: all.players,
      uniqueUsers: all.users,
      totalChats: chats.chats,
      groups: chats.groups || 0,
      privateChats: chats.private || 0,
      totalGrams: all.grams,
      totalPlays: this.db.prepare("SELECT COUNT(*) AS n FROM daily_rolls").get()
        .n,
      paidGrams: all.paid,
      stars: sales.stars,
      purchases: sales.purchases,
    };
  }
  dashboard(playDate, days = 30) {
    const stats = this.stats();
    stats.todayPlays = this.db
      .prepare("SELECT COUNT(*) AS n FROM daily_rolls WHERE play_date=?")
      .get(playDate).n;
    stats.todayStars = this.db
      .prepare(
        "SELECT COALESCE(SUM(stars),0) AS n FROM receipts WHERE status='credited' AND date(created_at,'+5 hours')=?",
      )
      .get(playDate).n;
    return {
      stats,
      activity: this.db
        .prepare(
          "SELECT play_date AS day,COUNT(*) AS plays,SUM(delta) AS grams FROM daily_rolls WHERE play_date>=date(?,'-'||?||' days') GROUP BY play_date ORDER BY play_date",
        )
        .all(playDate, days - 1),
      sales: this.db
        .prepare(
          "SELECT date(created_at,'+5 hours') AS day,SUM(stars) AS stars FROM receipts WHERE status='credited' AND date(created_at,'+5 hours')>=date(?,'-'||?||' days') GROUP BY day ORDER BY day",
        )
        .all(playDate, days - 1),
      recent: this.db
        .prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 8")
        .all(),
    };
  }
  adjustPlayer(
    chatId,
    userId,
    delta,
    actor = "system",
    reason = "Admin tuzatishi",
    key = randomUUID(),
  ) {
    integer(delta, -1_000_000, 1_000_000);
    return this.transaction(() => {
      const player = this.getPlayer(chatId, userId);
      if (!player) return undefined;
      if (this.db.prepare("SELECT id FROM ledger WHERE source_key=?").get(key))
        return player;
      const earned = Math.max(0, player.earned_grams + delta);
      integer(earned + player.paid_grams);
      this.db
        .prepare(
          "UPDATE players SET earned_grams=?,grams=?,updated_at=CURRENT_TIMESTAMP WHERE chat_id=? AND user_id=?",
        )
        .run(
          earned,
          earned + player.paid_grams,
          String(chatId),
          String(userId),
        );
      this.addLedger(
        chatId,
        userId,
        "earned",
        earned - player.earned_grams,
        "admin",
        key,
        actor,
        reason,
      );
      this.audit(actor, "balance", chatId, {
        userId,
        before: player.grams,
        after: earned + player.paid_grams,
        reason,
      });
      return this.getPlayer(chatId, userId);
    });
  }
  reset(where, args, actor, action) {
    return this.transaction(() => {
      const players = this.db
        .prepare("SELECT * FROM players WHERE archived=0" + where)
        .all(...args);
      let rolls = 0;
      for (const p of players) {
        rolls += this.db
          .prepare(
            "SELECT COUNT(*) AS n FROM daily_rolls WHERE chat_id=? AND user_id=?",
          )
          .get(p.chat_id, p.user_id).n;
        this.addLedger(
          p.chat_id,
          p.user_id,
          "earned",
          -p.earned_grams,
          "reset",
          randomUUID(),
          actor,
          action,
        );
        this.db
          .prepare(
            "UPDATE players SET earned_grams=0,grams=paid_grams,archived=CASE WHEN paid_grams=0 THEN 1 ELSE 0 END,updated_at=CURRENT_TIMESTAMP WHERE chat_id=? AND user_id=?",
          )
          .run(p.chat_id, p.user_id);
      }
      this.audit(actor, action, args[0] ?? null, {
        players: players.length,
        paidPreserved: true,
      });
      return { players: players.length, rolls };
    });
  }
  deletePlayer(chatId, userId, actor = "system") {
    return this.reset(
      " AND chat_id=? AND user_id=?",
      [String(chatId), String(userId)],
      actor,
      "player:archive",
    );
  }
  clearChat(chatId, actor = "system") {
    return this.reset(" AND chat_id=?", [String(chatId)], actor, "chat:reset");
  }
  clearAllScores(actor = "system") {
    return this.reset("", [], actor, "all:reset");
  }
  createOrder(userId, chatId, grams) {
    integer(grams, 1, this.getSetting("maxPurchase", 10000));
    if (
      this.getSetting("maintenance", false) ||
      this.getSetting("shopEnabled", true) === false
    )
      throw new Error("Do‘kon vaqtincha yopiq.");
    const group = this.getChat(chatId);
    if (
      !group ||
      !["group", "supergroup"].includes(group.type) ||
      !group.shop_enabled ||
      ["left", "kicked"].includes(group.bot_status)
    )
      throw new Error("Bu guruhda xarid mavjud emas.");
    if (!this.getPlayer(chatId, userId))
      throw new Error("Avval shu guruhda /farosat yozing.");
    this.checkRestriction(chatId, userId, "shop");
    const id = randomUUID(),
      expiry = new Date(Date.now() + 30 * 60_000).toISOString();
    this.db
      .prepare(
        "INSERT INTO orders(id,user_id,chat_id,grams,stars,expires_at) VALUES(?,?,?,?,?,?)",
      )
      .run(id, String(userId), String(chatId), grams, grams, expiry);
    return this.getOrder(id);
  }
  getOrder(id) {
    return this.db.prepare("SELECT * FROM orders WHERE id=?").get(id);
  }
  setInvoice(id, url) {
    this.db
      .prepare(
        "UPDATE orders SET invoice_url=? WHERE id=? AND status='pending'",
      )
      .run(url, id);
  }
  validateCheckout(query) {
    const order = this.getOrder(query.invoice_payload);
    if (
      !order ||
      order.status !== "pending" ||
      Date.parse(order.expires_at) < Date.now() ||
      order.user_id !== String(query.from.id) ||
      query.currency !== "XTR" ||
      query.total_amount !== order.stars
    )
      throw new Error("Buyurtma eskirgan yoki to‘lov ma’lumotlari mos emas.");
    const group = this.getChat(order.chat_id);
    if (
      !group?.shop_enabled ||
      this.getSetting("maintenance", false) ||
      !this.getSetting("shopEnabled", true)
    )
      throw new Error("Do‘kon vaqtincha yopiq.");
    this.checkRestriction(order.chat_id, order.user_id, "shop");
    return order;
  }
  creditPayment(userId, payment) {
    return this.transaction(() => {
      const existing = this.db
        .prepare("SELECT * FROM receipts WHERE charge_id=?")
        .get(payment.telegram_payment_charge_id);
      if (existing)
        return {
          duplicate: true,
          duplicateCharge: existing.status === "duplicate",
          refunded: existing.status === "refunded",
          order: this.getOrder(existing.order_id),
        };
      const order = this.getOrder(payment.invoice_payload);
      if (
        !order ||
        order.user_id !== String(userId) ||
        payment.currency !== "XTR" ||
        payment.total_amount !== order.stars ||
        !payment.telegram_payment_charge_id
      )
        throw new Error("To‘lovni operator tekshirishi kerak.");
      const duplicateOrder = order.status !== "pending";
      this.db
        .prepare(
          "INSERT INTO receipts(charge_id,order_id,user_id,stars,status) VALUES(?,?,?,?,?)",
        )
        .run(
          payment.telegram_payment_charge_id,
          order.id,
          String(userId),
          order.stars,
          duplicateOrder ? "duplicate" : "credited",
        );
      if (duplicateOrder) return { duplicateCharge: true, order };
      const user = this.db
        .prepare("SELECT * FROM users WHERE user_id=?")
        .get(String(userId));
      const old = this.getPlayer(order.chat_id, userId, true);
      this.ensurePlayer(
        order.chat_id,
        userId,
        user?.display_name || old?.display_name || "O‘yinchi",
        user?.username ?? old?.username,
      );
      const player = this.getPlayer(order.chat_id, userId);
      integer(player.grams + order.grams);
      this.db
        .prepare(
          "UPDATE players SET paid_grams=paid_grams+?,grams=grams+?,updated_at=CURRENT_TIMESTAMP WHERE chat_id=? AND user_id=?",
        )
        .run(order.grams, order.grams, order.chat_id, String(userId));
      this.addLedger(
        order.chat_id,
        userId,
        "paid",
        order.grams,
        "payment",
        "payment:" + payment.telegram_payment_charge_id,
      );
      this.db
        .prepare(
          "UPDATE orders SET status='credited',paid_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .run(order.id);
      return {
        order: this.getOrder(order.id),
        player: this.getPlayer(order.chat_id, userId),
      };
    });
  }
  startRefund(chargeId, actor, reason) {
    return this.transaction(() => {
      const receipt = this.db
        .prepare(
          "SELECT r.*,o.chat_id,o.grams FROM receipts r JOIN orders o ON o.id=r.order_id WHERE charge_id=?",
        )
        .get(chargeId);
      if (!receipt) throw new Error("To‘lov topilmadi.");
      const refund = this.db
        .prepare("SELECT * FROM refunds WHERE charge_id=?")
        .get(chargeId);
      if (receipt.status === "refunded" || refund?.status === "completed")
        return { ...receipt, done: true };
      const player = this.getPlayer(receipt.chat_id, receipt.user_id, true);
      if (
        receipt.status === "credited" &&
        (!player || player.paid_grams < receipt.grams)
      )
        throw new Error("Xarid balansi yetarli emas.");
      this.db
        .prepare(
          "INSERT INTO refunds(charge_id,reason,actor) VALUES(?,?,?) ON CONFLICT(charge_id) DO UPDATE SET error=NULL,updated_at=CURRENT_TIMESTAMP",
        )
        .run(chargeId, reason, String(actor));
      return receipt;
    });
  }
  finishRefund(chargeId) {
    return this.transaction(() => {
      const row = this.db
        .prepare(
          "SELECT r.*,o.chat_id,o.grams,f.actor,f.reason FROM receipts r JOIN orders o ON o.id=r.order_id JOIN refunds f ON f.charge_id=r.charge_id WHERE r.charge_id=?",
        )
        .get(chargeId);
      if (!row || row.status === "refunded") return;
      if (row.status === "credited") {
        this.db
          .prepare(
            "UPDATE players SET paid_grams=paid_grams-?,grams=grams-? WHERE chat_id=? AND user_id=?",
          )
          .run(row.grams, row.grams, row.chat_id, row.user_id);
        this.addLedger(
          row.chat_id,
          row.user_id,
          "paid",
          -row.grams,
          "refund",
          "refund:" + chargeId,
          row.actor,
          row.reason,
        );
        this.db
          .prepare("UPDATE orders SET status='refunded' WHERE id=?")
          .run(row.order_id);
      }
      this.db
        .prepare("UPDATE receipts SET status='refunded' WHERE charge_id=?")
        .run(chargeId);
      this.db
        .prepare(
          "UPDATE refunds SET status='completed',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE charge_id=?",
        )
        .run(chargeId);
      this.audit(row.actor, "refund", row.chat_id, {
        chargeId,
        stars: row.stars,
        reason: row.reason,
      });
    });
  }
  receiveUpdates(updates) {
    this.transaction(() => {
      for (const update of updates)
        this.db
          .prepare("INSERT OR IGNORE INTO inbox(update_id,payload) VALUES(?,?)")
          .run(update.update_id, JSON.stringify(update));
    });
  }
  enqueue(source, chatId, text, markup, threadId) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO outbox(source_key,chat_id,text,markup,thread_id) VALUES(?,?,?,?,?)",
      )
      .run(
        source,
        String(chatId),
        text,
        markup ? JSON.stringify(markup) : null,
        threadId ?? null,
      );
  }
  migrateChat(oldId, newId) {
    this.transaction(() => {
      if (this.getChat(newId))
        throw new Error("Guruh migratsiyasini operator tekshirishi kerak.");
      for (const table of [
        "chats",
        "players",
        "daily_rolls",
        "ledger",
        "orders",
        "restrictions",
        "admin_roles",
        "audit",
        "confirmations",
      ])
        this.db
          .prepare("UPDATE " + table + " SET chat_id=? WHERE chat_id=?")
          .run(String(newId), String(oldId));
    });
  }
}
