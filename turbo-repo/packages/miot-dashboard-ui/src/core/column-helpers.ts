import type { TableColumn } from "./column-types";

export interface ColumnItem extends TableColumn {
  _id: string;
}

let _cmCounter = 0;

export function toColumnItems(columns: TableColumn[]): ColumnItem[] {
  return columns.map((col, i) => ({
    ...col,
    _id: `col-${i}-${col.key}`,
    colorMap: col.colorMap?.map((m) => ({
      ...m,
      _id: m._id ?? `cm-${_cmCounter++}`,
    })),
  }));
}

export function fromColumnItems(items: ColumnItem[]): TableColumn[] {
  return items.map(
    ({
      key,
      label,
      type,
      dataType,
      colorMap,
      colorRulesEnabled,
      sticky,
      descriptionEnabled,
      description,
      decorator,
    }) => {
      const col: TableColumn = { key, label, type };
      if (dataType && dataType !== "text") {
        col.dataType = dataType;
      }
      if (colorMap && colorMap.length > 0) {
        col.colorMap = colorMap.map(({ operator, value, color }) => ({
          operator,
          value,
          color,
        }));
      }
      if (colorRulesEnabled) {
        col.colorRulesEnabled = true;
      }
      if (sticky) {
        col.sticky = true;
      }
      if (descriptionEnabled) {
        col.descriptionEnabled = true;
      }
      if (description) {
        col.description = description;
      }
      if (decorator) {
        col.decorator = decorator;
      }
      return col;
    }
  );
}
