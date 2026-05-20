"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type EChartsReactCore from "echarts-for-react/lib/core";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { type PgrestDashletFields } from "../common/use-dashlet-pgrest";
import { useDashletPgrest } from "../common/use-dashlet-pgrest";
import { DashletLoading, DashletError } from "../common/dashlet-states";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import type { ThresholdConfig } from "../common/threshold-types";

// ============================================================================
// Configuration Types
// ============================================================================

/** Hex color without # prefix */
// export type BarColor = string;

export type ChartType = "bar" | "donut";

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  items: { label: string; value: string; color: string }[];
  unit: string;
  showHeader: boolean;
  chartType?: ChartType;
  thresholds?: ThresholdConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Traffic Sources",
  items: [
    { label: "Direct", value: "45", color: "3b82f6" },
    { label: "Organic", value: "30", color: "22c55e" },
    { label: "Referral", value: "15", color: "eab308" },
    { label: "Social", value: "10", color: "a855f7" },
  ],
  unit: "%",
  showHeader: true,
  chartType: "bar",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Traffic Sources",
  unit: "%",
};

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
// ECharts Tooltip and Event Helpers
// ============================================================================

interface TooltipBaseConfig {
  trigger: "item";
  appendToBody: true;
  enterable: false;
  hideDelay: 0;
  triggerOn: "mousemove";
  backgroundColor: string;
  borderWidth: 0;
  textStyle: { color: string };
}

function buildTooltipConfig(darkMode: boolean): TooltipBaseConfig {
  return {
    trigger: "item",
    appendToBody: true,
    enterable: false,
    hideDelay: 0,
    triggerOn: "mousemove",
    backgroundColor: darkMode ? "#374151" : "#ffffff",
    borderWidth: 0,
    textStyle: {
      color: darkMode ? "#f3f4f6" : "#111827",
    },
  };
}

function useEChartsGlobalOut() {
  const chartRef = useRef<EChartsReactCore>(null);

  const handleGlobalOut = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (instance) {
      instance.dispatchAction({ type: "hideTip" });
      instance.dispatchAction({ type: "downplay" });
    }
  }, []);

  // appendToBody:true pins the tooltip to a fixed body position — scrolling
  // doesn't move the mouse relative to the chart so globalout never fires.
  // Capture-phase scroll catches any scrollable ancestor, not just window.
  useEffect(() => {
    window.addEventListener("scroll", handleGlobalOut, true);
    return () => window.removeEventListener("scroll", handleGlobalOut, true);
  }, [handleGlobalOut]);

  return { chartRef, handleGlobalOut };
}

// ============================================================================
// Donut Chart Component (ECharts)
// ============================================================================

interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

function DonutChart({
  items,
  unit,
  darkMode,
}: Readonly<{ items: ChartSegment[]; unit: string; darkMode: boolean }>) {
  const { chartRef, handleGlobalOut } = useEChartsGlobalOut();

  const option: EChartsOption = useMemo(
    () => ({
      tooltip: {
        ...buildTooltipConfig(darkMode),
        formatter: (params: unknown) => {
          const p = params as {
            name?: string;
            value?: number;
            percent?: number;
            color?: string;
          };
          const showPercent = unit !== "%";
          const percent = showPercent ? ` (${p.percent}%)` : "";
          return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px;"></span>${p.name}: ${p.value}${unit}${percent}`;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["50%", "80%"],
          avoidLabelOverlap: false,
          padAngle: 2,
          itemStyle: {
            borderRadius: 0,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: false,
            },
            scale: true,
            scaleSize: 5,
          },
          labelLine: {
            show: false,
          },
          data: items.map((item) => ({
            value: item.value,
            name: item.label,
            itemStyle: { color: `#${item.color}` },
          })),
        },
      ],
    }),
    [items, unit, darkMode]
  );

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ width: "100%", height: "100%" }}
      opts={{ renderer: "svg" }}
      onEvents={{ globalout: handleGlobalOut }}
    />
  );
}

// ============================================================================
// Stacked Bar Chart Component (ECharts)
// ============================================================================

