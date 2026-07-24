import type { ColorRuleOperator } from "./color-rule-types";

export type DataMode = "static" | "dynamic" | "pgrest" | "planner";

export type ColumnType = "text" | "badge" | "highlight" | "signed" | "progress";

export const COLUMN_TYPES: ColumnType[] = [
  "text",
  "badge",
  "signed",
  "progress",
];

export function isColumnType(value: string): value is ColumnType {
  return (COLUMN_TYPES as string[]).includes(value);
}

/** Semantic data type used for per-column filtering. */
export type DataType = "text" | "number" | "date" | "enum" | "boolean";

export const DATA_TYPES: DataType[] = [
  "text",
  "number",
  "date",
  "enum",
  "boolean",
];

export function isDataType(value: string): value is DataType {
  return (DATA_TYPES as string[]).includes(value);
}

export interface BadgeColorMapping {
  _id?: string;
  operator: ColorRuleOperator;
  value: string;
  color: string;
}

export interface TableColumn {
  key: string;
  label: string;
  type: string;
  /** Semantic data type for per-column filtering. Defaults to "text" when absent. */
  dataType?: DataType;
  /** Value-to-color mappings. Evaluated for all column types when colorRulesEnabled is true. */
  colorMap?: BadgeColorMapping[];
  /** When true, colorMap rules are evaluated and applied for this column. */
  colorRulesEnabled?: boolean;
  /** When true the column sticks to the left edge during horizontal scroll. */
  sticky?: boolean;
  /** When true the description tooltip is shown on the column header. */
  descriptionEnabled?: boolean;
  /** Markdown description shown as a tooltip on the column header. */
  description?: string;
  /** Text appended after the cell value (e.g. "Días", "km"). */
  decorator?: string;
}

export interface SortConfig {
  enabled: boolean;
  /** Ordered list of column keys available in the sort toolbar */
  columns: string[];
}
