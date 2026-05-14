import type { EChartsOption } from "echarts";
import type { ChartType, SeriesConfig, XAxisDateFormat } from "./dashlet";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import { getColors, type ColorPalette } from "./chart-palettes";
import type { ChartColorRule, ChartColorRulesConfig } from "./value-color-rules";
import { normalizeChartColorRulesConfig } from "./value-color-rules";
import { evaluateColorRulesGeneric } from "../common/color-rule-evaluation";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";

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
  horizontal: boolean;
  showBarLabels?: boolean;
  xAxisDateFormat?: XAxisDateFormat;
  valueColorRules?: ChartColorRulesConfig;
  tooltipTemplate?: string;
}

function formatDateLabel(val: string): string {
  return formatDateString(val, "date", "es-CL", "America/Santiago", val);
}

function resolveRuleColor(
  value: number,
  rules: ChartColorRule[]
): string | undefined {
  if (rules.length === 0) return undefined;
  const result = evaluateColorRulesGeneric(rules, String(value), ["item" as const]);
  const hex = result["item"];
  return hex ? `#${hex}` : undefined;
}

const DARK_TEXT = "#9ca3af";
const LIGHT_TEXT = "#6b7280";
const DARK_AXIS_LINE = "#374151";
const LIGHT_AXIS_LINE = "#d1d5db";
const DARK_TOOLTIP_BG = "#374151";
const LIGHT_TOOLTIP_BG = "#ffffff";
const DARK_TOOLTIP_TEXT = "#f3f4f6";
const LIGHT_TOOLTIP_TEXT = "#111827";
const DARK_AXIS_NAME = "#e5e7eb";
const LIGHT_AXIS_NAME = "#374151";

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

function buildTooltip(
  config: ChartOptionInput,
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
    formatter: (params: unknown) => {
      const p = params as { dataIndex?: number; data?: unknown[] };
      // For scatter, the original row index is stored as the 3rd element
      const rowIdx = Array.isArray(p.data) && p.data.length >= 3
        ? (p.data[2] as number)
        : (p.dataIndex ?? 0);
      const row = rows[rowIdx];
      if (!row) return "";
      const resolved = resolveHandlebarsField(config.tooltipTemplate!, { row, ...row });
      return resolved.replaceAll("\n", "<br>");
    },
  };
}

