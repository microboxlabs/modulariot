"use client";

import { useState, useMemo, useCallback } from "react";
import type { DataType, TableColumn } from "./column-types";
import type { ColumnFilter } from "./column-filter-types";
import { resolveDataProperty } from "./handlebars-helpers";

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
  columns: TableColumn[],
): UseColumnFiltersResult {
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});

  const setFilter = useCallback(
    (columnKey: string, filter: ColumnFilter | null) => {
      setFilters((prev) => {
        const next = { ...prev };
        if (filter === null) {
          delete next[columnKey];
        } else {
          next[columnKey] = filter;
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

  const activeFilters = useMemo(() => Object.values(filters), [filters]);

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
    filters,
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

// ---------------------------------------------------------------------------
// Boolean value sets (shared between detection and filtering)
// ---------------------------------------------------------------------------

const BOOLEAN_VALUES = new Set([
  "true",
  "false",
  "yes",
  "no",
  "si",
  "sí",
  "1",
  "0",
]);

const BOOLEAN_TRUTHY = new Set(["true", "1", "yes", "si", "sí"]);

// ---------------------------------------------------------------------------
// Pure filter helpers
// ---------------------------------------------------------------------------

function matchesFilter(
  row: Record<string, string>,
  filter: ColumnFilter,
): boolean {
  const prop = resolveDataProperty(filter.columnKey);
  if (!prop) return true;
  const rawValue = row[prop];
  return applyFilter(rawValue, filter);
}

function applyFilter(value: string | undefined, filter: ColumnFilter): boolean {
  const { operator, value: filterValue } = filter;

  if (operator === "isEmpty") {
    return value == null || value === "" || value.trim() === "";
  }
  if (operator === "isNotEmpty") {
    return value != null && value !== "" && value.trim() !== "";
  }

  if (value == null || value === "") return false;

  switch (filter.dataType) {
    case "text":
      return applyTextFilter(value, operator, filterValue);
    case "number":
      return applyNumericFilter(value, operator, filterValue);
    case "date":
      return applyDateFilter(value, operator, filterValue);
    case "enum":
      return applyEnumFilter(value, operator, filterValue);
    case "boolean":
      return applyBooleanFilter(value, operator, filterValue);
  }
}

function applyTextFilter(
  value: string,
  operator: string,
  filterValue: ColumnFilter["value"],
): boolean {
  const strValue = value.toLowerCase();
  const searchTerm = String(filterValue).toLowerCase();
  if (!searchTerm) return true;
  if (operator === "contains") return strValue.includes(searchTerm);
  if (operator === "equals") return strValue === searchTerm;
  return true;
}

function applyNumericFilter(
  value: string,
  operator: string,
  filterValue: ColumnFilter["value"],
): boolean {
  const numValue = parseNumericString(value);
  if (Number.isNaN(numValue)) return false;

  if (operator === "equals") return numValue === Number(filterValue);
  if (operator === "gt") return numValue > Number(filterValue);
  if (operator === "lt") return numValue < Number(filterValue);
  if (operator === "between" && Array.isArray(filterValue)) {
    const [min, max] = filterValue as [number, number];
    return numValue >= min && numValue <= max;
  }
  return true;
}

function applyDateFilter(
  value: string,
  operator: string,
  filterValue: ColumnFilter["value"],
): boolean {
  if (operator !== "dateRange" || !Array.isArray(filterValue)) return true;

  const [from, to] = filterValue as [string, string];
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return false;

  if (from && to) {
    return (
      dateValue >= new Date(from) && dateValue <= new Date(to + "T23:59:59")
    );
  }
  if (from) return dateValue >= new Date(from);
  if (to) return dateValue <= new Date(to + "T23:59:59");
  return true;
}

function applyEnumFilter(
  value: string,
  operator: string,
  filterValue: ColumnFilter["value"],
): boolean {
  if (operator !== "in" || !Array.isArray(filterValue)) return true;
  if (filterValue.length === 0) return true;
  return (filterValue as string[]).includes(value);
}

function applyBooleanFilter(
  value: string,
  operator: string,
  filterValue: ColumnFilter["value"],
): boolean {
  if (operator !== "is" || filterValue === null) return true;
  const boolValue = BOOLEAN_TRUTHY.has(value.toLowerCase());
  return boolValue === filterValue;
}

// ---------------------------------------------------------------------------
// Data type auto-detection
// ---------------------------------------------------------------------------

/** ISO-ish date pattern: 2024-01-15, 2024-01-15T10:30:00, etc. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+)?/;

/**
 * Matches values that are genuinely numeric, optionally with:
 * - Leading currency symbols ($, €, etc.)
 * - Thousand separators (commas) or decimal commas (European locales)
 * - Trailing units (km, kg, días, %, etc.) — uses \p{L} for Unicode letters
 * Does NOT match alphanumeric IDs like "DHLP19" or "VF7YF1T3B20123".
 */
const NUMERIC_VALUE_RE =
  /^[€$£¥]?\s*-?\d[\d.,]*\s*[\p{L}%°]*$/u;

/** Max distinct values (relative or absolute) to classify as enum. */
const ENUM_MAX_DISTINCT = 20;
const ENUM_RATIO_THRESHOLD = 0.4;

function detectDataType(values: string[]): DataType {
  const nonEmpty = values.filter((v) => v != null && v.trim() !== "");
  if (nonEmpty.length === 0) return "text";

  // Boolean: all non-empty values are boolean-like
  if (nonEmpty.every((v) => BOOLEAN_VALUES.has(v.toLowerCase()))) {
    return "boolean";
  }

  // Date: all non-empty values match ISO date pattern and parse as valid dates
  if (
    nonEmpty.every((v) => {
      if (!ISO_DATE_RE.test(v)) return false;
      const d = new Date(v);
      return !Number.isNaN(d.getTime());
    })
  ) {
    return "date";
  }

  // Number: values that look like real numbers, optionally with trailing units
  // e.g. "47,400 km", "$1,234.56", "-3.5" — but NOT alphanumeric IDs like "DHLP19"
  if (
    nonEmpty.every((v) => NUMERIC_VALUE_RE.test(v.trim()))
  ) {
    // If all numeric but few distinct values, treat as enum
    const distinct = new Set(nonEmpty);
    if (
      distinct.size <= ENUM_MAX_DISTINCT &&
      distinct.size / nonEmpty.length <= ENUM_RATIO_THRESHOLD
    ) {
      return "enum";
    }
    return "number";
  }

  // Enum: few distinct string values relative to total rows
  const distinct = new Set(nonEmpty);
  if (
    distinct.size <= ENUM_MAX_DISTINCT &&
    nonEmpty.length > 1 &&
    distinct.size / nonEmpty.length <= ENUM_RATIO_THRESHOLD
  ) {
    return "enum";
  }

  return "text";
}

function resolveColumnDataTypes(
  data: Record<string, string>[],
  columns: TableColumn[],
): Record<string, DataType> {
  const result: Record<string, DataType> = {};
  for (const col of columns) {
    // If explicitly configured, use it
    if (col.dataType) {
      result[col.key] = col.dataType;
      continue;
    }
    // Auto-detect from data
    const prop = resolveDataProperty(col.key);
    if (!prop) {
      result[col.key] = "text";
      continue;
    }
    const values = data.map((row) => row[prop]);
    result[col.key] = detectDataType(values);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEXT_ENUM_MAX = 50;

function buildEnumValues(
  data: Record<string, string>[],
  columns: TableColumn[],
  resolvedTypes: Record<string, DataType>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const col of columns) {
    const dataType = resolvedTypes[col.key] ?? "text";
    if (dataType !== "enum" && dataType !== "text") continue;
    const prop = resolveDataProperty(col.key);
    if (!prop) continue;
    const values = new Set<string>();
    for (const row of data) {
      const val = row[prop];
      if (val != null && val !== "") values.add(val);
    }
    if (dataType === "text" && values.size > TEXT_ENUM_MAX) continue;
    result[col.key] = Array.from(values).sort((a, b) => a.localeCompare(b));
  }
  return result;
}

/** Strip non-numeric characters (except minus, dot) and parse.
 *  Handles locale formats: "47,400 km" → 47400, "1,5" → 1.5, "$1,234.56" → 1234.56 */
function parseNumericString(value: string): number {
  // Strip currency symbols and whitespace
  let s = value.replaceAll(/[€$£¥\s]/g, "");
  // Trim trailing non-numeric characters (unit suffixes like "km", "días", "%")
  let end = s.length;
  while (end > 0 && !"-.,0123456789".includes(s[end - 1])) end--;
  s = s.slice(0, end);

  if (s.includes(",") && !s.includes(".")) {
    // No dot present: decide whether comma is decimal or thousands separator.
    // Thousands separators are followed by exactly 3 digits (e.g. "47,400").
    // Decimal commas have a different digit count (e.g. "1,5" or "3,14").
    if (/,\d{3}$/.test(s)) {
      s = s.replaceAll(",", "");
    } else {
      s = s.replace(",", ".");
    }
  } else {
    // Dot present (or no comma) → commas are thousands separators
    s = s.replaceAll(",", "");
  }

  return Number.parseFloat(s);
}
