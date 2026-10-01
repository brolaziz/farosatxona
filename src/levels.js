export const LEVELS = Object.freeze([
  {
    key: "bronza",
    name: "Bronza",
    emoji: "🥉",
    min: 0,
    positiveChance: 0.94,
    gain: [1, 10],
    loss: [1, 5],
  },
  {
    key: "kumush",
    name: "Kumush",
    emoji: "🥈",
    min: 200,
    positiveChance: 0.95,
    gain: [2, 13],
    loss: [1, 7],
  },
  {
    key: "oltin",
    name: "Oltin",
    emoji: "🥇",
    min: 400,
    positiveChance: 0.96,
    gain: [3, 16],
    loss: [2, 9],
  },
  {
    key: "platina",
    name: "Platina",
    emoji: "💠",
    min: 600,
    positiveChance: 0.97,
    gain: [4, 20],
    loss: [3, 11],
  },
  {
    key: "olmos",
    name: "Olmos",
    emoji: "💎",
    min: 800,
    positiveChance: 0.98,
    gain: [5, 25],
    loss: [4, 13],
  },
  {
    key: "afsonaviy",
    name: "Afsonaviy",
    emoji: "👑",
    min: 1000,
    positiveChance: 0.99,
    gain: [6, 30],
    loss: [5, 15],
  },
]);

export function getLevel(grams, levels = LEVELS) {
  const score = Math.max(0, Number(grams) || 0);
  return levels.findLast((level) => score >= level.min) ?? levels[0];
}

export function getNextLevel(grams) {
  const current = getLevel(grams);
  const index = LEVELS.findIndex((level) => level.key === current.key);
  return LEVELS[index + 1] ?? null;
}

export function randomInteger(min, max, random = Math.random) {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function rollFarosat(
  currentGrams,
  random = Math.random,
  levels = LEVELS,
) {
  const oldLevel = getLevel(currentGrams, levels);
  const positive = random() < oldLevel.positiveChance;
  const range = positive ? oldLevel.gain : oldLevel.loss;
  const amount = randomInteger(range[0], range[1], random);
  const requestedDelta = positive ? amount : -amount;
  const newGrams = Math.max(0, currentGrams + requestedDelta);
  const delta = newGrams - currentGrams;

  return {
    delta,
    oldGrams: currentGrams,
    newGrams,
    oldLevel,
    newLevel: getLevel(newGrams, levels),
  };
}
