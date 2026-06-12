import type { EChartsOption } from "echarts";
import type { ChartFamily, RepresentationConfig, XAxisDateFormat } from "./dashlet";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import { getColors, type ColorPalette } from "../chart/chart-palettes";
import type { ChartColorRule, ChartColorRulesConfig } from "../chart/value-color-rules";
import { normalizeChartColorRulesConfig } from "../chart/value-color-rules";
import { evaluateColorRulesGeneric } from "../common/color-rule-evaluation";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";

interface ChartOptionInput {
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
  valueColorRules?: ChartColorRulesConfig;
  tooltipTemplate?: string;
}

function formatDateLabel(val: string): string {
  return formatDateString(val, "date", "es-CL", "America/Santiago", val);
}

function resolveRuleColor(value: number, rules: ChartColorRule[]): string | undefined {
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
  defaultTrigger: "axis" | "item" = "item"
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
      const rowIdx =
        Array.isArray(p.data) && p.data.length >= 3
          ? (p.data[2] as number)
          : (p.dataIndex ?? 0);
      const row = rows[rowIdx];
      if (!row) return "";
      return resolveHandlebarsField(config.tooltipTemplate!, { row, ...row }).replaceAll("\n", "<br>");
    },
  };
}

// ============================================================================
// Cartesian (line + bar + scatter mix on a category x-axis)
// ============================================================================

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
  const axisNameStyle = {
    color: darkMode ? DARK_AXIS_NAME : LIGHT_AXIS_NAME,
    fontWeight: "bold" as const,
    fontSize: 13,
  };

  const hasScatterRep = config.representations.some((r) => r.type === "scatter");
  const isHorizontalBar = config.horizontal && !hasScatterRep;
  const useTimeAxis = !!config.xAxisDateFormat && config.xAxisDateFormat !== "none";

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
        data: rows.reduce<(number[] | { value: number[]; itemStyle: { color: string } })[]>(
          (acc, r, rowIdx) => {
            const rawX = useTimeAxis
              ? formatDateLabel(r[config.xAxisColumn] ?? "")
              : (r[config.xAxisColumn] ?? "");
            const xIdx = categoryData.indexOf(rawX);
            const rawY = r[rep.columnKey];
            if (xIdx < 0 || rawY == null || rawY === "") return acc;
            const y = Number.parseFloat(String(rawY));
            if (!Number.isFinite(y)) return acc;
            const ruleColor = resolveRuleColor(y, colorRules);
            acc.push(
              ruleColor
                ? { value: [xIdx, y, rowIdx], itemStyle: { color: ruleColor } }
                : [xIdx, y, rowIdx]
            );
            return acc;
          },
          []
        ),
        ...(effectiveColor ? { itemStyle: { color: effectiveColor } } : {}),
      };
    }

    return {
      type: rep.type,
      name: rep.label,
      yAxisIndex: config.dualYAxis ? (rep.yAxisIndex ?? 0) : undefined,
      data: rows.map((r) => {
        const v = Number.parseFloat(r[rep.columnKey]);
        if (!Number.isFinite(v)) return null;
        const ruleColor = resolveRuleColor(v, colorRules);
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
      { type: "inside", yAxisIndex: config.dualYAxis ? [0, 1] : 0, throttle: 0, filterMode: "none" },
    ],
  };
}

// ============================================================================
// Pie (single representation)
// ============================================================================

function buildPieOption(
  config: ChartOptionInput,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean,
  colorRules: ChartColorRule[]
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const rep = config.representations[0];
  if (!rep) return noDataOption(darkMode);

  const data = rows.reduce<{ name: string; value: number; itemStyle?: { color: string } }[]>(
    (acc, r) => {
      const v = Number.parseFloat(r[rep.columnKey]);
      if (Number.isFinite(v)) {
        const ruleColor = resolveRuleColor(v, colorRules);
        acc.push({
          name: r[config.xAxisColumn] ?? "",
          value: v,
          ...(ruleColor ? { itemStyle: { color: ruleColor } } : {}),
        });
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

// ============================================================================
// Gauge (single representation, first row value)
// ============================================================================

function buildGaugeOption(
  config: ChartOptionInput,
  rows: Record<string, string>[],
  colors: string[],
  darkMode: boolean,
  colorRules: ChartColorRule[]
): EChartsOption {
  const textColor = darkMode ? DARK_TEXT : LIGHT_TEXT;
  const rep = config.representations[0];
  if (!rep) return noDataOption(darkMode);

  const raw = Number.parseFloat(rows[0]?.[rep.columnKey] ?? "");
  if (!Number.isFinite(raw)) return noDataOption(darkMode);
  const gaugeColor = resolveRuleColor(raw, colorRules);

  return {
    color: colors,
    tooltip: buildTooltip(config, rows, darkMode),
    series: [
      {
        type: "gauge",
        radius: "100%",
        data: [{ value: raw, name: rep.label }],
        detail: { formatter: "{value}", color: textColor },
        title: { color: textColor },
        axisLabel: { color: textColor },
        ...(gaugeColor ? { itemStyle: { color: gaugeColor } } : {}),
      },
    ],
  };
}

// ============================================================================
// Entry point
// ============================================================================

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

  switch (config.chartFamily) {
    case "cartesian":
      return buildCartesianOption(config, rows, colors, darkMode, containerWidth, colorRules);
    case "pie":
      return buildPieOption(config, rows, colors, darkMode, colorRules);
    case "gauge":
      return buildGaugeOption(config, rows, colors, darkMode, colorRules);
    default:
      return buildCartesianOption(config, rows, colors, darkMode, containerWidth, colorRules);
  }
}
