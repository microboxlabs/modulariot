"use client";

import type { OnExhausted } from "@/features/geocoding/geocoding-plan.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { TenantFilters, TenantSort } from "./geocoding-tenants-view";
import UsageTenantsToolbar, { selectFilter } from "./usage-tenants-toolbar";

/**
 * Search, month, subscription, quota-level and mode filters and the sort of
 * the platform's geocoding table.
 */
export default function GeocodingTenantsToolbar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  month,
  onMonthChange,
  dict,
  rootDict,
  lang,
}: Readonly<{
  filters: TenantFilters;
  onFiltersChange: (filters: TenantFilters) => void;
  sort: TenantSort;
  onSortChange: (sort: TenantSort) => void;
  month: string;
  onMonthChange: (month: string) => void;
  dict: I18nRecord;
  rootDict: I18nRecord;
  lang: string;
}>) {
  const mode = selectFilter("mode", tr("filters.mode", dict), [
    { value: "review", label: tr("modes.review.label", dict) },
    { value: "overage", label: tr("modes.overage.label", dict) },
  ]);
  return (
    <UsageTenantsToolbar
      id="geocoding-tenant-search"
      filters={filters}
      onFiltersChange={onFiltersChange}
      sort={sort}
      onSortChange={onSortChange}
      month={month}
      onMonthChange={onMonthChange}
      extra={[
        {
          filter: mode,
          values: filters.modes,
          onChange: (values) =>
            onFiltersChange({ ...filters, modes: values as OnExhausted[] }),
        },
      ]}
      dict={dict}
      rootDict={rootDict}
      lang={lang}
    />
  );
}
