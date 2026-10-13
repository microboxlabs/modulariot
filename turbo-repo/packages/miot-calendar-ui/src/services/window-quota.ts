import type { TimeWindowUsageResponse } from "@microboxlabs/miot-calendar-client";

export type WindowUsageIndex = ReadonlyMap<string, TimeWindowUsageResponse>;

const usageKey = (timeWindowId: string, date: string) =>
  `${timeWindowId}|${date}`;

/** Index the calendar's window usage by window and date (YYYY-MM-DD). */
export function indexWindowUsage(
  usage: readonly TimeWindowUsageResponse[]
): WindowUsageIndex {
  const map = new Map<string, TimeWindowUsageResponse>();
  for (const u of usage) map.set(usageKey(u.timeWindowId, u.date), u);
  return map;
}

/**
 * Remaining booking capacity of a window on a date, as the calendar reports it.
 * A window-date with no usage row has nothing booked. `freesOwnPlace` is true
 * while a counted booking is being moved inside this window and date: the
 * calendar does not check the window cap for that move, so its place is free.
 */
export function remainingWindowQuota(
  index: WindowUsageIndex,
  window: { id: string; quota: number },
  date: string,
  freesOwnPlace: boolean
): number {
  const usage = index.get(usageKey(window.id, date));
  const available = usage ? usage.available : window.quota;
  return freesOwnPlace ? available + 1 : available;
}
