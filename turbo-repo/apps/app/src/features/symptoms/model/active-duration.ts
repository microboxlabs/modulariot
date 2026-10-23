const UNIT_SECONDS: Record<string, number> = {
  year: 365 * 86400,
  mon: 30 * 86400,
  day: 86400,
};
const UNITS = /(-?\d+)\s+(year|mon|day)s?/g;
const CLOCK = /(-?)(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/;

/**
 * Seconds in a symptom's active time: a number of seconds (the evaluator's
 * cases) or a Postgres interval such as "1 day 02:03:04.5" (the GPS
 * database's symptoms). Undefined when it is neither.
 */
export function activeSeconds(
  value: number | string | null | undefined
): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const text = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (!text || text.replace(UNITS, "").replace(CLOCK, "").trim()) {
    return undefined;
  }
  let seconds = 0;
  for (const [, amount, unit] of text.matchAll(UNITS)) {
    seconds += Number(amount) * UNIT_SECONDS[unit];
  }
  const clock = CLOCK.exec(text);
  if (clock) {
    const s =
      Number(clock[2]) * 3600 + Number(clock[3]) * 60 + Number(clock[4]);
    seconds += clock[1] === "-" ? -s : s;
  }
  return seconds;
}

/** A symptom's active time as "45 s", "12 min", "8 h 33 min" or "2 d 4 h". */
export function formatActiveDuration(
  value: number | string | null | undefined
): string | undefined {
  const seconds = activeSeconds(value);
  if (seconds === undefined) return value == null ? undefined : String(value);
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0)
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  if (minutes > 0) return `${minutes} min`;
  return `${total} s`;
}