function buildCartesianOption(
  config: ChartOptionInput,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean,
  containerWidth: number,
  colorRules: ChartColorRule[]
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const axisLineColor = darkMode ? DARK_AXIS_LINE : LIGHT_AXIS_LINE;
  const axisNameStyle = { color: darkMode ? DARK_AXIS_NAME : LIGHT_AXIS_NAME, fontWeight: "bold" as const, fontSize: 13 };

  const isHorizontalBar = config.chartType === "bar" && config.horizontal;
  const useTimeAxis =
    config.chartType === "line" &&
    !!config.xAxisDateFormat &&
    config.xAxisDateFormat !== "none";
  const categoryData = useTimeAxis
    ? rows.map((r) => formatDateLabel(r[config.xAxisColumn] ?? ""))
    : rows.map((r) => r[config.xAxisColumn] ?? "");

  const labelRotate = (() => {
    if (isHorizontalBar || categoryData.length === 0 || containerWidth === 0) return 0;
    const maxLabelPx = Math.max(...categoryData.map((s) => String(s).length)) * 7;
    return maxLabelPx > containerWidth / categoryData.length ? 30 : 0;
  })();

  const categoryAxis = {
    type: "category" as const,
    data: categoryData,
    axisLabel: isHorizontalBar
      ? { color: textColor, overflow: "truncate" as const, width: 120 }
      : { color: textColor, interval: 0, rotate: labelRotate, overflow: "truncate" as const, width: 120 },
    axisLine: { lineStyle: { color: axisLineColor } },
  };

  const timeAxis = null;

  const valueAxis = {
    type: "value" as const,
    nameTextStyle: axisNameStyle,
    axisLabel: { color: textColor },
    axisLine: { lineStyle: { color: axisLineColor } },
    splitLine: { lineStyle: { color: axisLineColor } },
  };

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
    const baseXAxis = timeAxis ?? categoryAxis;
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
      bottom: config.showLegend ? 48 : config.xAxisLabel ? 24 : 8,
      containLabel: true,
    },
    xAxis,
    yAxis,
    series: config.series.map((s) => ({
      type: config.chartType as "line" | "bar" | "scatter",
      name: s.label,
      data: config.chartType === "scatter"
        ? rows.reduce<(number[] | { value: number[]; itemStyle: { color: string } })[]>(
            (acc, r, i) => {
              const rawX = r[config.xAxisColumn];
              const rawY = r[s.columnKey];
              if (rawX == null || rawX === "" || rawY == null || rawY === "") return acc;
              const x = Number.parseFloat(String(rawX));
              const y = Number.parseFloat(String(rawY));
              if (!Number.isFinite(x) || !Number.isFinite(y)) return acc;
              const color = resolveRuleColor(y, colorRules);
              acc.push(color ? { value: [x, y, i], itemStyle: { color } } : [x, y, i]);
              return acc;
            },
            []
          )
        : rows.map((r) => {
            const v = Number.parseFloat(r[s.columnKey]);
            if (!Number.isFinite(v)) return null;
            const color = resolveRuleColor(v, colorRules);
            return color ? { value: v, itemStyle: { color } } : v;
          }),
      smooth: config.chartType === "line" ? config.smooth : undefined,
      stack:
        config.stacked && config.chartType !== "scatter" ? "total" : undefined,
      ...(config.chartType === "bar" && config.showBarLabels ? {
        label: {
          show: true,
          position: isHorizontalBar ? "right" as const : "top" as const,
          color: "inherit" as const,
        },
      } : {}),
      ...(s.color ? { itemStyle: { color: s.color } } : {}),
    })),
    dataZoom: [
      { type: "inside", xAxisIndex: 0, throttle: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, throttle: 0, filterMode: "none" },
    ],
  };
}

function buildPieOption(
  config: ChartOptionInput,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean,
  colorRules: ChartColorRule[]
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const valueSeries = config.series[0];
  if (!valueSeries) return noDataOption(darkMode);

  const data = rows.reduce<{ name: string; value: number; itemStyle?: { color: string } }[]>(
    (acc, r) => {
      const v = Number.parseFloat(r[valueSeries.columnKey]);
      if (Number.isFinite(v)) {
        const color = resolveRuleColor(v, colorRules);
        acc.push({ name: r[config.xAxisColumn] ?? "", value: v, ...(color ? { itemStyle: { color } } : {}) });
      }
      return acc;
    },
    []
  );
  if (data.length === 0) return noDataOption(darkMode);

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
  config: ChartOptionInput,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean,
  colorRules: ChartColorRule[]
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const valueSeries = config.series[0];
  if (!valueSeries) return noDataOption(darkMode);

  const raw = Number.parseFloat(rows[0]?.[valueSeries.columnKey] ?? "");
  if (!Number.isFinite(raw)) return noDataOption(darkMode);
  const value = raw;
  const gaugeColor = resolveRuleColor(value, colorRules);

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

export function buildEChartsOption(
  config: ChartOptionInput,
  rows: Record<string, string>[],
  darkMode = false,
  noDataLabel?: string,
  containerWidth = 0
): EChartsOption {
  if (rows.length === 0) return noDataOption(darkMode, noDataLabel);

  const colors = getColors(config.colorPalette, config.customColors);
  const colorRules = normalizeChartColorRulesConfig(config.valueColorRules).rules;

  switch (config.chartType) {
    case "line":
    case "bar":
    case "scatter":
      return buildCartesianOption(config, rows, colors, darkMode, containerWidth, colorRules);
    case "pie":
      return buildPieOption(config, rows, colors, darkMode, colorRules);
    case "gauge":
      return buildGaugeOption(config, rows, colors, darkMode, colorRules);
    default:
      return buildCartesianOption(config, rows, colors, darkMode, containerWidth, colorRules);
  }
}
