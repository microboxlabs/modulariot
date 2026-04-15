import type { ColorRuleOperator } from "./color-rule-types";

export type DataMode = "static" | "dynamic" | "pgrest" | "planner";

export type ColumnType = "text" | "badge" | "highlight" | "signed" | "progress";

export const COLUMN_TYPES: ColumnType[] = [
  "text",
  "badge",
  "highlight",
  "signed",
  "progress",
];

export function isColumnType(value: string): value is ColumnType {
  return (COLUMN_TYPES as string[]).includes(value);
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
  /** Value-to-color mappings for badge columns. Falls back to keyword matching if absent. */
  colorMap?: BadgeColorMapping[];
}

export interface SortConfig {
  enabled: boolean;
  /** Ordered list of column keys available in the sort toolbar */
  columns: string[];
}
