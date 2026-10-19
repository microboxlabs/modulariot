// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createSparklineStatRegistry } from "./sparkline-stat-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createSparklineStatRegistry({
  defaultTitle: "Cost",
  defaultUnit: "USD",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
  formatValue: (v) => v.toFixed(2),
  trendLabel: () => "Configured samples",
});
function Card({ config }: { readonly config: Widget["config"] }) {
  const widget: Widget = {
    id: "s",
    componentId: "stat_sparkline",
    config,
    layout: { i: "s", x: 0, y: 0, w: 3, h: 2 },
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
it("resolves static samples and value templates with text thresholds", () => {
  const view = render(
    <Card
      config={{
        staticData: '{"cost":42,"previous":20}',
        value: "{{cost}}",
        sparkline: ["{{previous}}", "{{cost}}"],
        thresholds: {
          enabled: true,
          field: "{{cost}}",
          applyTo: ["text"],
          rules: [{ operator: "greater_than", value: "30", color: "ff0000" }],
        },
      }}
    />,
  );
  expect(screen.getByText("42.00").style.color).toBe("rgb(255, 0, 0)");
  expect(screen.getByText("Configured samples")).toBeTruthy();
  expect(view.container.querySelectorAll("path")[1]?.getAttribute("d")).toBe(
    "M 0,50 L 200,0",
  );
  view.rerender(<Card config={{ value: "42" }} />);
  expect(view.container.querySelectorAll("path")[1]?.getAttribute("d")).toBe(
    "",
  );
});
it("uses named query results and clears stale values when loading or denied", () => {
  const config = {
    dataMode: "planner",
    plannerVariableName: "costs",
    value: "{{cost}}",
    sparkline: [0, "{{cost}}"],
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
  expect(screen.getByText("42.00")).toBeTruthy();
  view.rerender(wrap(true, null));
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("Loading")).toBeTruthy();
  view.rerender(wrap(false, "Denied"));
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});
