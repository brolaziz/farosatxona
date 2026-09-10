const API_ROOT = "https://api.telegram.org";

export class TelegramClient {
  constructor(token) {
    this.baseUrl = `${API_ROOT}/bot${token}`;
  }

  async call(method, body = {}, signal) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(`Telegram ${method}: ${payload.description ?? response.statusText}`);
    }
    return payload.result;
  }

  getUpdates(offset, signal) {
    return this.call("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message", "callback_query"]
    }, signal);
  }

  sendMessage(message, text, replyMarkup) {
    const body = {
      chat_id: message.chat.id,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_parameters: { message_id: message.message_id, allow_sending_without_reply: true }
    };
    if (message.message_thread_id) body.message_thread_id = message.message_thread_id;
    if (replyMarkup) body.reply_markup = replyMarkup;
    return this.call("sendMessage", body);
  }

  editMessage(message, text, replyMarkup) {
    const body = {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true }
    };
    if (replyMarkup) body.reply_markup = replyMarkup;
    return this.call("editMessageText", body);
  }

  answerCallbackQuery(callbackQueryId, text, showAlert = false) {
    return this.call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert
    });
  }

  setCommands() {
    return this.call("setMyCommands", {
      commands: [
        { command: "farosat", description: "Farosatxonadan kunlik luqma" },
        { command: "men", description: "Farosat pasportim" },
        { command: "top", description: "Guruhning eng farosatlilari" },
        { command: "darajalar", description: "Darajalar va imkoniyatlar" },
        { command: "id", description: "Telegram ID raqamingiz" },
        { command: "admin", description: "Farosatxona boshqaruvi" },
        { command: "help", description: "Botdan foydalanish" }
      ]
    });
  }
}
