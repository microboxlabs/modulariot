"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import {
  filterChartRowsByDateRange,
  type ChartDateRange,
} from "@microboxlabs/miot-dashboard-ui/core";
import {
  ChartCard,
  ChartEngineView,
} from "@microboxlabs/miot-dashboard-ui/react";
import { createDashboardChartEngine } from "./chart-engine";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { useDashletData } from "./use-dashlet-data";
import { DashletLoading, DashletError } from "./dashlet-states";
import { resolveHandlebarsField } from "./use-handlebars-templates";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { useOptionalDashboard } from "../../context/dashboard-context";
import { useDashboardFilters } from "../../context/dashboard-filters-context";
import { tr, trDynamic } from "@/features/i18n/tr.service";

type XAxisDateFormat = "none" | "day" | "month" | "year";

/** Data-source and label fields shared by the chart dashlets. */
export interface ChartDashletSourceConfig {
  title?: string;
  xAxisColumn: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisDateFormat?: XAxisDateFormat;
  defaultDateRange?: ChartDateRange;
  dataMode: "static" | "pgrest" | "planner";
  rows?: Record<string, string>[];
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  dataSourceId?: string;
  plannerVariableName?: string;
}

// ============================================================================
// Date range filter
// ============================================================================

const DATE_RANGE_OPTIONS: { value: ChartDateRange; labelKey: string }[] = [
  { value: "all", labelKey: "dashboard.dashlets.chart.rangeAll" },
  { value: "7d", labelKey: "dashboard.dashlets.chart.range7d" },
  { value: "30d", labelKey: "dashboard.dashlets.chart.range30d" },
  { value: "90d", labelKey: "dashboard.dashlets.chart.range90d" },
  { value: "180d", labelKey: "dashboard.dashlets.chart.range180d" },
  { value: "1y", labelKey: "dashboard.dashlets.chart.range1y" },
];

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
// Shared data and frame
// ============================================================================

/** Loads rows, applies the date range and resolves the shared label templates. */
export function useChartDashletData(
  widgetConfig: Record<string, unknown>,
  config: ChartDashletSourceConfig,
  isDateAxis: boolean
) {
  const { dictionary } = useOptionalDashboard();
  const darkMode = useDarkMode();
  const isStatic = config.dataMode === "static";

  const refreshIntervalMs = useEffectiveRefreshInterval(widgetConfig);
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
  const rows = useMemo(
    () => (isStatic ? (config.rows ?? []) : fetchedRows),
    [isStatic, config.rows, fetchedRows]
  );

  const [activeDateRange, setActiveDateRange] = useState<ChartDateRange>(
    config.defaultDateRange ?? "all"
  );
  const filteredRows = useMemo(
    () =>
      isDateAxis
        ? filterChartRowsByDateRange(rows, config.xAxisColumn, activeDateRange)
        : rows,
    [rows, isDateAxis, config.xAxisColumn, activeDateRange]
  );
  let effectiveDateFormat: XAxisDateFormat = "none";
  if (isDateAxis) effectiveDateFormat = config.xAxisDateFormat ?? "day";

  // Template context: first row plus active filters.
  const { activeFilters } = useDashboardFilters();
  const templateContext = useMemo((): Record<string, unknown> => {
    if (rows.length > 0) {
      const firstRow = rows[0];
      return { ...firstRow, row: firstRow, filter: activeFilters };
    }
    return { filter: activeFilters };
  }, [rows, activeFilters]);
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

  // react-grid-layout does not trigger ECharts auto-resize.
  const [containerWidth, setContainerWidth] = useState(0);
  const handleResize = useCallback((width: number) => {
    setContainerWidth(width);
  }, []);

  return {
    dictionary,
    darkMode,
    loading: loading && !isStatic,
    fetchError: isStatic ? null : fetchError,
    filteredRows,
    isDateAxis,
    activeDateRange,
    setActiveDateRange,
    effectiveDateFormat,
    templateContext,
    resolvedTitle,
    resolvedXAxisLabel,
    resolvedYAxisLabel,
    containerWidth,
    handleResize,
    noDataLabel: tr("dashboard.dashlets.chart.noData", dictionary),
  };
}

/** Loading, error, date-range toolbar and chart frame shared by the chart dashlets. */
export function ChartDashletView({
  data,
  option,
  seriesLabels,
}: Readonly<{
  data: ReturnType<typeof useChartDashletData>;
  option: EChartsOption;
  seriesLabels: string[];
}>) {
  if (data.loading) return <DashletLoading />;
  if (data.fetchError) return <DashletError message={data.fetchError} />;
  return (
    <ChartCard
      title={data.resolvedTitle}
      onResize={data.handleResize}
      toolbar={
        data.isDateAxis && (
          <div className="shrink-0 flex justify-end gap-1 py-1">
            {DATE_RANGE_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => data.setActiveDateRange(r.value)}
                className={`px-2 py-0.5 text-xs rounded font-medium transition-colors cursor-pointer ${
                  data.activeDateRange === r.value
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                }`}
              >
                {trDynamic(r.labelKey, data.dictionary)}
              </button>
            ))}
          </div>
        )
      }
    >
      <ChartEngineView
        createEngine={createDashboardChartEngine}
        option={option}
        ariaLabel={
          data.resolvedTitle || seriesLabels.join(", ") || data.noDataLabel
        }
      />
    </ChartCard>
  );
}
