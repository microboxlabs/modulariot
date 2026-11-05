import { quotaLevel } from "@/features/metered-usage/usage-view";
import {
  filterOrgs,
  type SwitcherOrg,
} from "@/features/layout/components/secured-navbar/org-switcher/org-switcher-list";
import type { PlatformOrganizationListItem } from "./platform.types";

/**
 * One organization's row in a platform usage table (geocoding, telephony):
 * what it used against its quota and what that cost and is charged.
 */
export interface UsageTenantRow extends SwitcherOrg {
  /** The organization's own quota; null uses the plan's. */
  ownQuota: number | null;
  /** What applies: the organization's own quota, else the plan's. */
  quota: number;
  /** Has its own subscription (geocoding) or its own quota (telephony). */
  subscribed: boolean;
  used: number;
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

/** The organization of `slug` from the list, or one named by its slug. */
export function orgNamed(
  bySlug: ReadonlyMap<string, SwitcherOrg>,
  slug: string
): SwitcherOrg {
  return (
    bySlug.get(slug) ?? {
      slug,
      displayName: slug,
      taxId: null,
      isParent: true,
    }
  );
}

export type UsageSort = "USAGE_DESC" | "NAME_ASC" | "COST_DESC" | "CHARGE_DESC";
export const USAGE_SORTS: readonly UsageSort[] = [
  "USAGE_DESC",
  "NAME_ASC",
  "COST_DESC",
  "CHARGE_DESC",
];
export const DEFAULT_USAGE_SORT: UsageSort = "USAGE_DESC";

/** The toolbar's filters; an empty list does not filter. */
export interface UsageFilters {
  query: string;
  /** `subscribed`, `unsubscribed`. */
  subscription: readonly string[];
  /** Quota levels: `ok`, `alert`, `exhausted`. */
  levels: readonly string[];
}

export function passes(values: readonly string[], value: string): boolean {
  return values.length === 0 || values.includes(value);
}

/** True when any filter is set, so the empty table says "no matches". */
export function isFiltering(
  filters: UsageFilters & { modes?: readonly string[] }
): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.subscription.length +
      filters.levels.length +
      (filters.modes?.length ?? 0) >
      0
  );
}

/** Rows matching the query (as the header's switcher matches), subscription and quota level. */
export function filterUsageRows<R extends UsageTenantRow>(
  rows: readonly R[],
  filters: UsageFilters,
  alertPct: number
): R[] {
  return filterOrgs(rows, filters.query).filter(
    (r) =>
      passes(
        filters.subscription,
        r.subscribed ? "subscribed" : "unsubscribed"
      ) && passes(filters.levels, quotaLevel(r.used, r.quota, alertPct))
  );
}

const byName = (a: UsageTenantRow, b: UsageTenantRow) =>
  a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" });

const COMPARE: Record<
  UsageSort,
  (a: UsageTenantRow, b: UsageTenantRow) => number
> = {
  USAGE_DESC: (a, b) => b.used - a.used || byName(a, b),
  NAME_ASC: byName,
  COST_DESC: (a, b) =>
    (b.providerCostUsd ?? 0) - (a.providerCostUsd ?? 0) || byName(a, b),
  CHARGE_DESC: (a, b) =>
    (b.chargeUsd ?? 0) - (a.chargeUsd ?? 0) || byName(a, b),
};

/** `rows` in `sort` order; sorts in place and returns them. */
export function sortUsageRows<R extends UsageTenantRow>(
  rows: R[],
  sort: UsageSort
): R[] {
  return rows.sort(COMPARE[sort]);
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
