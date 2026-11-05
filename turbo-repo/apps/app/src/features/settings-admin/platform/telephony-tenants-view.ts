import {
  TELEPHONY_ALERT_PCT,
  type OrgTelephonyUsage,
} from "@/features/telephony/telephony-plan";
import type { PlatformOrganizationListItem } from "./platform.types";
import {
  filterUsageRows,
  orgNamed,
  sortUsageRows,
  switcherOrgs,
  type UsageFilters,
  type UsageSort,
  type UsageTenantRow,
} from "./usage-tenants-view";

/** One organization's row in the platform's telephony table. Used and quota are minutes. */
export interface TelephonyTenantRow extends UsageTenantRow {
  /** Confirmed calls, on the line and by WhatsApp. */
  calls: number;
  /** Calls Telnyx has not confirmed yet. */
  pending: number;
}

/**
 * Rows for every organization with minutes of its own or usage. The modulith
 * keys them by tenant code; the name comes from the organization with that
 * slug, or that tenant client id.
 */
export function telephonyTenantRows(
  usage: readonly OrgTelephonyUsage[],
  orgs: readonly PlatformOrganizationListItem[]
): TelephonyTenantRow[] {
  const named = switcherOrgs(orgs);
  const bySlug = new Map(named.map((o) => [o.slug, o]));
  orgs.forEach((o, i) => {
    if (!bySlug.has(o.tenantClientId)) bySlug.set(o.tenantClientId, named[i]!);
  });
  return usage.map((u) => {
    const ownQuota = u.subscription?.monthlyMinutes ?? null;
    return {
      ...orgNamed(bySlug, u.tenantCode),
      slug: u.tenantCode,
      ownQuota,
      quota: u.usage.quotaMinutes,
      subscribed: ownQuota !== null,
      used: u.usage.usedMinutes,
      calls: u.usage.lines
        .filter((l) => l.channel !== "WHATSAPP_TEMPLATE")
        .reduce((s, l) => s + l.calls, 0),
      pending: u.usage.pending,
      providerCostUsd: u.usage.providerCost,
      chargeUsd: u.usage.chargeUsd,
    };
  });
}

export interface TelephonyTotals {
  ownMinutes: number;
  minutes: number;
  calls: number;
  pending: number;
  providerCostUsd: number;
  chargeUsd: number;
}

export function telephonyTotals(
  rows: readonly TelephonyTenantRow[]
): TelephonyTotals {
  const sum = (f: (r: TelephonyTenantRow) => number) =>
    rows.reduce((s, r) => s + f(r), 0);
  return {
    ownMinutes: rows.filter((r) => r.subscribed).length,
    minutes: sum((r) => r.used),
    calls: sum((r) => r.calls),
    pending: sum((r) => r.pending),
    providerCostUsd: sum((r) => r.providerCostUsd ?? 0),
    chargeUsd: sum((r) => r.chargeUsd ?? 0),
  };
}

export type TelephonyFilters = UsageFilters;

export const NO_TELEPHONY_FILTERS: TelephonyFilters = {
  query: "",
  subscription: [],
  levels: [],
};

/** Rows matching the filters, in `sort` order. */
export function visibleTelephonyRows(
  rows: readonly TelephonyTenantRow[],
  filters: TelephonyFilters,
  sort: UsageSort
): TelephonyTenantRow[] {
  return sortUsageRows(
    filterUsageRows(rows, filters, TELEPHONY_ALERT_PCT),
    sort
  );
}
