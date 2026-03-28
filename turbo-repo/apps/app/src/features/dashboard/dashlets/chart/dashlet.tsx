"use client";

import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common/pgrest-types";
import { useDashletData, DashletLoading, DashletError } from "../common";
import { buildEChartsOption } from "./build-chart-option";
import type { ColorPalette } from "./chart-palettes";

// ============================================================================
// Configuration Types
// ============================================================================

export type ChartType = "line" | "bar" | "pie" | "gauge" | "scatter";

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
// Dark mode detection
// ============================================================================

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => {
    if (globalThis.window === undefined) return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver(() => {
      setDark(target.classList.contains("dark"));
    });
    observer.observe(target, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return dark;
}

// ============================================================================
// Component
// ============================================================================

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const chartRef = useRef<ReactECharts | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const darkMode = useDarkMode();

  // Fetch row data for pgrest/planner modes
  const { rows: fetchedRows, loading, fetchError } = useDashletData({
    dataMode: config.dataMode ?? "static",
    pgrestFunctionName: config.pgrestFunctionName ?? "",
    pgrestHttpMethod: config.pgrestHttpMethod ?? "POST",
    pgrestParams: config.pgrestParams ?? [],
    dataSourceId: config.dataSourceId,
    plannerVariableName: config.plannerVariableName,
  });

  const rows = config.dataMode === "static" ? (config.rows ?? []) : fetchedRows;

  const option = useMemo(
    () => buildEChartsOption(config, rows, darkMode),
    [config, rows, darkMode],
  );

  // Resize chart when container size changes (react-grid-layout doesn't trigger echarts auto-resize)
  const handleResize = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    instance?.resize();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(handleResize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleResize]);

  if (loading && config.dataMode !== "static") return <DashletLoading />;
  if (fetchError && config.dataMode !== "static")
    return <DashletError message={fetchError} />;

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      {config.title && (
        <div className="shrink-0 px-3 pt-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {config.title}
          </h3>
        </div>
      )}
      <div className="min-h-0 flex-1 p-1">
        <ReactECharts
          ref={chartRef}
          option={option}
          notMerge
          style={{ width: "100%", height: "100%" }}
          opts={{ renderer: "canvas" }}
        />
      </div>
    </div>
  );
}
