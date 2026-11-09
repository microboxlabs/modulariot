"use client";

import { Button } from "flowbite-react";
import { FilterSearchField } from "@/features/credentials/components/filter-search-field";
import { SelectFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/select-filter-badge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { selectFilter } from "../platform/usage-tenants-toolbar";
import {
  NO_MEMBER_FILTERS,
  isFilteringMembers,
  type MemberFilters,
} from "./team-filters";

export interface FilterOption {
  value: string;
  label: string;
}

/** The options of each member filter. A filter without options is hidden. */
export interface MemberFilterOptions {
  baseRoles: readonly FilterOption[];
  roles: readonly FilterOption[];
  statuses: readonly FilterOption[];
  sources: readonly FilterOption[];
  teams: readonly FilterOption[];
}

type ListKey = Exclude<keyof MemberFilters, "query">;

const LIST_KEYS: readonly ListKey[] = [
  "baseRoles",
  "roles",
  "statuses",
  "sources",
  "teams",
];

/**
 * Status and source come from the members themselves: with one value they
 * would not narrow anything, so they need two to show.
 */
const MIN_OPTIONS: Record<ListKey, number> = {
  baseRoles: 1,
  roles: 1,
  statuses: 2,
  sources: 2,
  teams: 1,
};

const LABEL_KEYS: Record<ListKey, string> = {
  baseRoles: "filterBaseRole",
  roles: "filterModuleRole",
  statuses: "filterStatus",
  sources: "filterSource",
  teams: "filterTeam",
};

/** "{shown} of {total}" for the filter strip. */
export function ShownCount({
  shown,
  total,
  d,
}: Readonly<{ shown: number; total: number; d: I18nRecord }>) {
  return (
    <span
      className="ml-auto text-xs text-gray-500 dark:text-gray-400"
      aria-live="polite"
    >
      {tr("shownOfTotal", d, { shown: String(shown), total: String(total) })}
    </span>
  );
}

/** The search box of the Invitations, Teams and API keys tabs, with the count. */
export function TeamSearchToolbar({
  id,
  query,
  onQuery,
  placeholder,
  shown,
  total,
  d,
}: Readonly<{
  id: string;
  query: string;
  onQuery: (query: string) => void;
  placeholder: string;
  shown: number;
  total: number;
  d: I18nRecord;
}>) {
  return (
    <>
      <FilterSearchField
        id={id}
        value={query}
        placeholder={placeholder}
        onChange={onQuery}
      />
      <ShownCount shown={shown} total={total} d={d} />
    </>
  );
}

/**
 * The Members tab filter strip: search over name and email, a multi-select
 * badge per filter, the shown count and a clear action. Same parts as the
 * platform usage toolbars.
 */
export function TeamMembersToolbar({
  filters,
  onFiltersChange,
  options,
  shown,
  total,
  d,
  rootDict,
}: Readonly<{
  filters: MemberFilters;
  onFiltersChange: (filters: MemberFilters) => void;
  options: MemberFilterOptions;
  shown: number;
  total: number;
  d: I18nRecord;
  rootDict: I18nRecord;
}>) {
  const set = (key: ListKey, values: string[]) =>
    onFiltersChange({ ...filters, [key]: values });
  return (
    <>
      <FilterSearchField
        id="team-member-search"
        value={filters.query}
        placeholder={tr("searchMembers", d)}
        onChange={(query) => onFiltersChange({ ...filters, query })}
      />
      {LIST_KEYS.filter((key) => options[key].length >= MIN_OPTIONS[key]).map(
        (key) => (
          <SelectFilterBadge
            key={key}
            filter={selectFilter(
              key,
              trDynamic(LABEL_KEYS[key], d),
              options[key]
            )}
            values={[...filters[key]]}
            onApply={(values) => set(key, values)}
            onClear={() => set(key, [])}
            dictionary={rootDict}
          />
        )
      )}
      {isFilteringMembers(filters) && (
        <Button
          size="xs"
          color="light"
          onClick={() => onFiltersChange(NO_MEMBER_FILTERS)}
        >
          {tr("clearFilters", d)}
        </Button>
      )}
      <ShownCount shown={shown} total={total} d={d} />
    </>
  );
}
