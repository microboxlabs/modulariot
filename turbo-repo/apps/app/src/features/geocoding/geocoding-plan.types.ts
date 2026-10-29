/** Mirrors `GeocodingPlanDtos` (miot-integrations). Prices are USD; BigDecimal arrives as a number. */
export interface GeocodingPlan {
  monthlyPriceUsd: number;
  resolutionsPerMonth: number;
  overagePriceUsd: number;
  alertPct: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export type OnExhausted = "review" | "overage";

export interface GeocodingSubscription {
  monthlyQuota: number | null;
  onExhausted: OnExhausted;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** `source` is `none` when nothing placed the site. */
export interface GeocodingSourceUse {
  source: string;
  result: string;
  resolutions: number;
  cacheHits: number;
  providerCalls: number;
}

/**
 * One calendar month (UTC). `used` is provider calls; `quota` is null without a
 * subscription. `chargeUsd` is what the plan charges the organization: the
 * monthly price plus `overageUsd`. The platform's provider cost is not sent.
 */
export interface GeocodingUsage {
  periodStart: string;
  periodEnd: string;
  quota: number | null;
  used: number;
  resolutions: number;
  cacheHits: number;
  overageCalls: number;
  overageUsd: number | null;
  chargeUsd: number | null;
  bySource: GeocodingSourceUse[];
}

export interface OrgGeocodingPlan {
  plan: GeocodingPlan;
  subscription: GeocodingSubscription | null;
  usage: GeocodingUsage;
  enforced: boolean;
}
