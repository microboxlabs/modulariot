import type { GeocodingPlan, GeocodingUsage } from "./geocoding-plan.types";

/** `2026-10`, in UTC as the modulith counts months. */
export function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** The month `delta` months from `month` (`YYYY-MM`). */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map((part) => Number.parseInt(part, 10));
  return monthOf(new Date(Date.UTC(year!, m! - 1 + delta, 1)));
}

/** The subscription's quota, else the plan's. */
export function effectiveQuota(
  usage: GeocodingUsage,
  plan: GeocodingPlan
): number {
  return usage.quota ?? plan.resolutionsPerMonth;
}

/** 0–100, for the bar width. */
export function quotaPercent(used: number, quota: number): number {
  if (quota <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.round((used / quota) * 100));
}

export type QuotaLevel = "ok" | "alert" | "exhausted";

export function quotaLevel(
  used: number,
  quota: number,
  alertPct: number
): QuotaLevel {
  if (used >= quota) return "exhausted";
  if (used * 100 >= quota * alertPct) return "alert";
  return "ok";
}

/** Share of resolutions answered by the cache, 0–100, or null when there were none. */
export function cacheHitRate(usage: GeocodingUsage): number | null {
  if (usage.resolutions === 0) return null;
  return Math.round((usage.cacheHits / usage.resolutions) * 100);
}

/** `$0.0125`: up to four decimals, since one call costs a fraction of a cent. */
export function formatUsd(value: number | null, lang: string): string {
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value ?? 0);
}
