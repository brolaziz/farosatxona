import Fastify from "fastify";
import { readFile, mkdir, readdir, stat } from "node:fs/promises";
import { resolve, basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Sessions, validateInitData, HttpError } from "./auth.js";
import { integer } from "./database.js";
import { LEVELS } from "./levels.js";
import { localDate } from "./time.js";

const text = (value, max = 500) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new HttpError(400, "Matnni to‘g‘ri kiriting.");
  return value.trim();
};
const page = (query) => ({
  q: String(query.q || "").slice(0, 100),
  limit: integer(Number(query.limit || 20), 1, 100),
  offset: integer(Number(query.offset || 0), 0, 1000000),
});
const csv = (rows) =>
  rows.length
    ? "\uFEFF" +
      [Object.keys(rows[0]), ...rows.map(Object.values)]
        .map((row) =>
          row
            .map(
              (value) =>
                '"' +
                String(value ?? "")
                  .replace(/^[=+@\-]/, "'$&")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n")
    : "";

export async function createServer(
  service,
  { preview = false, logger = false } = {},
) {
  const app = Fastify({ logger, bodyLimit: 32768 });
  app.decorateRequest("user", null);
  const db = service.db,
    sql = db.db,
    config = service.config,
    sessions = new Sessions();
  const limits = new Map();
  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src https://t.me https://*.telegram.org; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
    );
    if (!request.routeOptions.url?.startsWith("/api/")) return;
    reply.header("Cache-Control", "no-store");
    if (request.routeOptions.url !== "/api/session") {
      const bearer = request.headers.authorization?.match(
        /^Bearer ([a-f0-9]{64})$/,
      )?.[1];
      request.user = sessions.get(bearer);
    }
    const key =
      request.routeOptions.url === "/api/session"
        ? request.ip + ":session"
        : request.user.id + ":api";
    const now = Date.now();
    if (limits.size > 10000)
      for (const [ip, item] of limits) if (item.until < now) limits.delete(ip);
    const limit = limits.get(key) || { count: 0, until: now + 60000 };
    if (limit.until < now) {
      limit.count = 0;
      limit.until = now + 60000;
    }
    limit.count++;
    limits.set(key, limit);
    if (limit.count > (key.endsWith(":session") ? 20 : 240))
      throw new HttpError(429, "Biroz kutib qayta urinib ko‘ring.");
    if (request.routeOptions.url === "/api/session") return;
  });
  app.setErrorHandler((error, request, reply) => {
    const status =
      error.statusCode || (error.code?.startsWith("SQLITE") ? 500 : 400);
    if (status >= 500) console.error("API xatosi:", error.message);
    reply.code(status).send({
      error:
        status >= 500 ? "Server xatosi. Qayta urinib ko‘ring." : error.message,
    });
  });
  app.post("/api/session", async (request) => {
    let user;
    if (preview)
      user = {
        id: request.body?.mode === "user" ? 2002 : 1001,
        first_name: request.body?.mode === "user" ? "Aziza" : "Sardor",
        username: "farosat_demo",
      };
    else user = validateInitData(request.body?.initData, config.token);
    db.rememberUser(user);
    return {
      ...sessions.create(user),
      user,
      ...service.role(user.id),
      preview,
      botUsername: config.botUsername,
      supportUrl: config.supportUrl,
      groups: service.groups(user),
      settings: {
        maxPurchase: db.getSetting("maxPurchase", 10000),
        shopEnabled: db.getSetting("shopEnabled", true),
        maintenance: db.getSetting("maintenance", false),
      },
    };
  });
  app.get("/api/me/groups", (request) => ({
    items: service.groups(request.user),
  }));
  app.get("/api/me/profile", async (request) => {
    await service.membership(request.user, text(request.query.chatId, 30));
    return service.profile(request.user, request.query.chatId);
  });
  app.post("/api/me/play", async (request) => {
    const chat = await service.membership(
      request.user,
      text(request.body?.chatId, 30),
    );
    return db.play({
      chatId: chat.chat_id,
      userId: request.user.id,
      displayName: request.user.first_name,
      username: request.user.username,
      playDate: localDate(config.timeZone),
    });
  });
  app.get("/api/me/leaderboard", async (request) => {
    const chat = await service.membership(
      request.user,
      text(request.query.chatId, 30),
    );
    return {
      items: db.leaderboard(
        chat.chat_id,
        50,
        request.query.bucket === "earned" ? "earned" : "total",
      ),
    };
  });
  app.post("/api/me/orders", async (request) => {
    if (request.body?.acceptTerms !== true)
      throw new HttpError(400, "Xarid shartlarini tasdiqlang.");
    if (preview)
      throw new HttpError(400, "Namoyishda haqiqiy to‘lovlar o‘chirilgan.");
    return service.createInvoice(
      request.user,
      text(request.body.chatId, 30),
      integer(request.body.grams, 1, 10000),
    );
  });
  app.get("/api/me/orders/:id", (request) => {
    const order = db.getOrder(request.params.id);
    if (!order || order.user_id !== String(request.user.id))
      throw new HttpError(404, "Buyurtma topilmadi.");
    return order;
  });
  app.get("/api/admin/dashboard", (request) => {
    service.authorize(request.user);
    return db.dashboard(
      localDate(config.timeZone),
      integer(Number(request.query.days || 30), 1, 90),
    );
  });
  app.get("/api/admin/groups", (request) => {
    const role = service.role(request.user.id);
    if (role.chat_id) {
      service.authorize(request.user, "read", role.chat_id);
      return { items: [db.getChat(role.chat_id)].filter(Boolean), total: 1 };
    }
    service.authorize(request.user);
    return db.searchChats({
      ...page(request.query),
      type: String(request.query.type || ""),
    });
  });
  app.patch("/api/admin/groups/:id", (request) => {
    service.authorize(request.user, "manage", request.params.id);
    if (!db.getChat(request.params.id))
      throw new HttpError(404, "Guruh topilmadi.");
    for (const key of ["game_enabled", "shop_enabled"]) {
      if (typeof request.body?.[key] !== "boolean") continue;
      db.transaction(() => {
        sql
          .prepare("UPDATE chats SET " + key + "=? WHERE chat_id=?")
          .run(Number(request.body[key]), request.params.id);
        db.audit(request.user.id, "group:" + key, request.params.id, {
          value: request.body[key],
        });
      });
    }
    return db.getChat(request.params.id);
  });
  app.get("/api/admin/players", (request) => {
    const role = service.role(request.user.id),
      chatId = role.chat_id || String(request.query.chatId || "");
    service.authorize(request.user, "read", chatId || null);
    return db.searchPlayers({ ...page(request.query), chatId });
  });
  app.get("/api/admin/players/:chatId/:userId", (request) => {
    service.authorize(request.user, "read", request.params.chatId);
    const player = db.getPlayer(
      request.params.chatId,
      request.params.userId,
      true,
    );
    if (!player) throw new HttpError(404, "Profil topilmadi.");
    return {
      player,
      history: sql
        .prepare(
          "SELECT * FROM ledger WHERE chat_id=? AND user_id=? ORDER BY id DESC LIMIT 100",
        )
        .all(request.params.chatId, request.params.userId),
      restrictions: sql
        .prepare("SELECT * FROM restrictions WHERE chat_id=? AND user_id=?")
        .all(request.params.chatId, request.params.userId),
      orders: sql
        .prepare(
          "SELECT * FROM orders WHERE chat_id=? AND user_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .all(request.params.chatId, request.params.userId),
    };
  });
  app.post("/api/admin/adjust", (request) => {
    const body = request.body || {};
    service.authorize(request.user, "manage", body.chatId);
    const key = text(body.requestId, 100);
    const result = db.adjustPlayer(
      text(body.chatId, 30),
      text(body.userId, 30),
      integer(body.delta, -1000000, 1000000),
      request.user.id,
      text(body.reason),
      "admin:" + request.user.id + ":" + key,
    );
    if (!result) throw new HttpError(404, "Profil topilmadi.");
    return result;
  });
  app.post("/api/admin/restrictions", (request) => {
    const body = request.body || {};
    service.authorize(request.user, "manage", body.chatId);
    const chatId = text(body.chatId, 30),
      userId = text(body.userId, 30);
    if (!["game", "shop"].includes(body.kind))
      throw new HttpError(400, "Cheklov turi noto‘g‘ri.");
    if (
      body.untilAt &&
      (!Number.isFinite(Date.parse(body.untilAt)) ||
        Date.parse(body.untilAt) < Date.now())
    )
      throw new HttpError(400, "Kelajakdagi vaqtni tanlang.");
    db.transaction(() => {
      if (body.remove)
        sql
          .prepare(
            "DELETE FROM restrictions WHERE chat_id=? AND user_id=? AND kind=?",
          )
          .run(chatId, userId, body.kind);
      else
        sql
          .prepare(
            "INSERT INTO restrictions(chat_id,user_id,kind,reason,until_at) VALUES(?,?,?,?,?) ON CONFLICT(chat_id,user_id,kind) DO UPDATE SET reason=excluded.reason,until_at=excluded.until_at",
          )
          .run(
            chatId,
            userId,
            body.kind,
            text(body.reason),
            body.untilAt || null,
          );
      db.audit(request.user.id, "restriction", chatId, {
        userId,
        kind: body.kind,
        remove: Boolean(body.remove),
        reason: body.reason,
      });
    });
    return { ok: true };
  });
  app.post("/api/admin/confirmation", (request) => {
    const body = request.body || {},
      chatId = body.chatId || null;
    if (!["reset-group", "reset-all", "archive-player"].includes(body.action))
      throw new HttpError(400, "Amal noto‘g‘ri.");
    service.authorize(
      request.user,
      body.action === "reset-all" ? "owner" : "manage",
      chatId,
    );
    const token = randomUUID();
    sql
      .prepare(
        "INSERT INTO confirmations(token,actor,action,chat_id,expires_at) VALUES(?,?,?,?,?)",
      )
      .run(
        token,
        String(request.user.id),
        body.action + (body.userId ? ":" + text(body.userId, 30) : ""),
        chatId,
        Date.now() + 60000,
      );
    return { token };
  });
  app.post("/api/admin/reset", (request) => {
    const token = text(request.body?.token, 100);
    return db.transaction(() => {
      const row = sql
        .prepare(
          "SELECT * FROM confirmations WHERE token=? AND actor=? AND expires_at>?",
        )
        .get(token, String(request.user.id), Date.now());
      if (!row) throw new HttpError(400, "Tasdiq eskirgan yoki ishlatilgan.");
      service.authorize(
        request.user,
        row.action === "reset-all" ? "owner" : "manage",
        row.chat_id,
      );
      sql.prepare("DELETE FROM confirmations WHERE token=?").run(token);
      if (row.action === "reset-all") return db.clearAllScores(request.user.id);
      if (row.action === "reset-group")
        return db.clearChat(row.chat_id, request.user.id);
      return db.deletePlayer(
        row.chat_id,
        row.action.split(":")[1],
        request.user.id,
      );
    });
  });
  app.get("/api/admin/orders", (request) => {
    service.authorize(request.user, "finance");
    const p = page(request.query),
      status = String(request.query.status || "");
    const where =
      " WHERE (o.id LIKE ? OR o.user_id LIKE ?)" +
      (status ? " AND o.status=?" : "");
    const args = [
      "%" + p.q + "%",
      "%" + p.q + "%",
      ...(status ? [status] : []),
    ];
    return {
      items: sql
        .prepare(
          "SELECT o.*,c.title AS chat_title,r.charge_id,r.status AS receipt_status,f.status AS refund_status,f.error AS refund_error FROM orders o LEFT JOIN chats c ON c.chat_id=o.chat_id LEFT JOIN receipts r ON r.order_id=o.id LEFT JOIN refunds f ON f.charge_id=r.charge_id" +
            where +
            " ORDER BY o.created_at DESC LIMIT ? OFFSET ?",
        )
        .all(...args, p.limit, p.offset),
      total: sql
        .prepare("SELECT COUNT(*) AS n FROM orders o" + where)
        .get(...args).n,
    };
  });
  app.post("/api/admin/refund", (request) => {
    service.authorize(request.user, "finance");
    if (preview)
      throw new HttpError(400, "Namoyishda haqiqiy to‘lovlar o‘chirilgan.");
    return service.refund(
      text(request.body?.chargeId, 256),
      request.user.id,
      text(request.body?.reason),
    );
  });
  app.get("/api/admin/stars", async (request) => {
    service.authorize(request.user, "finance");
    return {
      balance: await service.telegram.call("getMyStarBalance"),
      transactions: await service.telegram.call("getStarTransactions", {
        limit: 100,
      }),
    };
  });
  app.post("/api/admin/reconcile", (request) => {
    service.authorize(request.user, "finance");
    if (preview)
      throw new HttpError(400, "Namoyishda haqiqiy to‘lovlar o‘chirilgan.");
    return service.reconcile(
      request.user.id,
      integer(request.body?.offset || 0, 0, 1000000),
    );
  });
  app.get("/api/admin/settings", (request) => {
    service.authorize(request.user, "settings");
    return {
      maintenance: db.getSetting("maintenance", false),
      shopEnabled: db.getSetting("shopEnabled", true),
      maxPurchase: db.getSetting("maxPurchase", 10000),
      levels: db.getSetting("levels", LEVELS),
    };
  });
  app.patch("/api/admin/settings", (request) => {
    service.authorize(request.user, "settings");
    const body = request.body || {};
    const updates = {};
    if (typeof body.maintenance === "boolean")
      updates.maintenance = body.maintenance;
    if (typeof body.shopEnabled === "boolean")
      updates.shopEnabled = body.shopEnabled;
    if (body.maxPurchase !== undefined)
      updates.maxPurchase = integer(body.maxPurchase, 1, 10000);
    if (body.levels) {
      if (!Array.isArray(body.levels) || body.levels.length !== 6)
        throw new HttpError(400, "6 ta daraja bo‘lishi kerak.");
      let last = -1;
      for (let i = 0; i < body.levels.length; i++) {
        const level = body.levels[i];
        if (level.key !== LEVELS[i].key)
          throw new HttpError(400, "Daraja identifikatori noto‘g‘ri.");
        text(level.name, 30);
        text(level.emoji, 10);
        integer(level.min, 0, 1000000);
        if (
          (i === 0 && level.min !== 0) ||
          level.min <= last ||
          !Number.isFinite(level.positiveChance) ||
          level.positiveChance < 0 ||
          level.positiveChance > 1
        )
          throw new HttpError(400, "Daraja chegarasi yoki ehtimoli noto‘g‘ri.");
        last = level.min;
        for (const range of [level.gain, level.loss]) {
          if (!Array.isArray(range) || range.length !== 2)
            throw new HttpError(400, "Oraliq noto‘g‘ri.");
          integer(range[0], 1, 1000);
          integer(range[1], range[0], 1000);
        }
      }
      updates.levels = body.levels;
    }
    db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        sql
          .prepare(
            "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          )
          .run(key, JSON.stringify(value));
        db.audit(request.user.id, "settings:" + key, null, { value });
      }
    });
    return { ok: true };
  });
  app.get("/api/admin/roles", (request) => {
    service.authorize(request.user, "owner");
    return {
      owners: [...config.adminIds],
      items: sql.prepare("SELECT * FROM admin_roles").all(),
    };
  });
  app.post("/api/admin/roles", (request) => {
    service.authorize(request.user, "owner");
    const body = request.body || {},
      id = text(body.userId, 30);
    if (!/^\d+$/.test(id) || config.adminIds.has(id))
      throw new HttpError(
        400,
        "Ega vakolatini bu yerda o‘zgartirib bo‘lmaydi.",
      );
    if (!["admin", "moderator", "viewer", "user"].includes(body.role))
      throw new HttpError(400, "Rol noto‘g‘ri.");
    if (body.role === "moderator" && !body.chatId)
      throw new HttpError(400, "Moderator uchun guruh tanlang.");
    if (body.chatId && !db.getChat(body.chatId))
      throw new HttpError(400, "Guruh topilmadi.");
    db.transaction(() => {
      if (body.role === "user")
        sql.prepare("DELETE FROM admin_roles WHERE user_id=?").run(id);
      else
        sql
          .prepare(
            "INSERT INTO admin_roles(user_id,role,chat_id) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,chat_id=excluded.chat_id",
          )
          .run(id, body.role, body.chatId || null);
      db.audit(request.user.id, "role", body.chatId || null, {
        userId: id,
        role: body.role,
      });
    });
    return { ok: true };
  });
  app.get("/api/admin/audit", (request) => {
    service.authorize(request.user);
    const p = page(request.query);
    return {
      items: sql
        .prepare(
          "SELECT * FROM audit WHERE action LIKE ? OR actor LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?",
        )
        .all("%" + p.q + "%", "%" + p.q + "%", p.limit, p.offset),
      total: sql
        .prepare(
          "SELECT COUNT(*) AS n FROM audit WHERE action LIKE ? OR actor LIKE ?",
        )
        .get("%" + p.q + "%", "%" + p.q + "%").n,
    };
  });
  app.get("/api/admin/health", (request) => {
    service.authorize(request.user, "settings");
    return {
      ...service.health(),
      errors: sql
        .prepare(
          "SELECT update_id,error,attempts,status FROM inbox WHERE error IS NOT NULL ORDER BY update_id DESC LIMIT 20",
        )
        .all(),
    };
  });
  app.post("/api/admin/retry", (request) => {
    service.authorize(request.user, "settings");
    sql
      .prepare(
        "UPDATE inbox SET status='pending',next_at=0 WHERE update_id=? AND status<>'done'",
      )
      .run(integer(request.body?.updateId));
    return { ok: true };
  });
  app.get("/api/admin/export/:type", (request, reply) => {
    service.authorize(request.user, "finance");
    const queries = {
      players: "SELECT * FROM players",
      orders: "SELECT * FROM orders",
      ledger: "SELECT * FROM ledger",
      audit: "SELECT * FROM audit",
    };
    if (!queries[request.params.type])
      throw new HttpError(404, "Eksport topilmadi.");
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        'attachment; filename="' + request.params.type + '.csv"',
      );
    return csv(sql.prepare(queries[request.params.type]).all());
  });
  app.post("/api/admin/backup", async (request) => {
    service.authorize(request.user, "owner");
    return service.createBackup(request.user.id);
  });
  app.get("/api/admin/backups", async (request) => {
    service.authorize(request.user, "owner");
    await mkdir(config.backupDir, { recursive: true });
    const files = (await readdir(config.backupDir)).filter((f) =>
      /^farosat-[\w.\-]+\.db$/.test(f),
    );
    return {
      items: await Promise.all(
        files
          .sort()
          .reverse()
          .slice(0, 100)
          .map(async (file) => ({
            file,
            size: (await stat(join(config.backupDir, file))).size,
          })),
      ),
    };
  });
  app.get("/api/admin/backups/:file", async (request, reply) => {
    service.authorize(request.user, "owner");
    if (!/^farosat-[\w.\-]+\.db$/.test(request.params.file))
      throw new HttpError(400, "Fayl nomi noto‘g‘ri.");
    reply
      .header("Content-Type", "application/octet-stream")
      .header(
        "Content-Disposition",
        'attachment; filename="' + request.params.file + '"',
      );
    return readFile(join(config.backupDir, request.params.file));
  });
  app.get("/api/admin/broadcasts", (request) => {
    service.authorize(request.user, "settings");
    return {
      items: sql
        .prepare(
          "SELECT b.*,(SELECT COUNT(*) FROM outbox WHERE source_key LIKE 'broadcast:'||b.id||':%') AS total,(SELECT COUNT(*) FROM outbox WHERE source_key LIKE 'broadcast:'||b.id||':%' AND status='done') AS sent,(SELECT COUNT(*) FROM outbox WHERE source_key LIKE 'broadcast:'||b.id||':%' AND status='failed') AS failed FROM broadcasts b ORDER BY created_at DESC LIMIT 100",
        )
        .all(),
    };
  });
  app.post("/api/admin/broadcasts", (request) => {
    service.authorize(request.user, "settings");
    const body = request.body || {},
      content = text(body.text, 3500);
    if (body.test) {
      db.enqueue("test:" + randomUUID(), request.user.id, content);
      return { ok: true };
    }
    if (!["groups", "users", "all"].includes(body.audience))
      throw new HttpError(400, "Auditoriya noto‘g‘ri.");
    const scheduled = body.scheduledAt || new Date().toISOString();
    if (!Number.isFinite(Date.parse(scheduled)))
      throw new HttpError(400, "Sana noto‘g‘ri.");
    const id = randomUUID();
    sql
      .prepare(
        "INSERT INTO broadcasts(id,actor,text,audience,scheduled_at) VALUES(?,?,?,?,?)",
      )
      .run(id, String(request.user.id), content, body.audience, scheduled);
    db.audit(request.user.id, "broadcast:create", null, {
      id,
      audience: body.audience,
      scheduled,
    });
    return { id };
  });
  app.delete("/api/admin/broadcasts/:id", (request) => {
    service.authorize(request.user, "settings");
    sql
      .prepare(
        "UPDATE broadcasts SET status='cancelled' WHERE id=? AND status='scheduled'",
      )
      .run(request.params.id);
    db.audit(request.user.id, "broadcast:cancel", null, {
      id: request.params.id,
    });
    return { ok: true };
  });
  app.get("/health", () => ({ ok: true }));
  const dist = resolve("dist");
  app.get("/", async (request, reply) => {
    reply.type("text/html");
    return readFile(join(dist, "index.html"));
  });
  app.get("/assets/:file", async (request, reply) => {
    const file = request.params.file;
    if (
      basename(file) !== file ||
      !/^[\w.\-]+\.(js|css|svg|png|woff2)$/.test(file)
    )
      throw new HttpError(404, "Fayl topilmadi.");
    const types = {
      js: "text/javascript",
      css: "text/css",
      svg: "image/svg+xml",
      png: "image/png",
      woff2: "font/woff2",
    };
    reply
      .type(types[file.split(".").pop()])
      .header("Cache-Control", "public, max-age=31536000, immutable");
    return readFile(join(dist, "assets", file));
  });
  return app;
}
