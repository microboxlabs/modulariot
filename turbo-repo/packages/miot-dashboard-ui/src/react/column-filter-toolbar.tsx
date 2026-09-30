"use client";

import type { ColumnFilter } from "../core/column-filter-types";
import { resolveDataProperty } from "../core/resolve-data-property";

export interface ColumnFilterToolbarProps {
  readonly filters: Readonly<Record<string, ColumnFilter>>;
  readonly columns: readonly {
    readonly key: string;
    readonly label?: string;
  }[];
  readonly summary: string;
  readonly clearAllLabel: string;
  readonly removeLabel: (label: string) => string;
  readonly formatValue: (filter: ColumnFilter) => string;
  readonly onRemove: (columnKey: string) => void;
  readonly onClearAll: () => void;
  readonly disabled?: boolean;
}

/** Controlled filter summary; the host supplies all translated text. */
export function ColumnFilterToolbar({
  filters,
  columns,
  summary,
  clearAllLabel,
  removeLabel,
  formatValue,
  onRemove,
  onClearAll,
  disabled = false,
}: ColumnFilterToolbarProps) {
  const activeFilters = Object.values(filters);
  if (activeFilters.length === 0) return null;
  return (
    <div className="miot-row-controls miot-column-filter-toolbar">
      <span role="status">{summary}</span>
      {activeFilters.map((filter) => {
        const column = columns.find((item) => item.key === filter.columnKey);
        const label =
          column?.label ??
          resolveDataProperty(filter.columnKey) ??
          filter.columnKey;
        const text = `${label}: ${formatValue(filter)}`;
        return (
          <button
            key={filter.columnKey}
            type="button"
            className="miot-row-controls__pill miot-column-filter-toolbar__chip"
            aria-label={removeLabel(text)}
            disabled={disabled}
            onClick={() => onRemove(filter.columnKey)}
          >
            {text} <span aria-hidden="true">×</span>
          </button>
        );
      })}
      <button
        type="button"
        className="miot-row-controls__pill"
        disabled={disabled}
        onClick={onClearAll}
      >
        {clearAllLabel}
      </button>
    </div>
  );
}
