// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createDetailedStatRegistry } from "./detailed-stat-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createDetailedStatRegistry({
  defaultTitle: "Cost",
  defaultUnit: "$",
  progressLabel: "Target",
  previousLabel: "Previous",
  progressSummary: (percent) => `${Math.round(percent)}% reached`,
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
  formatValue: (value, unit) => `${unit}${value.toFixed(2)}`,
});
function Card({ config }: { readonly config: Widget["config"] }) {
  const widget: Widget = {
    id: "d",
    componentId: "stat_detailed",
    config,
    layout: { i: "d", x: 0, y: 0, w: 4, h: 4 },
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
it("resolves templates and compares against previous and target fields", () => {
  const view = render(
    <Card
      config={{
        staticData: '{"cost":80,"previous":100,"target":200,"name":"<img>"}',
        title: "{{{name}}}",
        value: "{{cost}}",
        previousValue: "{{previous}}",
        target: "{{target}}",
        valueColorRules: {
          rules: [
            {
              operator: "less_than",
              compareMode: "field",
              compareField: "previousValue",
              color: "ff0000",
              targets: ["text", "badge"],
            },
            {
              operator: "less_than",
              compareMode: "field",
              compareField: "target",
              color: "00ff00",
              targets: ["bar"],
            },
          ],
        },
      }}
    />,
  );
  expect(screen.getByRole("article", { name: "<img>" })).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  expect(screen.getByText("$80.00").style.color).toBe("rgb(255, 0, 0)");
  expect(screen.getByText("-20%").style.color).toBe("rgb(255, 0, 0)");
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("40");
  expect(
    screen
      .getByRole("progressbar")
      .style.getPropertyValue("--miot-progress-color"),
  ).toBe("#00ff00");
  expect(screen.getByRole("definition").textContent).toBe("$100.00");
});
it("clears saved-query values on loading and errors and handles zero baselines", () => {
  const config = {
    dataMode: "planner",
    plannerVariableName: "costs",
    value: "{{cost}}",
    previousValue: "0",
    target: "0",
  };
  const wrap = (loading: boolean, error: string | null) => (
    <PlannerResultsProvider
      value={{
        results: new Map([
          ["costs", { rows: [{ cost: "42" }], loading, error }],
        ]),
        definitions: [],
        schemas: new Map(),
      }}
    >
      <Card config={config} />
    </PlannerResultsProvider>
  );
  const view = render(wrap(false, null));
  expect(screen.getByText("$42.00")).toBeTruthy();
  expect(screen.getByText("+0%")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("0");
  view.rerender(wrap(true, null));
  expect(screen.queryByText("$42.00")).toBeNull();
  expect(screen.getByText("Loading")).toBeTruthy();
  view.rerender(wrap(false, "Denied"));
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});
