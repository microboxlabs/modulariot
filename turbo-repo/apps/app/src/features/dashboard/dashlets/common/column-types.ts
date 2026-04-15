import type { RuleColor, ColorRuleOperator } from "./color-rule-types";

export type DataMode = "static" | "dynamic" | "pgrest" | "planner";

export type ColumnType = "text" | "badge" | "highlight" | "signed" | "progress";

export const COLUMN_TYPES: ColumnType[] = ["text", "badge", "highlight", "signed", "progress"];

export function isColumnType(value: string): value is ColumnType {
  return (COLUMN_TYPES as string[]).includes(value);
}

/** Semantic data type used for per-column filtering. */
export type DataType = "text" | "number" | "date" | "enum" | "boolean";

export const DATA_TYPES: DataType[] = ["text", "number", "date", "enum", "boolean"];

export function isDataType(value: string): value is DataType {
  return (DATA_TYPES as string[]).includes(value);
}

export interface BadgeColorMapping {
  _id?: string;
  operator: ColorRuleOperator;
  value: string;
  color: RuleColor;
}

export interface TableColumn {
  key: string;
  label: string;
  type: string;
  /** Semantic data type for per-column filtering. Defaults to "text" when absent. */
  dataType?: DataType;
  /** Value-to-color mappings for badge columns. Falls back to keyword matching if absent. */
  colorMap?: BadgeColorMapping[];
}

export interface SortConfig {
  enabled: boolean;
  /** Ordered list of column keys available in the sort toolbar */
  columns: string[];
}
