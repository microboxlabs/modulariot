"use client";

import { FilterSearchField } from "@/features/credentials/components/filter-search-field";
import { SortBadge } from "@/features/credentials/components/sort-badge";
import { SelectFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/select-filter-badge";
import type { DashboardFilterParam } from "@/features/dashboard/types/dashboard.types";
import type { OnExhausted } from "@/features/geocoding/geocoding-plan.types";
import { monthOf, shiftMonth } from "@/features/geocoding/geocoding-plan-view";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  DEFAULT_TENANT_SORT,
  type TenantFilters,
  type TenantSort,
} from "./geocoding-tenants-view";

const SORTS: readonly TenantSort[] = [
  "USAGE_DESC",
  "NAME_ASC",
  "COST_DESC",
  "CHARGE_DESC",
];
const MONTHS_BACK = 12;

function monthLabel(month: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function selectFilter(
  key: string,
  label: string,
  options: readonly { value: string; label: string }[]
): DashboardFilterParam {
  return { key, label, type: "select", options: [...options] };
}

/**
 * Search, month, subscription, quota-level and mode filters and the sort of
 * the platform's geocoding table, like the connections toolbar.
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
  const current = monthOf(new Date());
  const months = Array.from({ length: MONTHS_BACK }, (_, i) =>
    shiftMonth(current, -i)
  );
  const subscription = selectFilter(
    "subscription",
    tr("filters.subscription", dict),
    [
      { value: "subscribed", label: tr("filters.subscribed", dict) },
      { value: "unsubscribed", label: tr("filters.unsubscribed", dict) },
    ]
  );
  const level = selectFilter("level", tr("filters.level", dict), [
    { value: "ok", label: tr("filters.levelOk", dict) },
    { value: "alert", label: tr("filters.levelAlert", dict) },
    { value: "exhausted", label: tr("filters.levelExhausted", dict) },
  ]);
  const mode = selectFilter("mode", tr("filters.mode", dict), [
    { value: "review", label: tr("modes.review.label", dict) },
    { value: "overage", label: tr("modes.overage.label", dict) },
  ]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSearchField
        id="geocoding-tenant-search"
        value={filters.query}
        placeholder={tr("search", dict)}
        onChange={(query) => onFiltersChange({ ...filters, query })}
      />
      <SortBadge
        label={tr("filters.month", dict)}
        value={month}
        defaultValue={current}
        options={months.map((m) => ({ value: m, label: monthLabel(m, lang) }))}
        onChange={onMonthChange}
      />
      <SelectFilterBadge
        filter={subscription}
        values={[...filters.subscription]}
        onApply={(values) =>
          onFiltersChange({ ...filters, subscription: values })
        }
        onClear={() => onFiltersChange({ ...filters, subscription: [] })}
        dictionary={rootDict}
      />
      <SelectFilterBadge
        filter={level}
        values={[...filters.levels]}
        onApply={(values) => onFiltersChange({ ...filters, levels: values })}
        onClear={() => onFiltersChange({ ...filters, levels: [] })}
        dictionary={rootDict}
      />
      <SelectFilterBadge
        filter={mode}
        values={[...filters.modes]}
        onApply={(values) =>
          onFiltersChange({ ...filters, modes: values as OnExhausted[] })
        }
        onClear={() => onFiltersChange({ ...filters, modes: [] })}
        dictionary={rootDict}
      />
      <SortBadge
        label={tr("filters.sortLabel", dict)}
        value={sort}
        defaultValue={DEFAULT_TENANT_SORT}
        options={SORTS.map((s) => ({
          value: s,
          label: trDynamic(`filters.sort.${s}`, dict),
        }))}
        onChange={(value) => onSortChange(value as TenantSort)}
      />
    </div>
  );
}
