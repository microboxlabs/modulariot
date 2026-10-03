export type ColumnDataType = "text" | "number" | "date" | "enum" | "boolean";
export interface FilterableColumn {
  key: string;
  dataType?: ColumnDataType;
}

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
  dataType: ColumnDataType;
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

export function getDefaultOperator(dataType: ColumnDataType): FilterOperator {
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
