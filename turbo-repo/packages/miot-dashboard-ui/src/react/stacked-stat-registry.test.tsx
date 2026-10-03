// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createStackedStatRegistry } from "./stacked-stat-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createStackedStatRegistry({
  defaultTitle: "Costs",
  defaultUnit: "USD",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
  emptyLabel: "No items",
});
function Card({ config }: { readonly config: Widget["config"] }) {
  const widget: Widget = {
    id: "s",
    componentId: "stat_stacked",
    config,
    layout: { i: "s", x: 0, y: 0, w: 4, h: 2 },
    createdAt: "2026-09-30",
    updatedAt: "2026-09-30",
  };
  return (
    <WidgetRenderer
      registry={registry}
      widget={widget}
      unknownWidgetLabel="Unknown"
    />
  );
}
it("resolves static item templates and validates configuration and colors", () => {
  const view = render(
    <Card
      config={{
        staticData: '{"service":"<img>","cost":30}',
        items: [
          { label: "{{{service}}}", value: "{{cost}}", color: "#ff0000" },
          { label: "Other", value: 70, color: "url(secret)" },
          null,
          { label: "Incomplete" },
        ],
      }}
    />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  const bars = [...view.container.querySelectorAll("rect")].slice(1);
  expect(bars.map((bar) => bar.getAttribute("width"))).toEqual(["30", "70"]);
  expect(bars.map((bar) => bar.getAttribute("fill"))).toEqual([
    "#ff0000",
    "#9ca3af",
  ]);
  expect(screen.getByText("<img>")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  view.rerender(<Card config={{ items: [{ label: 42 }] }} />);
  expect(screen.getByText("No items")).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
});
it("renders saved-query donut values and clears stale segments on loading or failure", () => {
  const config = {
    dataMode: "planner",
    plannerVariableName: "costs",
    chartType: "donut",
    showHeader: false,
    items: [{ label: "{{service}}", value: "{{cost}}", color: "ff0000" }],
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
      <Card config={config} />
    </PlannerResultsProvider>
  );
  const view = render(wrap(false, null));
  expect(screen.getByText("42USD")).toBeTruthy();
  expect(view.container.querySelectorAll("circle")).toHaveLength(2);
  expect(view.container.querySelector(".miot-stacked-stat__title")).toBeNull();
  view.rerender(wrap(true, null));
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("Loading")).toBeTruthy();
  view.rerender(wrap(false, "Denied"));
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});
