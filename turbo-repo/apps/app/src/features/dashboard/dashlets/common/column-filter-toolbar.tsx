"use client";

import { ColumnFilterToolbar as PortableColumnFilterToolbar } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useOptionalDashboard } from "@/features/dashboard/context/dashboard-context";
import type { TableColumn } from "./column-types";
import type { ColumnFilter } from "./column-filter-types";

interface ColumnFilterToolbarProps {
  readonly filters: Record<string, ColumnFilter>;
  readonly columns: TableColumn[];
  readonly totalCount: number;
  readonly filteredCount: number;
  readonly onRemove: (columnKey: string) => void;
  readonly onClearAll: () => void;
}

export function ColumnFilterToolbar(props: ColumnFilterToolbarProps) {
  const { dictionary } = useOptionalDashboard();
  return (
    <PortableColumnFilterToolbar
      {...props}
      summary={tr("dashboard.settings.columnFilterShowing", dictionary, {
        filtered: String(props.filteredCount),
        total: String(props.totalCount),
      })}
      clearAllLabel={tr("dashboard.settings.columnFilterClearAll", dictionary)}
      removeLabel={(label) =>
        `${tr("dashboard.settings.columnFilterClear", dictionary)}: ${label}`
      }
      formatValue={(filter) => formatFilterValue(filter, dictionary)}
    />
  );
}

function formatFilterValue(filter: ColumnFilter, dict: I18nRecord): string {
  const { operator, value, dataType } = filter;

  if (operator === "isEmpty")
    return tr("dashboard.settings.columnFilterEmpty", dict);
  if (operator === "isNotEmpty")
    return tr("dashboard.settings.columnFilterNotEmpty", dict);

  switch (dataType) {
    case "text":
      return `"${value}"`;
    case "number":
      return formatNumericValue(operator, value);
    case "date":
      return formatDateValue(value, dict);
    case "enum":
      return formatEnumValue(value);
    case "boolean":
      return value === true
        ? tr("dashboard.settings.columnFilterYes", dict)
        : tr("dashboard.settings.columnFilterNo", dict);
  }
}

function formatNumericValue(
  operator: string,
  value: ColumnFilter["value"]
): string {
  if (operator === "between" && Array.isArray(value)) {
    return `${value[0]} - ${value[1]}`;
  }
  if (operator === "gt") return `> ${value}`;
  if (operator === "lt") return `< ${value}`;
  return `= ${value}`;
}

function formatDateValue(
  value: ColumnFilter["value"],
  dict: I18nRecord
): string {
  if (!Array.isArray(value)) return String(value);
  const [from, to] = value as [string, string];
  if (from && to)
    return tr("dashboard.settings.columnFilterDateRange", dict, { from, to });
  if (from)
    return tr("dashboard.settings.columnFilterFromDate", dict, { date: from });
  if (to)
    return tr("dashboard.settings.columnFilterToDate", dict, { date: to });
  return String(value);
}

function formatEnumValue(value: ColumnFilter["value"]): string {
  if (!Array.isArray(value)) return String(value);
  const items = value as string[];
  if (items.length <= 2) return items.join(", ");
  return `${items[0]}, ${items[1]} +${items.length - 2}`;
}
