import type { TableColumn } from "./column-types";

export interface ColumnItem extends TableColumn {
  _id: string;
}

export function toColumnItems(columns: TableColumn[]): ColumnItem[] {
  return columns.map((col, i) => ({ ...col, _id: `col-${i}-${col.key}` }));
}

export function fromColumnItems(items: ColumnItem[]): TableColumn[] {
  return items.map(({ key, label, type, colorMap }) => {
    const col: TableColumn = { key, label, type };
    if (colorMap && colorMap.length > 0) col.colorMap = colorMap;
    return col;
  });
}
