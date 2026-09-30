import type { HarnessPlan } from "../platform/platform.types";
import type { AccessMode, BillingCycle } from "./harness-plan.types";

/** The per-seat monthly price for a billing cycle, rounded to cents. */
export function seatPriceFor(plan: HarnessPlan, cycle: BillingCycle): number {
  const pct = cycle === "yearly" ? plan.yearlyDiscountPct : 0;
  return Math.round(plan.seatPriceUsd * (100 - pct)) / 100;
}

/** What one billing cycle charges: a month, or twelve months when yearly. */
export function billingTotal(
  seats: number,
  plan: HarnessPlan,
  cycle: BillingCycle
): number {
  const months = cycle === "yearly" ? 12 : 1;
  return Math.round(seats * seatPriceFor(plan, cycle) * months * 100) / 100;
}

/** How many members can use the harness under an access mode. */
export function activeCount(
  mode: AccessMode,
  memberCount: number,
  selectedCount: number
): number {
  if (mode === "all") return memberCount;
  if (mode === "none") return 0;
  return selectedCount;
}

/** `12.5M`, `800K`, `950`. */
export function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    const m = Math.round(value / 100_000) / 10;
    return `${m}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(value);
}

/** Share of the pool used, 0–100, for a progress bar. */
export function poolPercent(used: number, included: number): number {
  if (included <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, (used / included) * 100);
}

/** Lowercased, so they compare with the emails the modulith stores. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
