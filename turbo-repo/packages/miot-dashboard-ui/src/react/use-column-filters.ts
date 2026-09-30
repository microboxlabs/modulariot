"use client";

import { useState, useMemo, useCallback } from "react";
import type {
  ColumnDataType as DataType,
  FilterableColumn,
  ColumnFilter,
} from "../core/column-filter-types";
import {
  matchesFilter,
  resolveColumnDataTypes,
  buildEnumValues,
} from "../core/column-filter-engine";

export interface UseColumnFiltersResult {
  filters: Record<string, ColumnFilter>;
  filteredData: Record<string, string>[];
  enumValues: Record<string, string[]>;
  /** Effective data type per column key (explicit or auto-detected). */
  resolvedDataTypes: Record<string, DataType>;
  setFilter: (columnKey: string, filter: ColumnFilter | null) => void;
  removeFilter: (columnKey: string) => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
  totalCount: number;
  filteredCount: number;
}

export function useColumnFilters(
  data: Record<string, string>[],
  columns: readonly FilterableColumn[],
): UseColumnFiltersResult {
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});

  const setFilter = useCallback(
    (columnKey: string, filter: ColumnFilter | null) => {
      setFilters((prev) => {
        const next = { ...prev };
        if (filter === null) {
          delete next[columnKey];
        } else {
          Object.defineProperty(next, columnKey, {
            value: { ...filter, columnKey },
            enumerable: true,
            configurable: true,
            writable: true,
          });
        }
        return next;
      });
    },
    [],
  );

  const removeFilter = useCallback(
    (columnKey: string) => {
      setFilter(columnKey, null);
    },
    [setFilter],
  );

  const clearAllFilters = useCallback(() => {
    setFilters({});
  }, []);

  const activeFilters = useMemo(() => {
    const keys = new Set(columns.map((column) => column.key));
    return Object.values(filters).filter((filter) =>
      keys.has(filter.columnKey),
    );
  }, [filters, columns]);

  const visibleFilters = useMemo(
    () =>
      Object.fromEntries(
        activeFilters.map((filter) => [filter.columnKey, filter]),
      ),
    [activeFilters],
  );

  // Resolve data type per column: use explicit dataType or auto-detect from data
  const resolvedDataTypes = useMemo(() => {
    return resolveColumnDataTypes(data, columns);
  }, [data, columns]);

  const enumValues = useMemo(() => {
    return buildEnumValues(data, columns, resolvedDataTypes);
  }, [data, columns, resolvedDataTypes]);

  const filteredData = useMemo(() => {
    if (activeFilters.length === 0) return data;
    return data.filter((row) =>
      activeFilters.every((filter) => matchesFilter(row, filter)),
    );
  }, [data, activeFilters]);

  return {
    filters: visibleFilters,
    filteredData,
    enumValues,
    resolvedDataTypes,
    setFilter,
    removeFilter,
    clearAllFilters,
    activeFilterCount: activeFilters.length,
    totalCount: data.length,
    filteredCount: filteredData.length,
  };
}
