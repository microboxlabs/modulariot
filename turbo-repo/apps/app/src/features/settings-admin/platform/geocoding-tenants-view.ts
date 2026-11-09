import type {
  GeocodingPlan,
  OnExhausted,
  OrgGeocodingUsage,
} from "@/features/geocoding/geocoding-plan.types";
import type { PlatformOrganizationListItem } from "./platform.types";
import {
  DEFAULT_USAGE_SORT,
  filterUsageRows,
  orgNamed,
  passes,
  sortUsageRows,
  switcherOrgs,
  type UsageFilters,
  type UsageSort,
  type UsageTenantRow,
} from "./usage-tenants-view";

/** One organization's row in the platform's geocoding table. */
export interface TenantRow extends UsageTenantRow {
  onExhausted: OnExhausted;
  resolutions: number;
  cacheHits: number;
}

/** Rows for every organization with a subscription or usage, named from the organization list. */
export function tenantRows(
  usage: readonly OrgGeocodingUsage[],
  orgs: readonly PlatformOrganizationListItem[],
  plan: GeocodingPlan
): TenantRow[] {
  const bySlug = new Map(switcherOrgs(orgs).map((o) => [o.slug, o]));
  return usage.map((u) => ({
    ...orgNamed(bySlug, u.organization),
    ownQuota: u.subscription?.monthlyQuota ?? null,
    quota: u.usage.quota ?? plan.resolutionsPerMonth,
    subscribed: u.subscription !== null,
    onExhausted: u.subscription?.onExhausted ?? "review",
    used: u.usage.used,
    resolutions: u.usage.resolutions,
    cacheHits: u.usage.cacheHits,
    providerCostUsd: u.usage.providerCostUsd,
    chargeUsd: u.usage.chargeUsd,
  }));
}

export interface TenantTotals {
  subscribed: number;
  providerCalls: number;
  resolutions: number;
  cacheHitPct: number | null;
  providerCostUsd: number;
  chargeUsd: number;
}

export function tenantTotals(rows: readonly TenantRow[]): TenantTotals {
  const resolutions = rows.reduce((s, r) => s + r.resolutions, 0);
  const cacheHits = rows.reduce((s, r) => s + r.cacheHits, 0);
  return {
    subscribed: rows.filter((r) => r.subscribed).length,
    providerCalls: rows.reduce((s, r) => s + r.used, 0),
    resolutions,
    cacheHitPct:
      resolutions === 0 ? null : Math.round((cacheHits / resolutions) * 100),
    providerCostUsd: rows.reduce((s, r) => s + (r.providerCostUsd ?? 0), 0),
    chargeUsd: rows.reduce((s, r) => s + (r.chargeUsd ?? 0), 0),
  };
}

export type TenantSort = UsageSort;
export const DEFAULT_TENANT_SORT: TenantSort = DEFAULT_USAGE_SORT;

/** The usage filters plus what happens when the quota is used up. */
export interface TenantFilters extends UsageFilters {
  modes: readonly OnExhausted[];
}

export const NO_TENANT_FILTERS: TenantFilters = {
  query: "",
  subscription: [],
  levels: [],
  modes: [],
};

/** Rows matching the filters (the query as the header's switcher matches), in `sort` order. */
export function visibleRows(
  rows: readonly TenantRow[],
  filters: TenantFilters,
  sort: TenantSort,
  alertPct: number
): TenantRow[] {
  const kept = filterUsageRows(rows, filters, alertPct).filter((r) =>
    passes(filters.modes, r.onExhausted)
  );
  return sortUsageRows(kept, sort);
}
