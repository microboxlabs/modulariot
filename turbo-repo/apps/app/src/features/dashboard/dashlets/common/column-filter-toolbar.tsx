"use client";

import { HiXMark } from "react-icons/hi2";
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
  const activeFilters = Object.values(filters);
  if (activeFilters.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800">
      <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
        Showing {filteredCount} of {totalCount}
      </span>

      <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />

      {activeFilters.map((filter) => {
        const col = columns.find((c) => c.key === filter.columnKey);
        const label = col?.label ?? resolveDataProperty(filter.columnKey) ?? filter.columnKey;
        return (
          <FilterChip
            key={filter.columnKey}
            label={label}
            value={formatFilterValue(filter)}
            onRemove={() => onRemove(filter.columnKey)}
          />
        );
      })}

      <button
        onClick={onClearAll}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        <HiXMark className="h-3 w-3" />
        Clear all
      </button>
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
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
      <span className="font-medium">{label}:</span>
      <span className="max-w-[120px] truncate">{value}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-orange-200 dark:hover:bg-orange-800"
      >
        <HiXMark className="h-3 w-3" />
      </button>
    </span>
  );
}

// ============================================================================
// Value formatting
// ============================================================================

function formatFilterValue(filter: ColumnFilter): string {
  const { operator, value, dataType } = filter;

  if (operator === "isEmpty") return "empty";
  if (operator === "isNotEmpty") return "not empty";

  switch (dataType) {
    case "text":
      return `"${value}"`;
    case "number":
      return formatNumericValue(operator, value);
    case "date":
      return formatDateValue(value);
    case "enum":
      return formatEnumValue(value);
    case "boolean":
      return value === true ? "Yes" : "No";
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

function formatDateValue(value: ColumnFilter["value"]): string {
  if (!Array.isArray(value)) return String(value);
  const [from, to] = value as [string, string];
  if (from && to) return `${from} → ${to}`;
  if (from) return `from ${from}`;
  if (to) return `to ${to}`;
  return String(value);
}

function formatEnumValue(value: ColumnFilter["value"]): string {
  if (!Array.isArray(value)) return String(value);
  const items = value as string[];
  if (items.length <= 2) return items.join(", ");
  return `${items[0]}, ${items[1]} +${items.length - 2}`;
}
