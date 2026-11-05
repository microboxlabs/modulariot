"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { TelephonyFilters } from "./telephony-tenants-view";
import UsageTenantsToolbar from "./usage-tenants-toolbar";
import type { UsageSort } from "./usage-tenants-view";

/** Search, month, own-minutes and quota-level filters and the sort of the platform's telephony table. */
export default function TelephonyTenantsToolbar(
  props: Readonly<{
    filters: TelephonyFilters;
    onFiltersChange: (filters: TelephonyFilters) => void;
    sort: UsageSort;
    onSortChange: (sort: UsageSort) => void;
    month: string;
    onMonthChange: (month: string) => void;
    dict: I18nRecord;
    rootDict: I18nRecord;
    lang: string;
  }>
) {
  return <UsageTenantsToolbar id="telephony-tenant-search" {...props} />;
}
