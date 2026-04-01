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

const DARK_TEXT = "#d1d5db";
const LIGHT_TEXT = "#374151";
const DARK_AXIS_LINE = "#4b5563";
const LIGHT_AXIS_LINE = "#e5e7eb";

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
  darkMode: boolean,
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const axisLineColor = darkMode ? DARK_AXIS_LINE : LIGHT_AXIS_LINE;

  return {
    color: colors,
    tooltip: { trigger: "axis" },
    legend: {
      show: config.showLegend,
      textStyle: { color: textColor },
    },
    grid: { left: 48, right: 16, top: 40, bottom: 32, containLabel: true },
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
  darkMode: boolean,
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
    tooltip: { trigger: "item" },
    legend: {
      show: config.showLegend,
      textStyle: { color: textColor },
    },
    series: [
      {
        type: "pie",
        radius: ["30%", "65%"],
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
  darkMode: boolean,
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const valueSeries = config.series[0];
  if (!valueSeries) return noDataOption(darkMode);

  const raw = Number.parseFloat(rows[0]?.[valueSeries.columnKey] ?? "");
  if (!Number.isFinite(raw)) return noDataOption(darkMode);
  const value = raw;

  return {
    color: colors,
    series: [
      {
        type: "gauge",
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
  noDataLabel?: string,
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
