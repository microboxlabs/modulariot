import type {
  GeocodingPlan,
  OnExhausted,
  OrgGeocodingUsage,
} from "@/features/geocoding/geocoding-plan.types";
import {
  filterOrgs,
  type SwitcherOrg,
} from "@/features/layout/components/secured-navbar/org-switcher/org-switcher-list";
import type { PlatformOrganizationListItem } from "./platform.types";

/** One organization's row in the platform's geocoding table. */
export interface TenantRow extends SwitcherOrg {
  /** The subscription's own quota; null uses the plan's. */
  ownQuota: number | null;
  /** What applies: the subscription's quota, else the plan's. */
  quota: number;
  subscribed: boolean;
  onExhausted: OnExhausted;
  used: number;
  resolutions: number;
  cacheHits: number;
  providerCostUsd: number | null;
  chargeUsd: number | null;
}

/** The organizations as the header's switcher shows them. */
export function switcherOrgs(
  orgs: readonly PlatformOrganizationListItem[]
): SwitcherOrg[] {
  return orgs.map((o) => ({
    slug: o.slug,
    displayName: o.displayName || o.name,
    taxId: o.taxId,
    isParent: o.parentSlug === null,
  }));
}

/** Rows for every organization with a subscription or usage, named from the organization list. */
export function tenantRows(
  usage: readonly OrgGeocodingUsage[],
  orgs: readonly PlatformOrganizationListItem[],
  plan: GeocodingPlan
): TenantRow[] {
  const bySlug = new Map(switcherOrgs(orgs).map((o) => [o.slug, o]));
  return usage.map((u) => {
    const org = bySlug.get(u.organization) ?? {
      slug: u.organization,
      displayName: u.organization,
      taxId: null,
      isParent: true,
    };
    return {
      ...org,
      ownQuota: u.subscription?.monthlyQuota ?? null,
      quota: u.usage.quota ?? plan.resolutionsPerMonth,
      subscribed: u.subscription !== null,
      onExhausted: u.subscription?.onExhausted ?? "review",
      used: u.usage.used,
      resolutions: u.usage.resolutions,
      cacheHits: u.usage.cacheHits,
      providerCostUsd: u.usage.providerCostUsd,
      chargeUsd: u.usage.chargeUsd,
    };
  });
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

/** Rows matching the query as the header's switcher matches, most used first. */
export function visibleRows(
  rows: readonly TenantRow[],
  query: string
): TenantRow[] {
  return filterOrgs(rows, query).sort(
    (a, b) => b.used - a.used || a.displayName.localeCompare(b.displayName)
  );
}

export const PAGE_SIZE = 20;

/** The rows of `page` (1-based) and how many pages there are. */
export function pageOf<T>(
  rows: readonly T[],
  page: number
): { rows: T[]; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  return {
    rows: rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    pages,
  };
}
