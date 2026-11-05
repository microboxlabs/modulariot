"use client";

import { FilterSearchField } from "@/features/credentials/components/filter-search-field";
import { SortBadge } from "@/features/credentials/components/sort-badge";
import { SelectFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/select-filter-badge";
import type { DashboardFilterParam } from "@/features/dashboard/types/dashboard.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  DEFAULT_CONNECTION_SORT,
  type ConnectionFilters,
  type ConnectionSort,
  type ConnectionState,
} from "../connection-catalog";

const STATES: readonly ConnectionState[] = ["active", "failed", "draft"];

const SORT_OPTIONS: readonly { value: ConnectionSort; key: string }[] = [
  { value: "NAME_ASC", key: "filters.sortNameAsc" },
  { value: "NAME_DESC", key: "filters.sortNameDesc" },
  { value: "TESTED_DESC", key: "filters.sortTested" },
];

/** Search, type and state filters and sort for the connections, like the credentials toolbar. */
export function ConnectionsToolbar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  types,
  dict,
  rootDict,
}: Readonly<{
  filters: ConnectionFilters;
  onFiltersChange: (filters: ConnectionFilters) => void;
  sort: ConnectionSort;
  onSortChange: (sort: ConnectionSort) => void;
  /** Type names present in the list. */
  types: readonly string[];
  dict: I18nRecord;
  /** Root dictionary — SelectFilterBadge translates its "all" row from it. */
  rootDict: I18nRecord;
}>) {
  const typeFilter: DashboardFilterParam = {
    key: "type",
    label: tr("filters.type", dict),
    type: "select",
    options: types.map((type) => ({ value: type, label: type })),
  };
  const stateFilter: DashboardFilterParam = {
    key: "state",
    label: tr("filters.status", dict),
    type: "select",
    options: STATES.map((state) => ({
      value: state,
      label: trDynamic(`status.${state}`, dict),
    })),
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSearchField
        id="connection-search"
        value={filters.query}
        placeholder={tr("filters.searchPlaceholder", dict)}
        onChange={(query) => onFiltersChange({ ...filters, query })}
      />
      <SelectFilterBadge
        filter={typeFilter}
        values={[...filters.types]}
        onApply={(values) => onFiltersChange({ ...filters, types: values })}
        onClear={() => onFiltersChange({ ...filters, types: [] })}
        dictionary={rootDict}
      />
      <SelectFilterBadge
        filter={stateFilter}
        values={[...filters.states]}
        onApply={(values) => onFiltersChange({ ...filters, states: values })}
        onClear={() => onFiltersChange({ ...filters, states: [] })}
        dictionary={rootDict}
      />
      <SortBadge
        label={tr("filters.sortLabel", dict)}
        value={sort}
        defaultValue={DEFAULT_CONNECTION_SORT}
        options={SORT_OPTIONS.map((option) => ({
          value: option.value,
          label: trDynamic(option.key, dict),
        }))}
        onChange={(value) => onSortChange(value as ConnectionSort)}
      />
    </div>
  );
}
