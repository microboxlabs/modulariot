import type {
  ColumnDataType as DataType,
  FilterableColumn,
  ColumnFilter,
} from "./column-filter-types";
import { resolveDataProperty } from "./resolve-data-property";
const ownValue = (row: Readonly<Record<string, string>>, key: string) =>
  Object.hasOwn(row, key) ? row[key] : undefined;
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

export function matchesFilter(
  row: Record<string, string>,
  filter: ColumnFilter,
): boolean {
  const prop = resolveDataProperty(filter.columnKey);
  if (!prop) return true;
  const rawValue = ownValue(row, prop);
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
  if (typeof filterValue !== "string") return false;
  const strValue = value.toLowerCase();
  const searchTerm = String(filterValue).toLowerCase();
  if (operator !== "contains" && operator !== "equals") return false;
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
  if (!Number.isFinite(numValue)) return false;

  if (operator === "between") {
    if (
      !Array.isArray(filterValue) ||
      filterValue.length !== 2 ||
      !filterValue.every((v) => typeof v === "number" && Number.isFinite(v))
    )
      return false;
    const [min, max] = filterValue as [number, number];
    return numValue >= min && numValue <= max;
  }
  if (typeof filterValue !== "number" && typeof filterValue !== "string")
    return false;
  if (typeof filterValue === "string" && !filterValue.trim()) return false;
  const operand = Number(filterValue);
  if (!Number.isFinite(operand)) return false;
  if (operator === "equals") return numValue === operand;
  if (operator === "gt") return numValue > operand;
  if (operator === "lt") return numValue < operand;
  return false;
}

function applyDateFilter(
  value: string,
  operator: string,
  filterValue: ColumnFilter["value"],
): boolean {
  if (
    operator !== "dateRange" ||
    !Array.isArray(filterValue) ||
    filterValue.length !== 2 ||
    !filterValue.every((v) => typeof v === "string")
  )
    return false;

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
  if (
    operator !== "in" ||
    !Array.isArray(filterValue) ||
    !filterValue.every((v) => typeof v === "string")
  )
    return false;
  if (filterValue.length === 0) return true;
  return (filterValue as string[]).includes(value);
}

function applyBooleanFilter(
  value: string,
  operator: string,
  filterValue: ColumnFilter["value"],
): boolean {
  if (operator !== "is" || typeof filterValue !== "boolean") return false;
  const normalized = value.toLowerCase();
  if (!BOOLEAN_VALUES.has(normalized)) return false;
  const boolValue = BOOLEAN_TRUTHY.has(normalized);
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
const NUMERIC_TOKEN_RE = /^[€$£¥]?\s*(-?\d[\d.,]*)\s*[\p{L}%°]*$/u;

/** Max distinct values (relative or absolute) to classify as enum. */
const ENUM_MAX_DISTINCT = 20;
const ENUM_RATIO_THRESHOLD = 0.4;

function detectDataType(values: (string | undefined)[]): DataType {
  const nonEmpty = values.filter(
    (v): v is string => v != null && v.trim() !== "",
  );
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
  if (nonEmpty.every((v) => Number.isFinite(parseNumericString(v)))) {
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

export function resolveColumnDataTypes(
  data: Record<string, string>[],
  columns: readonly FilterableColumn[],
): Record<string, DataType> {
  const result: Record<string, DataType> = Object.create(null);
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
    const values = data.map((row) => ownValue(row, prop));
    result[col.key] = detectDataType(values);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEXT_ENUM_MAX = 50;

export function buildEnumValues(
  data: Record<string, string>[],
  columns: readonly FilterableColumn[],
  resolvedTypes: Record<string, DataType>,
): Record<string, string[]> {
  const result: Record<string, string[]> = Object.create(null);
  for (const col of columns) {
    const dataType = resolvedTypes[col.key] ?? "text";
    if (dataType !== "enum" && dataType !== "text") continue;
    const prop = resolveDataProperty(col.key);
    if (!prop) continue;
    const values = new Set<string>();
    for (const row of data) {
      const val = ownValue(row, prop);
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
  const token = NUMERIC_TOKEN_RE.exec(value.trim())?.[1];
  if (!token) return Number.NaN;
  // Dot decimals and properly grouped comma thousands.
  if (/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(token)) {
    return Number(token.replaceAll(",", ""));
  }
  // A single comma is decimal unless exactly three fractional digits would
  // indicate a (malformed) thousands group under the existing convention.
  const parts = token.split(",");
  if (
    parts.length === 2 &&
    /^-?\d+$/.test(parts[0]!) &&
    /^\d+$/.test(parts[1]!) &&
    parts[1]!.length !== 3
  ) {
    return Number(parts.join("."));
  }
  return Number.NaN;
}
