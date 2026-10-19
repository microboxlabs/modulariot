import { expect, it } from "vitest";
import { buildMixedChartOption, type MixedChartOptions } from "./mixed";
const config: MixedChartOptions = {
  chartFamily: "cartesian",
  xAxisColumn: "name",
  representations: [
    { type: "bar", columnKey: "cost", label: "Cost", showLabels: true },
    {
      type: "line",
      columnKey: "count",
      label: "Count",
      yAxisIndex: 1,
      smooth: true,
    },
  ],
  xAxisLabel: "Service",
  yAxisLabel: "USD",
  yAxisLabelRight: "Count",
  dualYAxis: true,
  showLegend: true,
  colorPalette: "default",
  customColors: [],
  horizontal: false,
};
it("preserves mixed series, dual axes, null gaps and per-series controls", () => {
  const option = buildMixedChartOption(config, [
    { name: "A", cost: "5", count: "2" },
    { name: "B", cost: "bad", count: "3" },
  ]);
  expect(option.yAxis).toMatchObject([
    { name: "USD" },
    { name: "Count", position: "right", splitLine: { show: false } },
  ]);
  expect(option.series).toMatchObject([
    {
      type: "bar",
      yAxisIndex: 0,
      data: [5, null],
      label: { show: true, position: "top" },
    },
    { type: "line", yAxisIndex: 1, smooth: true, data: [2, 3] },
  ]);
});
it("keeps scatter on category axes and preserves row indices plus color precedence", () => {
  const option = buildMixedChartOption(
    {
      ...config,
      horizontal: true,
      customColors: ["#123456"],
      representations: [
        { type: "scatter", columnKey: "cost", label: "Cost", color: "#abcdef" },
      ],
    },
    [
      { name: "A", cost: "bad" },
      { name: "B", cost: "4" },
    ],
    false,
    undefined,
    600,
    { colorForValue: () => "#ff0000" },
  );
  expect(option.xAxis).toMatchObject({ type: "category", data: ["A", "B"] });
  expect(option.series).toMatchObject([
    {
      itemStyle: { color: "#123456" },
      data: [{ value: [1, 4, 1], itemStyle: { color: "#ff0000" } }],
    },
  ]);
});
it("supports horizontal bars and shares pie/gauge empty-state translations", () => {
  expect(
    buildMixedChartOption({ ...config, horizontal: true }, [
      { name: "A", cost: "1", count: "2" },
    ]).yAxis,
  ).toMatchObject({ type: "category", inverse: true });
  for (const chartFamily of ["pie", "gauge"] as const) {
    expect(
      buildMixedChartOption(
        { ...config, chartFamily },
        [{ name: "A", cost: "bad" }],
        false,
        "Sin datos",
      ).graphic,
    ).toMatchObject({ style: { text: "Sin datos" } });
  }
});
