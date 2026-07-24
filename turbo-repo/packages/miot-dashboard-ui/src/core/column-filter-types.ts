import type { DataType } from "./column-types";

export type FilterOperator =
  | "contains"
  | "equals"
  | "gt"
  | "lt"
  | "between"
  | "dateRange"
  | "in"
  | "is"
  | "isEmpty"
  | "isNotEmpty";

export interface ColumnFilter {
  columnKey: string;
  dataType: DataType;
  operator: FilterOperator;
  value:
    | string
    | number
    | [number, number]
    | [string, string]
    | string[]
    | boolean
    | null;
}

export function getDefaultOperator(dataType: DataType): FilterOperator {
  switch (dataType) {
    case "text":
      return "contains";
    case "number":
      return "equals";
    case "date":
      return "dateRange";
    case "enum":
      return "in";
    case "boolean":
      return "is";
  }
}
