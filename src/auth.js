import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.statusCode = status;
  }
}
export function validateInitData(raw, token, now = Date.now()) {
  if (typeof raw !== "string" || raw.length > 16384)
    throw new HttpError(401, "Telegram orqali qayta oching.");
  const data = new URLSearchParams(raw);
  if (new Set([...data.keys()]).size !== [...data.keys()].length)
    throw new HttpError(401, "Kirish ma’lumoti noto‘g‘ri.");
  const hash = data.get("hash");
  if (!/^[a-f0-9]{64}$/i.test(hash || ""))
    throw new HttpError(401, "Telegram orqali kiring.");
  data.delete("hash");
  const check = [...data.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => key + "=" + value)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret).update(check).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex")))
    throw new HttpError(401, "Kirish imzosi noto‘g‘ri.");
  const age = now / 1000 - Number(data.get("auth_date"));
  if (!Number.isFinite(age) || !data.has("auth_date") || age < -30 || age > 300)
    throw new HttpError(
      401,
      "Kirish muddati tugagan. Web App’ni qayta oching.",
    );
  let user;
  try {
    user = JSON.parse(data.get("user"));
  } catch {
    throw new HttpError(401, "Foydalanuvchi aniqlanmadi.");
  }
  if (!Number.isSafeInteger(user?.id) || user.id <= 0 || user.is_bot)
    throw new HttpError(401, "Foydalanuvchi aniqlanmadi.");
  return user;
}
export class Sessions {
  constructor() {
    this.items = new Map();
  }
  create(user) {
    this.prune();
    const token = randomBytes(32).toString("hex"),
      expires = Date.now() + 60 * 60_000;
    this.items.set(token, { user, expires });
    return { token, expires };
  }
  get(token) {
    const item = this.items.get(token);
    if (!item || item.expires < Date.now())
      throw new HttpError(401, "Sessiya tugadi. Qayta kiring.");
    return item.user;
  }
  prune() {
    for (const [key, value] of this.items)
      if (value.expires < Date.now()) this.items.delete(key);
  }
}
