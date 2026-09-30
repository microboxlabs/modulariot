import type { EChartsOption } from "echarts";
import { createChartTooltipFormatter } from "../templates/chart-tooltip";
export const DARK_TEXT = "#9ca3af";
export const LIGHT_TEXT = "#6b7280";
export const DARK_AXIS_LINE = "#374151";
export const LIGHT_AXIS_LINE = "#d1d5db";
export const DARK_TOOLTIP_BG = "#374151";
export const LIGHT_TOOLTIP_BG = "#ffffff";
export const DARK_TOOLTIP_TEXT = "#f3f4f6";
export const LIGHT_TOOLTIP_TEXT = "#111827";
export const DARK_AXIS_NAME = "#e5e7eb";
export const LIGHT_AXIS_NAME = "#374151";

export function noDataOption(
  darkMode: boolean,
  label = "No data",
): EChartsOption {
  return {
    graphic: {
      type: "text",
      left: "center",
      top: "center",
      style: {
        text: label,
        fontSize: 14,
        fill: darkMode ? "#9ca3af" : "#6b7280",
      },
    },
  };
}

export function buildTooltip(
  config: { tooltipTemplate?: string },
  rows: Record<string, string>[],
  darkMode: boolean,
  defaultTrigger: "axis" | "item" = "item",
): NonNullable<EChartsOption["tooltip"]> {
  const base = {
    appendToBody: true,
    enterable: false,
    hideDelay: 0,
    triggerOn: "mousemove" as const,
    backgroundColor: darkMode ? DARK_TOOLTIP_BG : LIGHT_TOOLTIP_BG,
    borderWidth: 0,
    textStyle: { color: darkMode ? DARK_TOOLTIP_TEXT : LIGHT_TOOLTIP_TEXT },
  };

  if (!config.tooltipTemplate?.trim()) {
    return { trigger: defaultTrigger, ...base };
  }

  return {
    trigger: "item",
    ...base,
    renderMode: "richText",
    confine: true,
    formatter: createChartTooltipFormatter(config.tooltipTemplate, rows),
  };
}

/** Axis colors, category labels and base axes shared by the cartesian chart builders. */
export function cartesianAxisParts({
  rows,
  xAxisColumn,
  useTimeAxis,
  isHorizontalBar,
  darkMode,
  containerWidth,
  formatDateLabel,
}: {
  rows: Record<string, string>[];
  xAxisColumn: string;
  useTimeAxis: boolean;
  isHorizontalBar: boolean;
  darkMode: boolean;
  containerWidth: number;
  formatDateLabel: (value: string) => string;
}) {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const axisLineColor = darkMode ? DARK_AXIS_LINE : LIGHT_AXIS_LINE;
  const axisNameStyle = {
    color: darkMode ? DARK_AXIS_NAME : LIGHT_AXIS_NAME,
    fontWeight: "bold" as const,
    fontSize: 13,
  };

  const categoryData = useTimeAxis
    ? rows.map((r) => formatDateLabel(r[xAxisColumn] ?? ""))
    : rows.map((r) => r[xAxisColumn] ?? "");

  const labelRotate = (() => {
    if (isHorizontalBar || categoryData.length === 0 || containerWidth === 0)
      return 0;
    const maxLabelPx =
      categoryData.reduce(
        (max, label) => Math.max(max, String(label).length),
        0,
      ) * 7;
    return maxLabelPx > containerWidth / categoryData.length ? 30 : 0;
  })();

  const categoryAxis = {
    type: "category" as const,
    data: categoryData,
    axisLabel: isHorizontalBar
      ? { color: textColor, overflow: "truncate" as const, width: 120 }
      : {
          color: textColor,
          interval: 0,
          rotate: labelRotate,
          overflow: "truncate" as const,
          width: 120,
        },
    axisLine: { lineStyle: { color: axisLineColor } },
  };

  const valueAxis = {
    type: "value" as const,
    nameTextStyle: axisNameStyle,
    axisLabel: { color: textColor },
    axisLine: { lineStyle: { color: axisLineColor } },
    splitLine: { lineStyle: { color: axisLineColor } },
  };
  return {
    textColor,
    axisLineColor,
    axisNameStyle,
    categoryData,
    categoryAxis,
    valueAxis,
  };
}
