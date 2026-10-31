/** Mirrors `GeocodingPlanDtos` (miot-integrations). Prices are USD; BigDecimal arrives as a number. */
export interface GeocodingPlan {
  monthlyPriceUsd: number;
  resolutionsPerMonth: number;
  overagePriceUsd: number;
  alertPct: number;
  /** Applies the quotas; off, no provider call is refused. */
  enforced: boolean;
  whatsAppRecipients?: string[];
  updatedBy: string | null;
  updatedAt: string | null;
}

/** Mirrors `SetPlanRequest`. `enforced` null keeps the plan's. */
export interface SetGeocodingPlan {
  monthlyPriceUsd: number;
  resolutionsPerMonth: number;
  overagePriceUsd: number;
  alertPct: number;
  enforced: boolean;
  whatsAppRecipients: string[];
}

/** Mirrors `SetSubscriptionRequest`. `monthlyQuota` null uses the plan's. */
export interface SetGeocodingSubscription {
  monthlyQuota: number | null;
  onExhausted: OnExhausted;
  whatsAppRecipients: string[];
}

export type OnExhausted = "review" | "overage";

export interface GeocodingSubscription {
  monthlyQuota: number | null;
  onExhausted: OnExhausted;
  whatsAppRecipients?: string[];
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

/** One organization's month, for the platform owner. */
export interface OrgGeocodingUsage {
  organization: string;
  subscription: GeocodingSubscription | null;
  usage: GeocodingUsage & { providerCostUsd: number | null };
}
