import { getLevel, LEVELS } from "./levels.js";

const ALREADY_PLAYED_LINES = [
  "Ko‘p bosishdan farosat ko‘paymaydi. Faqat shubhamiz.",
  "Ertagacha sabr. Ombor mudiri ham uyiga ketgan.",
  "Eshikni taqillatmang. Bugungi nasiba allaqachon tarqatilgan.",
  "Navbat ertaga ochiladi. Hozir miyani boriga ishlating.",
  "Ikkinchi luqma yo‘q. Farosatxona oshxona emas.",
  "Tugmani qiynamang. U sizdan ko‘ra farosatliroq chiqib qolmasin.",
];

function pick(items, random = Math.random) {
  return items[Math.floor(random() * items.length)];
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function mention(userId, displayName) {
  return `<a href="tg://user?id=${userId}">${escapeHtml(displayName)}</a>`;
}

export function formatRoll({ userId, displayName, roll }) {
  const who = mention(userId, displayName);
  const positive = roll.delta > 0;
  const hitZero = roll.delta === 0;
  const sign = positive ? "+" : "";
  if (hitZero) {
    return `🤡 ${who}, Farosatxona ayirishga ham farosat topolmadi.\nJami: <b>${roll.newGrams} g</b>. Keyingi luqma ertaga.`;
  }

  const result = positive
    ? `sizga <b>${sign}${roll.delta} g</b> farosat berdi`
    : `sizdan <b>${Math.abs(roll.delta)} g</b> farosat qaytarib oldi`;
  return `${positive ? "🧠" : "📉"} ${who}, Farosatxona ${result}.\nJami: <b>${roll.newGrams} g</b>. Keyingi luqma ertaga.`;
}

export function formatAlreadyPlayed(
  { userId, displayName, player },
  random = Math.random,
) {
  return [
    `🍽 ${mention(userId, displayName)}, bugungi luqmangiz berilgan.`,
    `<i>${escapeHtml(pick(ALREADY_PLAYED_LINES, random))}</i>`,
  ].join("\n");
}

export function formatProfile({
  userId,
  displayName,
  player,
  levels = LEVELS,
}) {
  if (!player) {
    return `${mention(userId, displayName)}, siz hali hisobda yo‘qsiz. /farosat yozing — diagnozni boshlaymiz.`;
  }

  const level = getLevel(player.grams, levels);
  const next = levels.find((item) => item.min > player.grams);
  const progress = next
    ? `Keyingi darajagacha: <b>${next.min - player.grams} g</b>`
    : "Siz cho‘qqidasiz. Pastdagilarga qo‘l silkiting.";
  return [
    `🪪 ${mention(userId, displayName)}ning farosat pasporti`,
    "",
    `⚖️ <b>${player.grams} gramm</b>`,
    `Yig‘ilgan: <b>${player.earned_grams ?? player.grams} g</b> · Xarid: <b>${player.paid_grams ?? 0} g</b>`,
    `${level.emoji} Daraja: <b>${level.name}</b>`,
    `🔥 Hozirgi seriya: <b>${player.streak} kun</b>`,
    `🏆 Eng yaxshi seriya: <b>${player.best_streak} kun</b>`,
    `🎲 Jami urinish: <b>${player.plays}</b>`,
    progress,
  ].join("\n");
}

export function formatLeaderboard(
  players,
  chatTitle = "bu guruh",
  levels = LEVELS,
) {
  if (players.length === 0)
    return "🏜 Reyting huvillab yotibdi. Birinchi bo‘lib /farosat yozing.";
  const medals = ["🥇", "🥈", "🥉"];
  const rows = players.map((player, index) => {
    const level = getLevel(player.grams, levels);
    const prefix = medals[index] ?? `${index + 1}.`;
    return `${prefix} ${escapeHtml(player.display_name)} — <b>${player.grams} g</b> ${level.emoji}`;
  });
  return [
    `🏆 <b>${escapeHtml(chatTitle)} Farosatxonasi</b>`,
    "",
    ...rows,
    "",
    "Oxirgi o‘rin ham kerak — tepada turganlar kimning ustidan kuladi aks holda?",
  ].join("\n");
}

export function formatLevels(levels = LEVELS) {
  const rows = levels.map((level, index) => {
    const next = levels[index + 1];
    const range = next ? `${level.min}–${next.min - 1} g` : `${level.min}+ g`;
    return `${level.emoji} <b>${level.name}</b>: ${range} · omad ${Math.round(level.positiveChance * 100)}%`;
  });
  return [
    "📊 <b>Darajalar</b>",
    "",
    ...rows,
    "",
    "Daraja oshsa omad ham oshadi. Lekin taqdir baribir troll.",
  ].join("\n");
}

export const HELP_TEXT = [
  "🏠🧠 <b>Farosatxona — guruhning aql oshxonasi</b>",
  "",
  "/farosat — kunlik grammlarni tortish",
  "/men — o‘z holatingizni ko‘rish",
  "/top — guruh reytingi",
  "/darajalar — daraja va imkoniyatlar",
  "/id — Telegram ID raqamingiz",
  "/bozor — Stars evaziga farosat xarid qilish",
  "/terms — xarid shartlari",
  "/paysupport — xarid bo‘yicha yordam",
  "/help — shu yo‘riqnoma",
  "",
  "Har kuni bir luqma. Farosat qo‘shilishi ham, qaytarib olinishi ham mumkin. Farosatxona ma’muriyati oqibatlarga javob bermaydi.",
].join("\n");
