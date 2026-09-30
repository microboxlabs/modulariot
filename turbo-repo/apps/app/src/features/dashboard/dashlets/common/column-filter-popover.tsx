"use client";
import { ColumnFilterPopover as PortableColumnFilterPopover } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import { tr } from "@/features/i18n/tr.service";
import { useOptionalDashboard } from "@/features/dashboard/context/dashboard-context";
import type { DataType } from "./column-types";
import type { ColumnFilter } from "./column-filter-types";

interface ColumnFilterPopoverProps {
  readonly columnKey: string;
  readonly columnLabel: string;
  readonly dataType: DataType;
  readonly currentFilter: ColumnFilter | undefined;
  readonly enumValues: string[];
  readonly onFilterChange: (
    columnKey: string,
    filter: ColumnFilter | null
  ) => void;
}

export function ColumnFilterPopover(props: ColumnFilterPopoverProps) {
  const { dictionary } = useOptionalDashboard();
  return (
    <PortableColumnFilterPopover
      {...props}
      title={tr("dashboard.settings.columnFilterTitle", dictionary, {
        column: props.columnLabel,
      })}
      clearLabel={tr("dashboard.settings.columnFilterClear", dictionary)}
      labels={{
        search: tr("dashboard.settings.columnFilterSearch", dictionary),
        equals: tr("dashboard.settings.columnFilterEquals", dictionary),
        greaterThan: tr(
          "dashboard.settings.columnFilterGreaterThan",
          dictionary
        ),
        lessThan: tr("dashboard.settings.columnFilterLessThan", dictionary),
        between: tr("dashboard.settings.columnFilterBetween", dictionary),
        min: tr("dashboard.settings.columnFilterMin", dictionary),
        value: tr("dashboard.settings.columnFilterValue", dictionary),
        max: tr("dashboard.settings.columnFilterMax", dictionary),
        from: tr("dashboard.settings.columnFilterFrom", dictionary),
        to: tr("dashboard.settings.columnFilterTo", dictionary),
        empty: tr("dashboard.settings.columnFilterEmpty", dictionary),
        noMatches: tr("dashboard.settings.columnFilterNoMatches", dictionary),
        noValues: tr("dashboard.settings.columnFilterNoValues", dictionary),
        all: tr("dashboard.settings.columnFilterAll", dictionary),
        yes: tr("dashboard.settings.columnFilterYes", dictionary),
        no: tr("dashboard.settings.columnFilterNo", dictionary),
        operator: tr("dashboard.settings.columnFilterOperator", dictionary),
      }}
    />
  );
}
