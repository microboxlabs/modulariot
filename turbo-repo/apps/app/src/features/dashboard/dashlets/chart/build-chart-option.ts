import type { EChartsOption } from "echarts";
import type { ChartType, SeriesConfig } from "./dashlet";
import { getColors, type ColorPalette } from "./chart-palettes";

interface ChartOptionInput {
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
}

const DARK_TEXT = "#9ca3af";
const LIGHT_TEXT = "#6b7280";
const DARK_AXIS_LINE = "#374151";
const LIGHT_AXIS_LINE = "#d1d5db";
const DARK_TOOLTIP_BG = "#374151";
const LIGHT_TOOLTIP_BG = "#ffffff";
const DARK_TOOLTIP_TEXT = "#f3f4f6";
const LIGHT_TOOLTIP_TEXT = "#111827";

function noDataOption(darkMode: boolean, label = "No data"): EChartsOption {
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

function buildCartesianOption(
  config: ChartOptionInput,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const axisLineColor = darkMode ? DARK_AXIS_LINE : LIGHT_AXIS_LINE;

  return {
    color: colors,
    tooltip: {
      trigger: "axis",
      appendToBody: true,
      enterable: false,
      hideDelay: 0,
      triggerOn: "mousemove",
      backgroundColor: darkMode ? DARK_TOOLTIP_BG : LIGHT_TOOLTIP_BG,
      borderWidth: 0,
      textStyle: { color: darkMode ? DARK_TOOLTIP_TEXT : LIGHT_TOOLTIP_TEXT },
    },
    legend: {
      show: config.showLegend,
      textStyle: { color: textColor },
      bottom: 0,
    },
    grid: {
      left: 8,
      right: 8,
      top: 24,
      bottom: config.showLegend ? 32 : 8,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: rows.map((r) => r[config.xAxisColumn] ?? ""),
      name: config.xAxisLabel || undefined,
      nameTextStyle: { color: textColor },
      axisLabel: { color: textColor },
      axisLine: { lineStyle: { color: axisLineColor } },
    },
    yAxis: {
      type: "value",
      name: config.yAxisLabel || undefined,
      nameTextStyle: { color: textColor },
      axisLabel: { color: textColor },
      axisLine: { lineStyle: { color: axisLineColor } },
      splitLine: { lineStyle: { color: axisLineColor } },
    },
    series: config.series.map((s) => ({
      type: config.chartType as "line" | "bar" | "scatter",
      name: s.label,
      data: rows.map((r) => {
        const v = Number.parseFloat(r[s.columnKey]);
        return Number.isFinite(v) ? v : null;
      }),
      smooth: config.chartType === "line" ? config.smooth : undefined,
      stack:
        config.stacked && config.chartType !== "scatter" ? "total" : undefined,
      ...(s.color ? { itemStyle: { color: s.color } } : {}),
    })),
  };
}

function buildPieOption(
  config: ChartOptionInput,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const valueSeries = config.series[0];
  if (!valueSeries) return noDataOption(darkMode);

  const data = rows.reduce<{ name: string; value: number }[]>((acc, r) => {
    const v = Number.parseFloat(r[valueSeries.columnKey]);
    if (Number.isFinite(v)) {
      acc.push({ name: r[config.xAxisColumn] ?? "", value: v });
    }
    return acc;
  }, []);
  if (data.length === 0) return noDataOption(darkMode);

  return {
    color: colors,
    tooltip: {
      trigger: "item",
      appendToBody: true,
      enterable: false,
      hideDelay: 0,
      triggerOn: "mousemove",
      backgroundColor: darkMode ? DARK_TOOLTIP_BG : LIGHT_TOOLTIP_BG,
      borderWidth: 0,
      textStyle: { color: darkMode ? DARK_TOOLTIP_TEXT : LIGHT_TOOLTIP_TEXT },
    },
    legend: {
      show: config.showLegend,
      textStyle: { color: textColor },
      bottom: 0,
    },
    series: [
      {
        type: "pie",
        radius: ["30%", "65%"],
        center: ["50%", config.showLegend ? "45%" : "50%"],
        data,
        label: { color: textColor },
      },
    ],
  };
}

function buildGaugeOption(
  config: ChartOptionInput,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const valueSeries = config.series[0];
  if (!valueSeries) return noDataOption(darkMode);

  const raw = Number.parseFloat(rows[0]?.[valueSeries.columnKey] ?? "");
  if (!Number.isFinite(raw)) return noDataOption(darkMode);
  const value = raw;

  return {
    color: colors,
    tooltip: {
      trigger: "item",
      appendToBody: true,
      enterable: false,
      hideDelay: 0,
      triggerOn: "mousemove",
      backgroundColor: darkMode ? DARK_TOOLTIP_BG : LIGHT_TOOLTIP_BG,
      borderWidth: 0,
      textStyle: { color: darkMode ? DARK_TOOLTIP_TEXT : LIGHT_TOOLTIP_TEXT },
    },
    series: [
      {
        type: "gauge",
        radius: "100%",
        data: [{ value, name: valueSeries.label }],
        detail: {
          formatter: "{value}",
          color: textColor,
        },
        title: { color: textColor },
        axisLabel: { color: textColor },
      },
    ],
  };
}

export function buildEChartsOption(
  config: ChartOptionInput,
  rows: Record<string, string>[],
  darkMode = false,
  noDataLabel?: string
): EChartsOption {
  if (rows.length === 0) return noDataOption(darkMode, noDataLabel);

  const colors = getColors(config.colorPalette, config.customColors);

  switch (config.chartType) {
    case "line":
    case "bar":
    case "scatter":
      return buildCartesianOption(config, rows, colors, darkMode);
    case "pie":
      return buildPieOption(config, rows, colors, darkMode);
    case "gauge":
      return buildGaugeOption(config, rows, colors, darkMode);
    default:
      return buildCartesianOption(config, rows, colors, darkMode);
  }
}
