import { getLevel, getNextLevel, LEVELS } from "./levels.js";

const POSITIVE_LINES = [
  "Miya bugun signal tutdi. Bir chiziq, lekin halol.",
  "Buni birdan ishlatib yubormang — bosh aylanib qolishi mumkin.",
  "Bugun gapirsangiz, balki bittasi «to‘g‘ri» ham der.",
  "Mantiq sizni eslab, ozgina yordam tashlab ketdi.",
  "Kalladagi lampochka miltilladi. Tok bor ekan.",
  "Olimlar qayd etdi. Guruhdagilar hali ham ishonmayapti.",
  "Maslahat berishga yetadi. Mas’uliyatni Farosatxona olmaydi.",
  "Qabul qilib oling. Ortiqchasi omborda yo‘q."
];

const NEGATIVE_LINES = [
  "Farosatxona eski qarzingizni eslab qoldi.",
  "Bugun sukut saqlash — eng aqlli variantingiz.",
  "Miya ishladi. Afsuski, boshqa smenada.",
  "Mantiq keldi, manzilni ko‘rib ortiga qaytdi.",
  "Guruh nomidan hamdardmiz. Yo‘qotish kichik, sharmandalik katta.",
  "Kalladagi Wi-Fi yana parolsiz qolibdi.",
  "Bu jarima emas. Tabiiy tanlanish.",
  "Xafa bo‘lmang. Yo‘qotadigan narsangiz borligi ham yutuq."
];

const ZERO_LINES = [
  "Ayirmoqchi edik. Hisobda hech narsa topilmadi.",
  "Farosatxona ham noldan qarz undira olmadi.",
  "Pastga tushadigan joy qolmabdi. Bu ham bir rekord."
];

const ALREADY_PLAYED_LINES = [
  "Ko‘p bosishdan farosat ko‘paymaydi. Faqat shubhamiz.",
  "Ertagacha sabr. Ombor mudiri ham uyiga ketgan.",
  "Eshikni taqillatmang. Bugungi nasiba allaqachon tarqatilgan.",
  "Navbat ertaga ochiladi. Hozir miyani boriga ishlating.",
  "Ikkinchi luqma yo‘q. Farosatxona oshxona emas.",
  "Tugmani qiynamang. U sizdan ko‘ra farosatliroq chiqib qolmasin."
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

export function formatRoll({ userId, displayName, player, roll }, random = Math.random) {
  const who = mention(userId, displayName);
  const positive = roll.delta > 0;
  const hitZero = roll.delta === 0;
  const sign = positive ? "+" : "";
  const line = hitZero ? pick(ZERO_LINES, random) : pick(positive ? POSITIVE_LINES : NEGATIVE_LINES, random);
  const leveledUp = roll.newLevel.min > roll.oldLevel.min;
  const leveledDown = roll.newLevel.min < roll.oldLevel.min;

  const serving = hitZero
    ? "bugungi tarozi 0 grammda qotib qoldi"
    : positive
      ? `sizga ${sign}${roll.delta} gramm farosat berildi`
      : `sizdan ${Math.abs(roll.delta)} gramm farosat qaytarib olindi`;
  const parts = [
    `${positive ? "🧠✨" : "📉🤡"} Farosatxonadan sizga bugungi luqma, ${who}:`,
    `<b>${serving}</b>.`,
    "",
    `Hisob: <b>${roll.newGrams} g</b> · ${roll.newLevel.emoji} ${roll.newLevel.name}`,
    `🔥 Ketma-ket tashrif: <b>${player.streak} kun</b>`,
    `<i>${escapeHtml(line)}</i>`,
    "",
    "Keyingi o‘sish — ertaga. Nasib qilsa, albatta."
  ];

  if (leveledUp) parts.push("", `🎉 YANGI DARAJA! ${roll.newLevel.emoji} <b>${roll.newLevel.name}</b>. Endi sal jiddiyroq ko‘rinishingiz mumkin.`);
  if (leveledDown) parts.push("", `🪦 Daraja ketdi: ${roll.oldLevel.name} → <b>${roll.newLevel.name}</b>. Kibrning umri qisqa ekan.`);
  return parts.join("\n");
}

export function formatAlreadyPlayed({ userId, displayName, player }, random = Math.random) {
  const level = getLevel(player.grams);
  return [
    `🍽 ${mention(userId, displayName)}, Farosatxonadan sizga bugungi luqmangiz berilgan, qadrli mijoz.`,
    "",
    `Hozir: <b>${player.grams} g</b> · ${level.emoji} ${level.name}`,
    `<i>${escapeHtml(pick(ALREADY_PLAYED_LINES, random))}</i>`
  ].join("\n");
}

export function formatProfile({ userId, displayName, player }) {
  if (!player) {
    return `${mention(userId, displayName)}, siz hali hisobda yo‘qsiz. /farosat yozing — diagnozni boshlaymiz.`;
  }

  const level = getLevel(player.grams);
  const next = getNextLevel(player.grams);
  const progress = next ? `Keyingi darajagacha: <b>${next.min - player.grams} g</b>` : "Siz cho‘qqidasiz. Pastdagilarga qo‘l silkiting.";
  return [
    `🪪 ${mention(userId, displayName)}ning farosat pasporti`,
    "",
    `⚖️ <b>${player.grams} gramm</b>`,
    `${level.emoji} Daraja: <b>${level.name}</b>`,
    `🔥 Hozirgi seriya: <b>${player.streak} kun</b>`,
    `🏆 Eng yaxshi seriya: <b>${player.best_streak} kun</b>`,
    `🎲 Jami urinish: <b>${player.plays}</b>`,
    progress
  ].join("\n");
}

export function formatLeaderboard(players, chatTitle = "bu guruh") {
  if (players.length === 0) return "🏜 Reyting huvillab yotibdi. Birinchi bo‘lib /farosat yozing.";
  const medals = ["🥇", "🥈", "🥉"];
  const rows = players.map((player, index) => {
    const level = getLevel(player.grams);
    const prefix = medals[index] ?? `${index + 1}.`;
    return `${prefix} ${escapeHtml(player.display_name)} — <b>${player.grams} g</b> ${level.emoji}`;
  });
  return [`🏆 <b>${escapeHtml(chatTitle)} Farosatxonasi</b>`, "", ...rows, "", "Oxirgi o‘rin ham kerak — tepada turganlar kimning ustidan kuladi aks holda?"].join("\n");
}

export function formatLevels() {
  const rows = LEVELS.map((level, index) => {
    const next = LEVELS[index + 1];
    const range = next ? `${level.min}–${next.min - 1} g` : `${level.min}+ g`;
    return `${level.emoji} <b>${level.name}</b>: ${range} · omad ${Math.round(level.positiveChance * 100)}%`;
  });
  return ["📊 <b>Darajalar</b>", "", ...rows, "", "Daraja oshsa omad ham oshadi. Lekin taqdir baribir troll."] .join("\n");
}

export const HELP_TEXT = [
  "🏠🧠 <b>Farosatxona — guruhning aql oshxonasi</b>",
  "",
  "/farosat — kunlik grammlarni tortish",
  "/men — o‘z holatingizni ko‘rish",
  "/top — guruh reytingi",
  "/darajalar — daraja va imkoniyatlar",
  "/help — shu yo‘riqnoma",
  "",
  "Har kuni bir luqma. Farosat qo‘shilishi ham, qaytarib olinishi ham mumkin. Farosatxona ma’muriyati oqibatlarga javob bermaydi."
].join("\n");
