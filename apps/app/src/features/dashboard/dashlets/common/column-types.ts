export type ColumnType = "text" | "badge" | "highlight" | "signed" | "progress";

export interface TableColumn {
  key: string;
  label: string;
  type: ColumnType;
}

export interface SortConfig {
  enabled: boolean;
  /** Ordered list of column keys available in the sort toolbar */
  columns: string[];
}
