"use client";

import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common/pgrest-types";
import { useDashletData } from "../common/use-dashlet-data";
import { DashletLoading, DashletError } from "../common/dashlet-states";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { buildEChartsOption } from "./build-chart-option";
import { useDashboard } from "../../context/dashboard-context";
import { useDashboardFilters } from "../../context/dashboard-filters-context";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { ColorPalette } from "./chart-palettes";
import type { ChartColorRulesConfig } from "./value-color-rules";

// ============================================================================
// Configuration Types
// ============================================================================

export type ChartType = "line" | "bar" | "pie" | "gauge" | "scatter";
export type XAxisDateFormat = "none" | "day" | "month" | "year";
export type DateRange = "all" | "7d" | "30d" | "90d" | "180d" | "1y";

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
// Date range filter
// ============================================================================

const DATE_RANGE_OPTIONS: { value: DateRange; labelKey: string }[] = [
  { value: "all", labelKey: "dashboard.dashlets.chart.rangeAll" },
  { value: "7d", labelKey: "dashboard.dashlets.chart.range7d" },
  { value: "30d", labelKey: "dashboard.dashlets.chart.range30d" },
  { value: "90d", labelKey: "dashboard.dashlets.chart.range90d" },
  { value: "180d", labelKey: "dashboard.dashlets.chart.range180d" },
  { value: "1y", labelKey: "dashboard.dashlets.chart.range1y" },
];

const DATE_RANGE_DAYS: Partial<Record<DateRange, number>> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "1y": 365,
};

function filterRowsByDateRange(
  rows: Record<string, string>[],
  xAxisColumn: string,
  range: DateRange
): Record<string, string>[] {
  const days = DATE_RANGE_DAYS[range];
  if (!days) return rows;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return rows.filter((r) => {
    const v = r[xAxisColumn];
    if (!v) return false;
    const ts = new Date(v).getTime();
    return !Number.isNaN(ts) && ts >= cutoff;
  });
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
  const { dictionary } = useDashboard();
  const chartRef = useRef<ReactECharts | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const darkMode = useDarkMode();

  // Force-hide tooltip when mouse leaves chart area
  const handleGlobalOut = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (instance) {
      instance.dispatchAction({ type: "hideTip" });
      instance.dispatchAction({ type: "downplay" });
    }
  }, []);

  // Fetch row data for pgrest/planner modes
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);
  const {
    rows: fetchedRows,
    loading,
    fetchError,
  } = useDashletData({
    dataMode: config.dataMode ?? "static",
    pgrestFunctionName: config.pgrestFunctionName ?? "",
    pgrestHttpMethod: config.pgrestHttpMethod ?? "POST",
    pgrestParams: config.pgrestParams ?? [],
    dataSourceId: config.dataSourceId,
    plannerVariableName: config.plannerVariableName,
    refreshIntervalMs,
  });

  const rows = config.dataMode === "static" ? (config.rows ?? []) : fetchedRows;

  const isDateAxis =
    config.chartType === "line" &&
    !!config.xAxisDateFormat &&
    config.xAxisDateFormat !== "none";
  const [activeDateRange, setActiveDateRange] = useState<DateRange>(
    config.defaultDateRange ?? "all"
  );
  const filteredRows = useMemo(
    () =>
      isDateAxis
        ? filterRowsByDateRange(rows, config.xAxisColumn, activeDateRange)
        : rows,
    [rows, isDateAxis, config.xAxisColumn, activeDateRange]
  );
  const effectiveDateFormat = useMemo((): XAxisDateFormat => {
    if (!isDateAxis) return "none";
    return config.xAxisDateFormat ?? "day";
  }, [isDateAxis, config.xAxisDateFormat]);

  // Build template context from first row + active filters (Pattern B)
  const { activeFilters } = useDashboardFilters();
  const templateContext = useMemo(() => {
    if (rows.length > 0) {
      const firstRow = rows[0];
      return { ...firstRow, row: firstRow, filter: activeFilters };
    }
    return { filter: activeFilters } as Record<string, unknown>;
  }, [rows, activeFilters]);

  // Resolve Handlebars templates in scalar fields
  const resolvedTitle = useMemo(
    () => resolveHandlebarsField(config.title ?? "", templateContext),
    [config.title, templateContext]
  );
  const resolvedXAxisLabel = useMemo(
    () => resolveHandlebarsField(config.xAxisLabel ?? "", templateContext),
    [config.xAxisLabel, templateContext]
  );
  const resolvedYAxisLabel = useMemo(
    () => resolveHandlebarsField(config.yAxisLabel ?? "", templateContext),
    [config.yAxisLabel, templateContext]
  );
  const resolvedSeries = useMemo(
    () =>
      config.series.map((s) => ({
        ...s,
        label: resolveHandlebarsField(s.label, templateContext),
      })),
    [config.series, templateContext]
  );

  const resolvedConfig = useMemo(
    () => ({
      ...config,
      xAxisLabel: resolvedXAxisLabel,
      yAxisLabel: resolvedYAxisLabel,
      series: resolvedSeries,
      xAxisDateFormat: effectiveDateFormat,
    }),
    [
      config,
      resolvedXAxisLabel,
      resolvedYAxisLabel,
      resolvedSeries,
      effectiveDateFormat,
    ]
  );

  const [containerWidth, setContainerWidth] = useState(0);

  const noDataLabel = tr("dashboard.dashlets.chart.noData", dictionary);
  const option = useMemo(
    () =>
      buildEChartsOption(
        resolvedConfig,
        filteredRows,
        darkMode,
        noDataLabel,
        containerWidth
      ),
    [resolvedConfig, filteredRows, darkMode, noDataLabel, containerWidth]
  );

  // Resize chart when container size changes (react-grid-layout doesn't trigger echarts auto-resize)
  const handleResize = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    instance?.resize();
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }
  }, []);

  // Callback ref so the ResizeObserver attaches whenever the container mounts
  // (e.g. after DashletLoading -> ready transitions)
  const observerRef = useRef<ResizeObserver | null>(null);
  const attachContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      // Disconnect previous observer if any
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      containerRef.current = el;
      if (el) {
        setContainerWidth(el.clientWidth);
        const observer = new ResizeObserver(handleResize);
        observer.observe(el);
        observerRef.current = observer;
      }
    },
    [handleResize]
  );

  if (loading && config.dataMode !== "static") return <DashletLoading />;
  if (fetchError && config.dataMode !== "static")
    return <DashletError message={fetchError} />;

  return (
    <div
      ref={attachContainerRef}
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      {resolvedTitle && (
        <div className="shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {resolvedTitle}
          </h3>
        </div>
      )}
      {isDateAxis && (
        <div className="shrink-0 flex justify-end gap-1 py-1">
          {DATE_RANGE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setActiveDateRange(r.value)}
              className={`px-2 py-0.5 text-xs rounded font-medium transition-colors cursor-pointer ${
                activeDateRange === r.value
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              }`}
            >
              {trDynamic(r.labelKey, dictionary)}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ReactECharts
          ref={chartRef}
          option={option}
          notMerge
          style={{ width: "100%", height: "100%" }}
          opts={{ renderer: "canvas" }}
          onEvents={{ globalout: handleGlobalOut }}
        />
      </div>
    </div>
  );
}
