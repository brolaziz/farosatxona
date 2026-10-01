export function localDate(timeZone = "Asia/Tashkent", date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function previousDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function nextDayAt(timeZone = "Asia/Tashkent", now = new Date()) {
  const today = localDate(timeZone, now);
  // Find the exact next local-date boundary, including zones with DST.
  let low = now.getTime(),
    high = low + 30 * 3600000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localDate(timeZone, new Date(middle)) === today) low = middle;
    else high = middle;
  }
  return new Date(high).toISOString();
}
