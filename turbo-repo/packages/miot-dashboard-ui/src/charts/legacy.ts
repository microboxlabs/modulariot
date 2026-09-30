import {
  DARK_TEXT,
  LIGHT_TEXT,
  noDataOption,
  buildTooltip,
  cartesianAxisParts,
} from "./common";
import type { EChartsOption } from "echarts";
import {
  getChartColors as getColors,
  type ChartColorPalette as ColorPalette,
} from "../core/chart-palettes";

export type ChartType = "line" | "bar" | "pie" | "gauge" | "scatter";
export type ChartXAxisDateFormat = "none" | "day" | "month" | "year";
export interface ChartSeries {
  columnKey: string;
  label: string;
  color?: string;
}
type SeriesConfig = ChartSeries;
export interface ChartOptionHost {
  /** Explicit host locale/time-zone formatting; defaults to the source label. */
  formatDateLabel?: (value: string) => string;
  /** Host rule evaluation; return a chart color or undefined for the palette. */
  colorForValue?: (value: number) => string | undefined;
}

export interface LegacyChartOptions {
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
  showBarLabels?: boolean;
  xAxisDateFormat?: ChartXAxisDateFormat;
  tooltipTemplate?: string;
}

function buildCartesianOption(
  config: LegacyChartOptions,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean,
  containerWidth: number,
  colorForValue: (value: number) => string | undefined,
  formatDateLabel: (value: string) => string = (value) => value,
): EChartsOption {
  const isHorizontalBar = config.chartType === "bar" && config.horizontal;
  const useTimeAxis =
    config.chartType === "line" &&
    !!config.xAxisDateFormat &&
    config.xAxisDateFormat !== "none";
  const { textColor, axisLineColor, axisNameStyle, categoryAxis, valueAxis } =
    cartesianAxisParts({
      rows,
      xAxisColumn: config.xAxisColumn,
      useTimeAxis,
      isHorizontalBar,
      darkMode,
      containerWidth,
      formatDateLabel,
    });

  let xAxis: EChartsOption["xAxis"];
  let yAxis: EChartsOption["yAxis"];

  if (config.chartType === "scatter") {
    xAxis = {
      type: "value" as const,
      name: config.xAxisLabel || undefined,
      nameLocation: "center" as const,
      nameGap: 25,
      nameTextStyle: axisNameStyle,
      axisLabel: { color: textColor },
      axisLine: { lineStyle: { color: axisLineColor } },
      splitLine: { lineStyle: { color: axisLineColor } },
    };
    yAxis = {
      ...valueAxis,
      name: config.yAxisLabel || undefined,
    };
  } else if (isHorizontalBar) {
    xAxis = {
      ...valueAxis,
      name: config.xAxisLabel || undefined,
      nameLocation: "center" as const,
      nameGap: 30,
    };
    yAxis = {
      ...categoryAxis,
      name: config.yAxisLabel || undefined,
      nameTextStyle: axisNameStyle,
      inverse: true,
    };
  } else {
    const baseXAxis = categoryAxis;
    xAxis = {
      ...baseXAxis,
      name: config.xAxisLabel || undefined,
      nameLocation: "center" as const,
      nameGap: 50,
      nameTextStyle: axisNameStyle,
    };
    yAxis = {
      ...valueAxis,
      name: config.yAxisLabel || undefined,
    };
  }

  const xLabelBottom = config.xAxisLabel ? 24 : 8;
  const gridBottom = config.showLegend ? 48 : xLabelBottom;

  return {
    color: colors,
    tooltip: buildTooltip(config, rows, darkMode, "axis"),
    legend: {
      show: config.showLegend,
      textStyle: { color: textColor },
      bottom: 0,
    },
    grid: {
      left: 8,
      right: 8,
      top: config.yAxisLabel ? 36 : 16,
      bottom: gridBottom,
      containLabel: true,
    },
    xAxis,
    yAxis,
    series: config.series.map((s) => ({
      type: config.chartType as "line" | "bar" | "scatter",
      name: s.label,
      data:
        config.chartType === "scatter"
          ? rows.reduce<
              (number[] | { value: number[]; itemStyle: { color: string } })[]
            >((acc, r, i) => {
              const rawX = r[config.xAxisColumn];
              const rawY = r[s.columnKey];
              if (rawX == null || rawX === "" || rawY == null || rawY === "")
                return acc;
              const x = Number.parseFloat(String(rawX));
              const y = Number.parseFloat(String(rawY));
              if (!Number.isFinite(x) || !Number.isFinite(y)) return acc;
              const color = colorForValue(y);
              acc.push(
                color ? { value: [x, y, i], itemStyle: { color } } : [x, y, i],
              );
              return acc;
            }, [])
          : rows.map((r) => {
              const v = Number.parseFloat(r[s.columnKey] ?? "");
              if (!Number.isFinite(v)) return null;
              const color = colorForValue(v);
              return color ? { value: v, itemStyle: { color } } : v;
            }),
      smooth: config.chartType === "line" ? config.smooth : undefined,
      stack:
        config.stacked && config.chartType !== "scatter" ? "total" : undefined,
      ...(config.chartType === "bar" && config.showBarLabels
        ? {
            label: {
              show: true,
              position: isHorizontalBar ? ("right" as const) : ("top" as const),
              color: "inherit" as const,
            },
          }
        : {}),
      ...(s.color ? { itemStyle: { color: s.color } } : {}),
    })),
    dataZoom: [
      { type: "inside", xAxisIndex: 0, throttle: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, throttle: 0, filterMode: "none" },
    ],
  };
}

