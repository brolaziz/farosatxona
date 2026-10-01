import { setTimeout as delay } from "node:timers/promises";

export class TelegramError extends Error {
  constructor(method, payload) {
    super(
      "Telegram " + method + ": " + (payload.description || "Aloqa xatosi"),
    );
    this.code = payload.error_code;
    this.retryAfter = payload.parameters?.retry_after;
    this.migrateTo = payload.parameters?.migrate_to_chat_id;
  }
}
export class TelegramClient {
  constructor(token) {
    this.baseUrl = "https://api.telegram.org/bot" + token;
  }
  async call(method, body = {}, options = {}) {
    const { signal, timeoutMs = method === "getUpdates" ? 40000 : 8000 } =
      options;
    for (let attempt = 0; attempt < 3; attempt++) {
      const timeout = AbortSignal.timeout(timeoutMs);
      let response;
      try {
        response = await fetch(this.baseUrl + "/" + method, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch {
        throw new TelegramError(method, {
          description: signal?.aborted
            ? "To‘xtatildi"
            : "Aloqa yoki vaqt tugashi",
          error_code: 503,
        });
      }
      const payload = await response.json();
      if (response.ok && payload.ok) return payload.result;
      const error = new TelegramError(method, payload);
      if (
        error.code === 429 &&
        error.retryAfter &&
        attempt < 2 &&
        timeoutMs >= 8000
      ) {
        await delay(Math.min(error.retryAfter, 60) * 1000, undefined, {
          signal,
        });
        continue;
      }
      if (
        method === "editMessageText" &&
        /message is not modified/i.test(error.message)
      )
        return null;
      throw error;
    }
  }
  getUpdates(offset, signal) {
    return this.call(
      "getUpdates",
      {
        offset,
        timeout: 30,
        allowed_updates: [
          "message",
          "callback_query",
          "pre_checkout_query",
          "my_chat_member",
        ],
      },
      { signal },
    );
  }
  sendMessage(message, text, replyMarkup) {
    return this.call("sendMessage", {
      chat_id: message.chat.id,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_parameters: {
        message_id: message.message_id,
        allow_sending_without_reply: true,
      },
      ...(message.message_thread_id
        ? { message_thread_id: message.message_thread_id }
        : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }
  answerCallbackQuery(id, text, showAlert = false) {
    return this.call(
      "answerCallbackQuery",
      { callback_query_id: id, text, show_alert: showAlert },
      { timeoutMs: 4000 },
    );
  }
  setCommands() {
    return this.call("setMyCommands", {
      commands: [
        { command: "farosat", description: "Kunlik farosat olish" },
        { command: "men", description: "Farosat pasportim" },
        { command: "top", description: "Guruh reytingi" },
        { command: "bozor", description: "Stars evaziga farosat xarid qilish" },
        { command: "darajalar", description: "Darajalar va imkoniyatlar" },
        { command: "id", description: "Telegram ID" },
        { command: "admin", description: "Boshqaruv Web App" },
        { command: "paysupport", description: "Xarid bo‘yicha yordam" },
        { command: "terms", description: "Xarid shartlari" },
        { command: "help", description: "Yo‘riqnoma" },
      ],
    });
  }
}
