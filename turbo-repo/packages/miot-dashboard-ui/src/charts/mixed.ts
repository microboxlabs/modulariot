import { noDataOption, buildTooltip, cartesianAxisParts } from "./common";
import type { EChartsOption } from "echarts";
import {
  getChartColors as getColors,
  type ChartColorPalette as ColorPalette,
} from "../core/chart-palettes";
import {
  buildLegacyChartOption,
  type ChartOptionHost,
  type ChartXAxisDateFormat as XAxisDateFormat,
} from "./legacy";
export type ChartFamily = "cartesian" | "pie" | "gauge";
export interface ChartRepresentation {
  columnKey: string;
  label: string;
  type: "line" | "bar" | "scatter";
  color?: string;
  smooth?: boolean;
  stacked?: boolean;
  showLabels?: boolean;
  yAxisIndex?: 0 | 1;
}
type RepresentationConfig = ChartRepresentation;
export interface MixedChartOptions {
  chartFamily: ChartFamily;
  xAxisColumn: string;
  representations: RepresentationConfig[];
  xAxisLabel: string;
  yAxisLabel: string;
  yAxisLabelRight?: string;
  showLegend: boolean;
  colorPalette: ColorPalette;
  customColors: string[];
  horizontal: boolean;
  dualYAxis?: boolean;
  xAxisDateFormat?: XAxisDateFormat;
  tooltipTemplate?: string;
}

function buildCartesianOption(
  config: MixedChartOptions,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean,
  containerWidth: number,
  colorForValue: (value: number) => string | undefined,
  formatDateLabel: (value: string) => string = (value) => value,
): EChartsOption {
  const hasScatterRep = config.representations.some(
    (r) => r.type === "scatter",
  );
  const isHorizontalBar = config.horizontal && !hasScatterRep;
  const useTimeAxis =
    !!config.xAxisDateFormat && config.xAxisDateFormat !== "none";

  const { textColor, axisNameStyle, categoryData, categoryAxis, valueAxis } =
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

  if (isHorizontalBar) {
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
  } else if (config.dualYAxis) {
    xAxis = {
      ...categoryAxis,
      name: config.xAxisLabel || undefined,
      nameLocation: "center" as const,
      nameGap: 25,
      nameTextStyle: axisNameStyle,
    };
    yAxis = [
      {
        ...valueAxis,
        name: config.yAxisLabel || undefined,
      },
      {
        ...valueAxis,
        name: config.yAxisLabelRight || undefined,
        position: "right" as const,
        splitLine: { show: false },
      },
    ];
  } else {
    xAxis = {
      ...categoryAxis,
      name: config.xAxisLabel || undefined,
      nameLocation: "center" as const,
      nameGap: 25,
      nameTextStyle: axisNameStyle,
    };
    yAxis = {
      ...valueAxis,
      name: config.yAxisLabel || undefined,
    };
  }

  const legendHeight = config.showLegend ? 28 : 0;
  const xNameSpace = config.xAxisLabel ? 28 : 0;
  const gridBottom = Math.max(8, legendHeight + xNameSpace);

  const hasLeftYLabel = !!config.yAxisLabel;
  const hasRightYLabel = !!(config.dualYAxis && config.yAxisLabelRight);
  const gridTop = hasLeftYLabel || hasRightYLabel ? 36 : 16;

  const series = config.representations.map((rep, i) => {
    const paletteColor = colors[i % colors.length];
    const effectiveColor = config.customColors[i] ?? rep.color ?? paletteColor;

    if (rep.type === "scatter") {
      return {
        type: "scatter" as const,
        name: rep.label,
        yAxisIndex: config.dualYAxis ? (rep.yAxisIndex ?? 0) : undefined,
        data: rows.reduce<
          (number[] | { value: number[]; itemStyle: { color: string } })[]
        >((acc, r, rowIdx) => {
          const rawX = useTimeAxis
            ? formatDateLabel(r[config.xAxisColumn] ?? "")
            : (r[config.xAxisColumn] ?? "");
          const xIdx = categoryData.indexOf(rawX);
          const rawY = r[rep.columnKey];
          if (xIdx < 0 || rawY == null || rawY === "") return acc;
          const y = Number.parseFloat(String(rawY));
          if (!Number.isFinite(y)) return acc;
          const ruleColor = colorForValue(y);
          acc.push(
            ruleColor
              ? { value: [xIdx, y, rowIdx], itemStyle: { color: ruleColor } }
              : [xIdx, y, rowIdx],
          );
          return acc;
        }, []),
        ...(effectiveColor ? { itemStyle: { color: effectiveColor } } : {}),
      };
    }

    return {
      type: rep.type,
      name: rep.label,
      yAxisIndex: config.dualYAxis ? (rep.yAxisIndex ?? 0) : undefined,
      data: rows.map((r) => {
        const v = Number.parseFloat(r[rep.columnKey] ?? "");
        if (!Number.isFinite(v)) return null;
        const ruleColor = colorForValue(v);
        return ruleColor ? { value: v, itemStyle: { color: ruleColor } } : v;
      }),
      smooth: rep.type === "line" ? (rep.smooth ?? false) : undefined,
      stack: rep.stacked ? "total" : undefined,
      ...(rep.type === "bar" && rep.showLabels
        ? {
            label: {
              show: true,
              position: isHorizontalBar ? ("right" as const) : ("top" as const),
              color: "inherit" as const,
            },
          }
        : {}),
      ...(effectiveColor ? { itemStyle: { color: effectiveColor } } : {}),
    };
  });

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
      top: gridTop,
      bottom: gridBottom,
      containLabel: true,
    },
    xAxis,
    yAxis,
    series,
    dataZoom: [
      { type: "inside", xAxisIndex: 0, throttle: 0, filterMode: "none" },
      {
        type: "inside",
        yAxisIndex: config.dualYAxis ? [0, 1] : 0,
        throttle: 0,
        filterMode: "none",
      },
    ],
  };
}

export function buildMixedChartOption(
  config: MixedChartOptions,
  rows: Record<string, string>[],
  darkMode = false,
  noDataLabel?: string,
  containerWidth = 0,
  host: ChartOptionHost = {},
): EChartsOption {
  if (rows.length === 0) return noDataOption(darkMode, noDataLabel);
  if (config.chartFamily === "pie" || config.chartFamily === "gauge") {
    return buildLegacyChartOption(
      {
        ...config,
        chartType: config.chartFamily,
        series: config.representations,
        smooth: false,
        stacked: false,
      },
      rows,
      darkMode,
      noDataLabel,
      containerWidth,
      host,
    );
  }
  return buildCartesianOption(
    config,
    rows,
    getColors(config.colorPalette, config.customColors),
    darkMode,
    containerWidth,
    host.colorForValue ?? (() => undefined),
    host.formatDateLabel,
  );
}
