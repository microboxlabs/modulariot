"use client";
import { useState, useMemo } from "react";
import { resolveDataProperty } from "../core/resolve-data-property";
export interface RowFilterConfig {
  enabled: boolean;
  items: readonly { column: string; label: string }[];
}
export interface RowSortConfig {
  enabled: boolean;
  columns: readonly string[];
}
export interface RowColumn {
  key: string;
  label: string;
}
function ownValue(row: Readonly<Record<string, string>>, key: string) {
  return Object.hasOwn(row, key) ? row[key] : undefined;
}

export interface UseFilterAndSortResult {
  filterValues: Record<string, string>;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  filterOptionsByColumn: Record<string, string[]>;
  displayRows: Record<string, string>[];
  /** Sort columns filtered to only those present in the column definitions */
  validSortColumns: string[];
  getColumnLabel: (key: string) => string;
  handleFilterClear: (column: string) => void;
  handleFilterSelect: (column: string, value: string) => void;
  handleSortClick: (key: string) => void;
}

export function useFilterAndSort(
  filter: RowFilterConfig,
  sort: RowSortConfig,
  allRows: Record<string, string>[],
  columns: readonly RowColumn[],
): UseFilterAndSortResult {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Distinct values per filter item (derived from full dataset)
  const filterOptionsByColumn = useMemo(() => {
    if (!filter.enabled) return {};
    const result: Record<string, string[]> = {};
    for (const item of filter.items) {
      const prop = resolveDataProperty(item.column);
      if (!prop) continue;
      const seen = new Set<string>();
      for (const row of allRows) {
        const val = ownValue(row, prop);
        if (val) seen.add(val);
      }
      Object.defineProperty(result, item.column, {
        value: Array.from(seen),
        enumerable: true,
        configurable: true,
      });
    }
    return result;
  }, [allRows, filter.enabled, filter.items]);

  // Column label lookup for sort toolbar
  const getColumnLabel = (key: string) =>
    columns.find((c) => c.key === key)?.label ?? key;

  // Only show sort pills for columns that actually exist
  const validSortColumns = useMemo(() => {
    const colKeys = new Set(columns.map((c) => c.key));
    return sort.columns.filter((k) => colKeys.has(k));
  }, [sort.columns, columns]);

  // Apply all active filters (AND) then sort
  const displayRows = useMemo(() => {
    let result = allRows;

    if (filter.enabled) {
      for (const item of filter.items) {
        const selected = ownValue(filterValues, item.column);
        const prop = resolveDataProperty(item.column);
        if (selected && prop) {
          result = result.filter((row) => ownValue(row, prop) === selected);
        }
      }
    }

    if (sort.enabled && sortKey && validSortColumns.includes(sortKey)) {
      const sortProp = resolveDataProperty(sortKey);
      if (sortProp) {
        result = [...result].sort((a, b) => {
          const aVal = ownValue(a, sortProp);
          const bVal = ownValue(b, sortProp);
          const aEmpty = aVal == null || aVal === "";
          const bEmpty = bVal == null || bVal === "";

          if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
          if (aEmpty && bEmpty) return 0;

          const cmp = (aVal ?? "").localeCompare(bVal ?? "", undefined, {
            numeric: true,
          });
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }

    return result;
  }, [allRows, filter, filterValues, sort, sortKey, sortDir, validSortColumns]);

  const handleFilterClear = (column: string) => {
    setFilterValues((prev) => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
  };

  const handleFilterSelect = (column: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [column]: value }));
  };

  const handleSortClick = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return {
    filterValues,
    sortKey,
    sortDir,
    filterOptionsByColumn,
    displayRows,
    validSortColumns,
    getColumnLabel,
    handleFilterClear,
    handleFilterSelect,
    handleSortClick,
  };
}
