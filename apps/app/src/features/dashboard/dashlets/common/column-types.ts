export type DataMode = "static" | "dynamic" | "pgrest";

export type ColumnType = "text" | "badge" | "highlight" | "signed" | "progress";

export const COLUMN_TYPES: ColumnType[] = ["text", "badge", "highlight", "signed", "progress"];

export function isColumnType(value: string): value is ColumnType {
  return (COLUMN_TYPES as string[]).includes(value);
}

export interface TableColumn {
  key: string;
  label: string;
  type: string;
}

export interface SortConfig {
  enabled: boolean;
  /** Ordered list of column keys available in the sort toolbar */
  columns: string[];
}
