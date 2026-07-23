"use client";

import { SelectFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/select-filter-badge";
import type { DashboardFilterParam } from "@/features/dashboard/types/dashboard.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  DEFAULT_SORT,
  type CredentialFilters,
  type CredentialSort,
} from "../credential-filters";
import { findCredentialType, type CredentialTypeId } from "../credential.types";
import { environmentLabel } from "./credential-badges";
import { FilterSearchField } from "./filter-search-field";
import { SortBadge } from "./sort-badge";

interface CredentialsToolbarProps {
  readonly filters: CredentialFilters;
  readonly onFiltersChange: (filters: CredentialFilters) => void;
  readonly sort: CredentialSort;
  readonly onSortChange: (sort: CredentialSort) => void;
  /** Credential types present in the list, for the type filter. */
  readonly types: readonly CredentialTypeId[];
  /** Environments in use, for the environment filter. */
  readonly environments: readonly string[];
  /** Credentials dictionary subtree, for this toolbar's own labels. */
  readonly dict: I18nRecord;
  /** Root dictionary — SelectFilterBadge translates its "all" row from it. */
  readonly rootDict: I18nRecord;
}

const SORT_OPTIONS: readonly { value: CredentialSort; key: string }[] = [
  { value: "NAME_ASC", key: "filters.sortNameAsc" },
  { value: "NAME_DESC", key: "filters.sortNameDesc" },
  { value: "CREATED_DESC", key: "filters.sortCreated" },
  { value: "UPDATED_DESC", key: "filters.sortUpdated" },
];

/**
 * Search, type/environment filters and sort for the credentials list.
 *
 * The two filters use the app's global-filter select badge
 * ({@link SelectFilterBadge}) so they behave like filters everywhere else:
 * multi-select, "all" to clear, value summarised on the badge.
 */
export function CredentialsToolbar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  types,
  environments,
  dict,
  rootDict,
}: CredentialsToolbarProps) {
  const typeFilter: DashboardFilterParam = {
    key: "type",
    label: tr("filters.type", dict),
    type: "select",
    options: types.map((typeId) => {
      const descriptor = findCredentialType(typeId);
      return {
        value: typeId,
        label: descriptor
          ? trDynamic(descriptor.nameKey, dict)
          : typeId.toLowerCase(),
      };
    }),
  };

  const environmentFilter: DashboardFilterParam = {
    key: "environment",
    label: tr("filters.environment", dict),
    type: "select",
    options: environments.map((environment) => ({
      value: environment,
      label: environmentLabel(environment, dict),
    })),
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSearchField
        id="credential-search"
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
        filter={environmentFilter}
        values={[...filters.environments]}
        onApply={(values) =>
          onFiltersChange({ ...filters, environments: values })
        }
        onClear={() => onFiltersChange({ ...filters, environments: [] })}
        dictionary={rootDict}
      />

      <SortBadge
        label={tr("filters.sortLabel", dict)}
        value={sort}
        defaultValue={DEFAULT_SORT}
        options={SORT_OPTIONS.map((option) => ({
          value: option.value,
          label: trDynamic(option.key, dict),
        }))}
        onChange={(value) => onSortChange(value as CredentialSort)}
      />
    </div>
  );
}