function StackedBarChart({
  items,
  unit,
  total,
  darkMode,
}: Readonly<{
  items: ChartSegment[];
  unit: string;
  total: number;
  darkMode: boolean;
}>) {
  const { chartRef, handleGlobalOut } = useEChartsGlobalOut();

  const option: EChartsOption = useMemo(
    () => ({
      tooltip: {
        ...buildTooltipConfig(darkMode),
        formatter: (params: unknown) => {
          const p = params as {
            seriesName?: string;
            value?: number;
            color?: string;
          };
          const showPercent = unit !== "%";
          const percent =
            showPercent && total > 0
              ? ` (${(((p.value ?? 0) / total) * 100).toFixed(1)}%)`
              : "";
          return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px;"></span>${p.seriesName}: ${p.value}${unit}${percent}`;
        },
      },
      grid: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        containLabel: false,
      },
      xAxis: {
        type: "value",
        max: total,
        show: false,
      },
      yAxis: {
        type: "category",
        show: false,
        data: [""],
      },
      series: items.map((item) => ({
        name: item.label,
        type: "bar",
        stack: "total",
        barWidth: "100%",
        emphasis: {
          focus: "series",
        },
        itemStyle: {
          color: `#${item.color}`,
          borderRadius: 0,
        },
        data: [item.value],
      })),
    }),
    [items, unit, total, darkMode]
  );

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ width: "100%", height: "100%" }}
      opts={{ renderer: "svg" }}
      onEvents={{ globalout: handleGlobalOut }}
    />
  );
}

// ============================================================================
// Component - Style 8: Stacked Bars
// ============================================================================

/**
 * Stacked Bars Card - Multiple items with horizontal bars or donut chart
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const darkMode = useDarkMode();
  const config = widget.config as unknown as DashletConfig;
  const { items, showHeader = true, chartType = "bar" } = config;
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError, firstRow } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  /*
    const { color: thresholdColor, appliesTo } = useRowThreshold(
      config.thresholds,
      firstRow
    );
  */

  // Resolve Handlebars templates in item labels and values (only in remote modes)
  const isStatic = !config.dataMode || config.dataMode === "static";
  const resolvedItems = useMemo(() => {
    if (isStatic || !firstRow) {
      return items.map((item) => ({
        label: item.label,
        value: Number(item.value) || 0,
        color: (item.color ?? "").replace(/^#/, ""),
      }));
    }
    const context = { ...firstRow, row: firstRow };
    return items.map((item) => ({
      label: resolveHandlebarsField(item.label, context),
      value: Number(resolveHandlebarsField(String(item.value), context)) || 0,
      color: (item.color ?? "").replace(/^#/, ""),
    }));
  }, [items, firstRow, isStatic]);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Traffic Sources";
  const unit = resolved.unit ?? "%";
  const total = resolvedItems.reduce((sum, item) => sum + item.value, 0);

  return (
    <div
      className={`flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 gap-3 ${showHeader ? "" : "justify-center"}`}
      style={{ containerType: "inline-size" }}
    >
      {/* Header */}
      {showHeader && (
        <div className={chartType === "donut" ? "" : "mb-auto"}>
          <p className="font-bold text-gray-900 dark:text-white leading-tight">
            {title}
          </p>
        </div>
      )}

      {chartType === "donut" ? (
        /* Donut chart */
        <div className="flex flex-1 items-center justify-center min-h-0">
          <DonutChart items={resolvedItems} unit={unit} darkMode={darkMode} />
        </div>
      ) : (
        /* Stacked bar chart */
        <div
          className={`flex-1 overflow-hidden rounded-lg ${showHeader ? "mt-auto" : ""}`}
          style={{ minHeight: "0.5rem" }}
        >
          <StackedBarChart
            items={resolvedItems}
            unit={unit}
            total={total}
            darkMode={darkMode}
          />
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {resolvedItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <div
              className="rounded-full shrink-0 h-3 w-3"
              style={{
                backgroundColor: `#${item.color}`,
              }}
            />
            <span className="text-gray-600 dark:text-gray-400 text-xs">
              {item.label}
            </span>
            <span className="font-medium text-gray-900 dark:text-white text-xs">
              {item.value}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
