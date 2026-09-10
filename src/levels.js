export const LEVELS = Object.freeze([
  { key: "bronza", name: "Bronza", emoji: "🥉", min: 0, positiveChance: 0.68, gain: [5, 28], loss: [3, 18] },
  { key: "kumush", name: "Kumush", emoji: "🥈", min: 100, positiveChance: 0.72, gain: [10, 34], loss: [4, 20] },
  { key: "oltin", name: "Oltin", emoji: "🥇", min: 250, positiveChance: 0.76, gain: [13, 42], loss: [5, 23] },
  { key: "platina", name: "Platina", emoji: "💠", min: 500, positiveChance: 0.80, gain: [16, 52], loss: [6, 26] },
  { key: "olmos", name: "Olmos", emoji: "💎", min: 900, positiveChance: 0.84, gain: [20, 65], loss: [7, 30] },
  { key: "afsonaviy", name: "Afsonaviy", emoji: "👑", min: 1500, positiveChance: 0.88, gain: [25, 80], loss: [8, 35] }
]);

export function getLevel(grams) {
  const score = Math.max(0, Number(grams) || 0);
  return LEVELS.findLast((level) => score >= level.min) ?? LEVELS[0];
}

export function getNextLevel(grams) {
  const current = getLevel(grams);
  const index = LEVELS.findIndex((level) => level.key === current.key);
  return LEVELS[index + 1] ?? null;
}

export function randomInteger(min, max, random = Math.random) {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function rollFarosat(currentGrams, random = Math.random) {
  const oldLevel = getLevel(currentGrams);
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
    newLevel: getLevel(newGrams)
  };
}
