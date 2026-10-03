"use client";

import { useMemo } from "react";
import type { ChartDateRange as DateRange } from "@microboxlabs/miot-dashboard-ui/core";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common/pgrest-types";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import { ChartDashletView, useChartDashletData } from "../common/chart-dashlet";
import { buildEChartsOption } from "./build-chart-option";
import type { ColorPalette } from "./chart-palettes";
import type { ChartColorRulesConfig } from "./value-color-rules";

// ============================================================================
// Configuration Types
// ============================================================================

export type ChartType = "line" | "bar" | "pie" | "gauge" | "scatter";
export type XAxisDateFormat = "none" | "day" | "month" | "year";
export type { ChartDateRange as DateRange } from "@microboxlabs/miot-dashboard-ui/core";

export interface SeriesConfig {
  columnKey: string;
  label: string;
  color?: string;
}

export interface DashletConfig {
  title: string;
  chartType: ChartType;
  xAxisColumn: string;
  series: SeriesConfig[];
  xAxisLabel: string;
  yAxisLabel: string;
  showLegend: boolean;
  colorPalette: ColorPalette;
  customColors: string[];
  smooth: boolean;
  stacked: boolean;
  horizontal: boolean;
  showBarLabels: boolean;
  xAxisDateFormat?: XAxisDateFormat;
  defaultDateRange?: DateRange;
  valueColorRules?: ChartColorRulesConfig;
  tooltipTemplate?: string;
  // Data source
  dataMode: "static" | "pgrest" | "planner";
  rows: Record<string, string>[];
  pgrestFunctionName: string;
  pgrestParams: PgrestParam[];
  pgrestHttpMethod: PgrestHttpMethod;
  dataSourceId?: string;
  plannerVariableName?: string;
}

// ============================================================================
// Defaults
// ============================================================================

export const defaultConfig: DashletConfig = {
  title: "Chart",
  chartType: "bar",
  xAxisColumn: "month",
  series: [
    { columnKey: "sales", label: "Sales" },
    { columnKey: "returns", label: "Returns" },
  ],
  xAxisLabel: "",
  yAxisLabel: "",
  showLegend: true,
  colorPalette: "default",
  customColors: [],
  smooth: false,
  stacked: false,
  horizontal: false,
  showBarLabels: false,
  dataMode: "static",
  rows: [
    { month: "Jan", sales: "120", returns: "15" },
    { month: "Feb", sales: "200", returns: "25" },
    { month: "Mar", sales: "150", returns: "10" },
    { month: "Apr", sales: "300", returns: "40" },
    { month: "May", sales: "250", returns: "30" },
    { month: "Jun", sales: "400", returns: "20" },
  ],
  pgrestFunctionName: "",
  pgrestParams: [],
  pgrestHttpMethod: "POST",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 6,
  minH: 4,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component
// ============================================================================

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const data = useChartDashletData(
    widget.config,
    config,
    config.chartType === "line" &&
      !!config.xAxisDateFormat &&
      config.xAxisDateFormat !== "none"
  );
  const { templateContext } = data;
  const resolvedItems = useMemo(
    () =>
      config.series.map((item) => ({
        ...item,
        label: resolveHandlebarsField(item.label, templateContext),
      })),
    [config.series, templateContext]
  );
  const {
    resolvedXAxisLabel,
    resolvedYAxisLabel,
    effectiveDateFormat,
    filteredRows,
    darkMode,
    noDataLabel,
    containerWidth,
  } = data;
  const option = useMemo(
    () =>
      buildEChartsOption(
        {
          ...config,
          xAxisLabel: resolvedXAxisLabel,
          yAxisLabel: resolvedYAxisLabel,
          series: resolvedItems,
          xAxisDateFormat: effectiveDateFormat,
        },
        filteredRows,
        darkMode,
        noDataLabel,
        containerWidth
      ),
    [
      config,
      resolvedXAxisLabel,
      resolvedYAxisLabel,
      resolvedItems,
      effectiveDateFormat,
      filteredRows,
      darkMode,
      noDataLabel,
      containerWidth,
    ]
  );

  return (
    <ChartDashletView
      data={data}
      option={option}
      seriesLabels={resolvedItems.map((item) => item.label)}
    />
  );
}
