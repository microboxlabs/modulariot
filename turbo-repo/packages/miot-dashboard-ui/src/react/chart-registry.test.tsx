// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  WidgetRenderer,
  PlannerResultsProvider,
} from "@microboxlabs/miot-dashboard-ui/react";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createChartRegistry } from "./chart-registry";
afterEach(cleanup);
const update = vi.fn(),
  dispose = vi.fn();
const registry = createChartRegistry({
  createEngine: () => ({ update, dispose, resize: () => {} }),
  defaultTitle: "Chart",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
  emptyLabel: "Empty",
  now: () => Date.parse("2026-09-30T12:00:00Z"),
  rangeLabels: {
    all: "All",
    "7d": "Week",
    "30d": "Month",
    "90d": "Quarter",
    "180d": "Half",
    "1y": "Year",
  },
});
function Card({
  config,
  kind = "chart",
}: {
  readonly config: Widget["config"];
  readonly kind?: string;
}) {
  const widget: Widget = {
    id: "c",
    componentId: kind,
    config,
    layout: { i: "c", x: 0, y: 0, w: 6, h: 4 },
    createdAt: "2026-09-30",
    updatedAt: "2026-09-30",
  };
  return (
    <WidgetRenderer
      widget={widget}
      registry={registry}
      unknownWidgetLabel="Unknown"
    />
  );
}
it("binds static rows, series/title templates, colors and date-range controls", () => {
  update.mockClear();
  render(
    <Card
      config={{
        title: "{{row.service}} / {{data_provider.unit}}",
        dataProvider: [{ key: "unit", value: "USD" }],
        chartType: "line",
        xAxisColumn: "date",
        xAxisDateFormat: "day",
        series: [{ columnKey: "cost", label: "{{row.service}}" }],
        rows: [
          { date: "2026-09-01T12:00:00Z", cost: "5", service: "Cloud" },
          { date: "2026-09-29T12:00:00Z", cost: "9", service: "Cloud" },
        ],
        valueColorRules: {
          rules: [
            {
              operator: "greater_than",
              value: "8",
              color: "ff0000",
              targets: ["item"],
            },
          ],
        },
      }}
    />,
  );
  expect(screen.getByRole("heading").textContent).toBe("Cloud / USD");
  expect(update.mock.lastCall?.[0].series).toMatchObject([
    { name: "Cloud", data: [5, { value: 9, itemStyle: { color: "#ff0000" } }] },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Week" }));
  expect(update.mock.lastCall?.[0].series).toMatchObject([
    { data: [{ value: 9, itemStyle: { color: "#ff0000" } }] },
  ]);
});
it("uses named results and disposes stale charts on loading, denial or unsupported legacy data", () => {
  dispose.mockClear();
  const config = {
    dataMode: "planner",
    plannerVariableName: "costs",
    chartFamily: "cartesian",
    xAxisColumn: "service",
    representations: [{ type: "bar", columnKey: "cost", label: "Cost" }],
  };
  const wrap = (loading: boolean, error: string | null) => (
    <PlannerResultsProvider
      value={{
        results: new Map([
          ["costs", { rows: [{ service: "SQL", cost: "42" }], loading, error }],
        ]),
        definitions: [],
        schemas: new Map(),
      }}
    >
      <Card config={config} kind="chart_v2" />
    </PlannerResultsProvider>
  );
  const view = render(wrap(false, null));
  expect(update.mock.lastCall?.[0].series).toMatchObject([
    { type: "bar", data: [42] },
  ]);
  view.rerender(wrap(true, null));
  expect(screen.queryByRole("img")).toBeNull();
  expect(dispose).toHaveBeenCalledOnce();
  view.rerender(wrap(false, "Denied"));
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});
