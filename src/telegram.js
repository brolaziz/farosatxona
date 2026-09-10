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
      allowed_updates: ["message"]
    }, signal);
  }

  sendMessage(message, text) {
    const body = {
      chat_id: message.chat.id,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_parameters: { message_id: message.message_id, allow_sending_without_reply: true }
    };
    if (message.message_thread_id) body.message_thread_id = message.message_thread_id;
    return this.call("sendMessage", body);
  }

  setCommands() {
    return this.call("setMyCommands", {
      commands: [
        { command: "farosat", description: "Farosatxonadan kunlik luqma" },
        { command: "men", description: "Farosat pasportim" },
        { command: "top", description: "Guruhning eng farosatlilari" },
        { command: "darajalar", description: "Darajalar va imkoniyatlar" },
        { command: "help", description: "Botdan foydalanish" }
      ]
    });
  }
}
