import { z } from "zod";
const series = z.object({
  columnKey: z.string(),
  label: z.string(),
  color: z.string().optional(),
});
export const chartWidgetConfig = z.object({
  title: z.string().default(""),
  dataMode: z.string().default("static"),
  plannerVariableName: z.string().optional(),
  rows: z.array(z.record(z.string())).default([]),
  dataProvider: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .default([]),
  chartType: z.enum(["line", "bar", "scatter", "pie", "gauge"]).default("bar"),
  chartFamily: z.enum(["cartesian", "pie", "gauge"]).default("cartesian"),
  xAxisColumn: z.string().default(""),
  xAxisLabel: z.string().default(""),
  yAxisLabel: z.string().default(""),
  yAxisLabelRight: z.string().default(""),
  series: z.array(series).default([]),
  representations: z
    .array(
      series.extend({
        type: z.enum(["line", "bar", "scatter"]),
        smooth: z.boolean().optional(),
        stacked: z.boolean().optional(),
        showLabels: z.boolean().optional(),
        yAxisIndex: z.union([z.literal(0), z.literal(1)]).optional(),
      }),
    )
    .default([]),
  colorPalette: z
    .enum([
      "default",
      "cool",
      "warm",
      "monochrome",
      "pastel",
      "vivid",
      "custom",
    ])
    .default("default"),
  customColors: z.array(z.string()).default([]),
  showLegend: z.boolean().default(true),
  smooth: z.boolean().default(false),
  stacked: z.boolean().default(false),
  horizontal: z.boolean().default(false),
  showBarLabels: z.boolean().default(false),
  dualYAxis: z.boolean().default(false),
  xAxisDateFormat: z.enum(["none", "day", "month", "year"]).default("none"),
  defaultDateRange: z
    .enum(["all", "7d", "30d", "90d", "180d", "1y"])
    .default("all"),
  tooltipTemplate: z.string().optional(),
  valueColorRules: z
    .object({
      rules: z
        .array(
          z.object({
            operator: z.enum([
              "equals",
              "not_equals",
              "contains",
              "not_contains",
              "greater_than",
              "less_than",
              "greater_than_or_equal",
              "less_than_or_equal",
            ]),
            value: z.string(),
            color: z.string().regex(/^[\da-f]{6}$/i),
            targets: z.array(z.string()).default(["item"]),
          }),
        )
        .default([]),
    })
    .optional(),
});
