"use client";

import { tr } from "@/features/i18n/tr.service";
import { HiXMark } from "react-icons/hi2";
import { Button } from "flowbite-react";
import CustomBadge from "@/features/common/components/custom-badge/custom-badge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import type { TableColumn } from "./column-types";
import type { ColumnFilter } from "./column-filter-types";
import { resolveDataProperty } from "./handlebars-helpers";

interface ColumnFilterToolbarProps {
  readonly filters: Record<string, ColumnFilter>;
  readonly columns: TableColumn[];
  readonly totalCount: number;
  readonly filteredCount: number;
  readonly onRemove: (columnKey: string) => void;
  readonly onClearAll: () => void;
}

export function ColumnFilterToolbar({
  filters,
  columns,
  totalCount,
  filteredCount,
  onRemove,
  onClearAll,
}: ColumnFilterToolbarProps) {
  const { dictionary } = useDashboard();
  const activeFilters = Object.values(filters);
  if (activeFilters.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800">
      <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
        {tr("dashboard.settings.columnFilterShowing", dictionary, {
          filtered: String(filteredCount),
          total: String(totalCount),
        })}
      </span>

      <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />

      {activeFilters.map((filter) => {
        const col = columns.find((c) => c.key === filter.columnKey);
        const label = col?.label ?? resolveDataProperty(filter.columnKey) ?? filter.columnKey;
        return (
          <FilterChip
            key={filter.columnKey}
            label={label}
            value={formatFilterValue(filter, dictionary)}
            onRemove={() => onRemove(filter.columnKey)}
          />
        );
      })}

      <Button
        size="xs"
        color="alternative"
        onClick={onClearAll}
        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
      >
        <HiXMark className="mr-1 h-3.5 w-3.5" />
        {tr("dashboard.settings.columnFilterClearAll", dictionary)}
      </Button>
    </div>
  );
}

// ============================================================================
// Filter chip
// ============================================================================

function FilterChip({
  label,
  value,
  onRemove,
}: {
  readonly label: string;
  readonly value: string;
  readonly onRemove: () => void;
}) {
  return <CustomBadge text={`${label}: ${value}`} onRemove={onRemove} />;
}

// ============================================================================
// Value formatting
// ============================================================================

function formatFilterValue(filter: ColumnFilter, dict: I18nRecord): string {
  const { operator, value, dataType } = filter;

  if (operator === "isEmpty") return tr("dashboard.settings.columnFilterEmpty", dict);
  if (operator === "isNotEmpty") return tr("dashboard.settings.columnFilterNotEmpty", dict);

  switch (dataType) {
    case "text":
      return `"${value}"`;
    case "number":
      return formatNumericValue(operator, value);
    case "date":
      return formatDateValue(value, dict);
    case "enum":
      return formatEnumValue(value);
    case "boolean":
      return value === true
        ? tr("dashboard.settings.columnFilterYes", dict)
        : tr("dashboard.settings.columnFilterNo", dict);
  }
}

function formatNumericValue(
  operator: string,
  value: ColumnFilter["value"],
): string {
  if (operator === "between" && Array.isArray(value)) {
    return `${value[0]} - ${value[1]}`;
  }
  if (operator === "gt") return `> ${value}`;
  if (operator === "lt") return `< ${value}`;
  return `= ${value}`;
}

function formatDateValue(value: ColumnFilter["value"], dict: I18nRecord): string {
  if (!Array.isArray(value)) return String(value);
  const [from, to] = value as [string, string];
  if (from && to) return tr("dashboard.settings.columnFilterDateRange", dict, { from, to });
  if (from) return tr("dashboard.settings.columnFilterFromDate", dict, { date: from });
  if (to) return tr("dashboard.settings.columnFilterToDate", dict, { date: to });
  return String(value);
}

function formatEnumValue(value: ColumnFilter["value"]): string {
  if (!Array.isArray(value)) return String(value);
  const items = value as string[];
  if (items.length <= 2) return items.join(", ");
  return `${items[0]}, ${items[1]} +${items.length - 2}`;
}
