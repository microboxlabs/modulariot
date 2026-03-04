import { useState, useMemo } from "react";
import type { FilterConfig } from "./filter-types";
import type { SortConfig, TableColumn } from "./column-types";

export interface UseFilterAndSortResult {
  filterValues: Record<string, string>;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  filterOptionsByColumn: Record<string, string[]>;
  displayRows: Record<string, string>[];
  getColumnLabel: (key: string) => string;
  handleFilterClear: (column: string) => void;
  handleFilterSelect: (column: string, value: string) => void;
  handleSortClick: (key: string) => void;
}

export function useFilterAndSort(
  filter: FilterConfig,
  sort: SortConfig,
  allRows: Record<string, string>[],
  columns: TableColumn[],
): UseFilterAndSortResult {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Distinct values per filter item (derived from full dataset)
  const filterOptionsByColumn = useMemo(() => {
    if (!filter.enabled) return {};
    const result: Record<string, string[]> = {};
    for (const item of filter.items) {
      const seen = new Set<string>();
      for (const row of allRows) {
        const val = row[item.column];
        if (val) seen.add(val);
      }
      result[item.column] = Array.from(seen);
    }
    return result;
  }, [allRows, filter.enabled, filter.items]);

  // Column label lookup for sort toolbar
  const getColumnLabel = (key: string) =>
    columns.find((c) => c.key === key)?.label ?? key;

  // Apply all active filters (AND) then sort
  const displayRows = useMemo(() => {
    let result = allRows;

    if (filter.enabled) {
      for (const item of filter.items) {
        const selected = filterValues[item.column];
        if (selected) {
          result = result.filter((row) => row[item.column] === selected);
        }
      }
    }

    if (sort.enabled && sortKey) {
      result = [...result].sort((a, b) => {
        const cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [allRows, filter, filterValues, sort, sortKey, sortDir]);

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
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
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
    getColumnLabel,
    handleFilterClear,
    handleFilterSelect,
    handleSortClick,
  };
}
