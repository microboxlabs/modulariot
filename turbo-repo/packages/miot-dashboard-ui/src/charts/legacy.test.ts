import { expect, it } from "vitest";
import { buildLegacyChartOption, type LegacyChartOptions } from "./legacy";
const config: LegacyChartOptions = {
  chartType: "bar",
  xAxisColumn: "name",
  series: [{ columnKey: "amount", label: "Cost" }],
  xAxisLabel: "",
  yAxisLabel: "",
  showLegend: true,
  colorPalette: "default",
  customColors: [],
  smooth: false,
  stacked: false,
  horizontal: false,
};
const rows = [
  { name: "A", amount: "5" },
  { name: "B", amount: "invalid" },
  { name: "C", amount: "10" },
];
it("preserves line/bar gaps, series controls and explicit date formatting", () => {
  const option = buildLegacyChartOption(
    {
      ...config,
      chartType: "line",
      smooth: true,
      stacked: true,
      xAxisDateFormat: "day",
    },
    rows,
    false,
    "Empty",
    500,
    {
      formatDateLabel: (v) => "Date " + v,
      colorForValue: (v) => (v > 8 ? "#ff0000" : undefined),
    },
  );
  expect(option.xAxis).toMatchObject({ data: ["Date A", "Date B", "Date C"] });
  expect(option.series).toMatchObject([
    {
      type: "line",
      smooth: true,
      stack: "total",
      data: [5, null, { value: 10, itemStyle: { color: "#ff0000" } }],
    },
  ]);
});
it("preserves pie source indices and gauge first-value behavior", () => {
  expect(
    buildLegacyChartOption({ ...config, chartType: "pie" }, rows).series,
  ).toMatchObject([
    {
      data: [
        { name: "A", value: 5, rowIndex: 0 },
        { name: "C", value: 10, rowIndex: 2 },
      ],
    },
  ]);
  expect(
    buildLegacyChartOption({ ...config, chartType: "gauge" }, rows).series,
  ).toMatchObject([{ type: "gauge", data: [{ name: "Cost", value: 5 }] }]);
  expect(
    buildLegacyChartOption(config, [], false, "No results").graphic,
  ).toMatchObject({ style: { text: "No results" } });
});
it("keeps numeric scatter coordinates and row indices after invalid points are removed", () => {
  const option = buildLegacyChartOption(
    { ...config, chartType: "scatter" },
    [
      { name: "bad", amount: "2" },
      { name: "3", amount: "4" },
    ],
    false,
    undefined,
    0,
    { colorForValue: () => "#123456" },
  );
  expect(option.series).toMatchObject([
    { data: [{ value: [3, 4, 1], itemStyle: { color: "#123456" } }] },
  ]);
});

it.each(["pie", "gauge"] as const)(
  "uses the host no-data label for invalid %s values",
  (chartType) => {
    expect(
      buildLegacyChartOption(
        { ...config, chartType },
        [{ name: "A", amount: "bad" }],
        false,
        "Sin datos",
      ).graphic,
    ).toMatchObject({ style: { text: "Sin datos" } });
  },
);
