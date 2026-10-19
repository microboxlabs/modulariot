"use client";

import { useMemo } from "react";
import type { ChartDateRange as DateRange } from "@microboxlabs/miot-dashboard-ui/core";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common/pgrest-types";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import { ChartDashletView, useChartDashletData } from "../common/chart-dashlet";
import { buildEChartsOption } from "./build-chart-option";
import type { ColorPalette } from "../chart/chart-palettes";
import type { ChartColorRulesConfig } from "../chart/value-color-rules";

// ============================================================================
// Configuration Types
// ============================================================================

export type ChartFamily = "cartesian" | "pie" | "gauge";
export type RepresentationType = "line" | "bar" | "scatter";
export type XAxisDateFormat = "none" | "day" | "month" | "year";
export type { ChartDateRange as DateRange } from "@microboxlabs/miot-dashboard-ui/core";

export interface RepresentationConfig {
  columnKey: string;
  label: string;
  type: RepresentationType;
  color?: string;
  smooth?: boolean;
  stacked?: boolean;
  showLabels?: boolean;
  yAxisIndex?: 0 | 1;
}

export interface DashletConfig {
  title: string;
  chartFamily: ChartFamily;
  xAxisColumn: string;
  representations: RepresentationConfig[];
  xAxisLabel: string;
  yAxisLabel: string;
  yAxisLabelRight?: string;
  showLegend: boolean;
  horizontal: boolean;
  dualYAxis?: boolean;
  colorPalette: ColorPalette;
  customColors: string[];
  xAxisDateFormat?: XAxisDateFormat;
  defaultDateRange?: DateRange;
  valueColorRules?: ChartColorRulesConfig;
  tooltipTemplate?: string;
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
  title: "Chart v2",
  chartFamily: "cartesian",
  xAxisColumn: "month",
  representations: [
    { columnKey: "sales", label: "Sales", type: "bar" },
    { columnKey: "returns", label: "Returns", type: "line", smooth: true },
  ],
  xAxisLabel: "",
  yAxisLabel: "",
  showLegend: true,
  horizontal: false,
  colorPalette: "default",
  customColors: [],
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
    config.chartFamily === "cartesian" &&
      !!config.xAxisDateFormat &&
      config.xAxisDateFormat !== "none"
  );
  const { templateContext } = data;
  const resolvedItems = useMemo(
    () =>
      (config.representations ?? []).map((item) => ({
        ...item,
        label: resolveHandlebarsField(item.label, templateContext),
      })),
    [config.representations, templateContext]
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
          representations: resolvedItems,
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
