import { expect, it, vi } from "vitest";
import { buildEChartsOption as buildV1 } from "./build-chart-option";
import { buildEChartsOption as buildV2 } from "../chart_v2/build-chart-option";

vi.mock("./value-color-rules", () => ({ normalizeChartColorRulesConfig: () => ({ rules: [] }) }));
vi.mock("@/features/common/components/formatted-date/formatted-date", () => ({ formatDateString: (value: string) => value }));

it("both chart families retain pie source indices and render custom tooltips as text", () => {
  const common = {
    xAxisColumn: "name", xAxisLabel: "", yAxisLabel: "", showLegend: false,
    colorPalette: "default" as const, customColors: [], horizontal: false,
    tooltipTemplate: "{{row.name}}: {{amount}}",
  };
  const rows = [{ name: "filtered", amount: "bad" }, { name: "<img>", amount: "5" }];
  const options = [
    buildV1({ ...common, chartType: "pie", series: [{columnKey:"amount",label:"Cost"}], smooth:false, stacked:false }, rows),
    buildV2({ ...common, chartFamily: "pie", representations: [{type:"bar",columnKey:"amount",label:"Cost"}] }, rows),
  ];
  for (const option of options) {
    const series = option.series as { data: { rowIndex: number; value: number }[] }[];
    expect(series[0].data).toEqual([{name:"<img>",value:5,rowIndex:1}]);
    const tooltip = option.tooltip as { renderMode: string; confine: boolean; formatter: (params: object) => string };
    expect(tooltip.renderMode).toBe("richText");
    expect(tooltip.confine).toBe(true);
    expect(tooltip.formatter({dataIndex:0,data:series[0].data[0]})).toBe("<img>: 5");
  }
});
