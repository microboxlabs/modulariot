import type { CaseTimelineEntry } from "@/features/symptoms/control-tower/control-tower-api";

/**
 * When the case reached its current level, as the server's SLA timer counts
 * it: its last OPENED or LEVEL_CHANGED entry, or the end of an "Ignorar
 * condición" hold when that is later. Null when the timeline has neither.
 */
export function levelSince(
  timeline: readonly CaseTimelineEntry[] | undefined,
  returnedAt?: string | null
): number | null {
  let at: number | null = null;
  for (const e of timeline ?? []) {
    if (e.kind !== "OPENED" && e.kind !== "LEVEL_CHANGED") continue;
    const t = Date.parse(e.at);
    if (!Number.isNaN(t) && (at === null || t > at)) at = t;
  }
  if (at === null) return null;
  const back = returnedAt ? Date.parse(returnedAt) : Number.NaN;
  return Number.isNaN(back) ? at : Math.max(at, back);
}
