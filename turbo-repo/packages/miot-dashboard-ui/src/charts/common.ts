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
