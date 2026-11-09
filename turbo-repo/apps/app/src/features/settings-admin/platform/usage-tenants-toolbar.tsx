"use client";

import { FilterSearchField } from "@/features/credentials/components/filter-search-field";
import { SortBadge } from "@/features/credentials/components/sort-badge";
import { SelectFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/select-filter-badge";
import type { DashboardFilterParam } from "@/features/dashboard/types/dashboard.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  monthLabel,
  monthOf,
  shiftMonth,
} from "@/features/metered-usage/usage-view";
import {
  DEFAULT_USAGE_SORT,
  USAGE_SORTS,
  type UsageFilters,
  type UsageSort,
} from "./usage-tenants-view";

const MONTHS_BACK = 12;

export function selectFilter(
  key: string,
  label: string,
  options: readonly { value: string; label: string }[]
): DashboardFilterParam {
  return { key, label, type: "select", options: [...options] };
}

/** A select badge beyond subscription and quota level, e.g. geocoding's mode. */
export interface ExtraFilter {
  filter: DashboardFilterParam;
  values: readonly string[];
  onChange: (values: string[]) => void;
}

/**
 * The filter strip of a platform usage table: search, month, subscription,
 * quota level, any `extra` badges and the sort, like the connections toolbar.
 * Labels come from `dict`: `search`, `filters.*`.
 */
export default function UsageTenantsToolbar<F extends UsageFilters>({
  id,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  month,
  onMonthChange,
  extra = [],
  dict,
  rootDict,
  lang,
}: Readonly<{
  id: string;
  filters: F;
  onFiltersChange: (filters: F) => void;
  sort: UsageSort;
  onSortChange: (sort: UsageSort) => void;
  month: string;
  onMonthChange: (month: string) => void;
  extra?: readonly ExtraFilter[];
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSearchField
        id={id}
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
      {extra.map((e) => (
        <SelectFilterBadge
          key={e.filter.key}
          filter={e.filter}
          values={[...e.values]}
          onApply={e.onChange}
          onClear={() => e.onChange([])}
          dictionary={rootDict}
        />
      ))}
      <SortBadge
        label={tr("filters.sortLabel", dict)}
        value={sort}
        defaultValue={DEFAULT_USAGE_SORT}
        options={USAGE_SORTS.map((s) => ({
          value: s,
          label: trDynamic(`filters.sort.${s}`, dict),
        }))}
        onChange={(value) => onSortChange(value as UsageSort)}
      />
    </div>
  );
}