function buildPieOption(
  config: LegacyChartOptions,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean,
  colorForValue: (value: number) => string | undefined,
  noDataLabel?: string,
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const valueSeries = config.series[0];
  if (!valueSeries) return noDataOption(darkMode, noDataLabel);

  const data = rows.reduce<
    {
      name: string;
      value: number;
      rowIndex: number;
      itemStyle?: { color: string };
    }[]
  >((acc, r, rowIndex) => {
    const v = Number.parseFloat(r[valueSeries.columnKey] ?? "");
    if (Number.isFinite(v)) {
      const color = colorForValue(v);
      acc.push({
        name: r[config.xAxisColumn] ?? "",
        value: v,
        rowIndex,
        ...(color ? { itemStyle: { color } } : {}),
      });
    }
    return acc;
  }, []);
  if (data.length === 0) return noDataOption(darkMode, noDataLabel);

  return {
    color: colors,
    tooltip: buildTooltip(config, rows, darkMode),
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
  config: LegacyChartOptions,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean,
  colorForValue: (value: number) => string | undefined,
  noDataLabel?: string,
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const valueSeries = config.series[0];
  if (!valueSeries) return noDataOption(darkMode, noDataLabel);

  const raw = Number.parseFloat(rows[0]?.[valueSeries.columnKey] ?? "");
  if (!Number.isFinite(raw)) return noDataOption(darkMode, noDataLabel);
  const value = raw;
  const gaugeColor = colorForValue(value);

  return {
    color: colors,
    tooltip: buildTooltip(config, rows, darkMode),
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
        ...(gaugeColor ? { itemStyle: { color: gaugeColor } } : {}),
      },
    ],
  };
}

export function buildLegacyChartOption(
  config: LegacyChartOptions,
  rows: Record<string, string>[],
  darkMode = false,
  noDataLabel?: string,
  containerWidth = 0,
  host: ChartOptionHost = {},
): EChartsOption {
  if (rows.length === 0) return noDataOption(darkMode, noDataLabel);

  const colors = getColors(config.colorPalette, config.customColors);
  const colorForValue = host.colorForValue ?? (() => undefined);

  switch (config.chartType) {
    case "pie":
      return buildPieOption(
        config,
        rows,
        colors,
        darkMode,
        colorForValue,
        noDataLabel,
      );
    case "gauge":
      return buildGaugeOption(
        config,
        rows,
        colors,
        darkMode,
        colorForValue,
        noDataLabel,
      );
    default:
      // line, bar, scatter and unknown types
      return buildCartesianOption(
        config,
        rows,
        colors,
        darkMode,
        containerWidth,
        colorForValue,
        host.formatDateLabel,
      );
  }
}
