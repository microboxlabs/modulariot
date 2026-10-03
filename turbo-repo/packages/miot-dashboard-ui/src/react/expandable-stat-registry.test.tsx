// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createExpandableStatRegistry } from "./expandable-stat-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createExpandableStatRegistry({
  defaultTitle: "Cost",
  defaultUnit: "USD",
  showLabel: "Show",
  hideLabel: "Hide",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
});
function Card({ config }: { readonly config: Widget["config"] }) {
  const widget: Widget = {
    id: "e",
    componentId: "stat_expandable",
    config,
    layout: { i: "e", x: 0, y: 0, w: 3, h: 4 },
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
it("resolves main and detail templates with targeted rules and safe literal text", () => {
  const view = render(
    <Card
      config={{
        staticData: '{"cost":"042","service":"<img>"}',
        value: "{{cost}}",
        valueColor: "0000ff",
        details: [
          { label: "Service", value: "{{{service}}}" },
          { label: "Amount", value: "{{cost}}" },
          null,
        ],
        valueColorRules: {
          rules: [
            {
              operator: "greater_than",
              value: "10",
              color: "ff0000",
              targets: ["text", "bg"],
            },
          ],
        },
      }}
    />,
  );
  expect(view.container.querySelector("strong")?.textContent).toBe("42USD");
  expect(view.container.querySelector("strong")?.style.color).toBe(
    "rgb(255, 0, 0)",
  );
  expect(
    screen
      .getByRole("article")
      .style.getPropertyValue("--miot-expand-background"),
  ).toBe("#ff000020");
  expect(screen.queryByText("<img>")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
  expect(screen.getByText("<img>")).toBeTruthy();
  expect(screen.getAllByRole("definition")).toHaveLength(2);
  expect(view.container.querySelector("img")).toBeNull();
});
it("clears saved-query details during loading and failure, collapsing on recovery", () => {
  const config = {
    dataMode: "planner",
    plannerVariableName: "costs",
    value: "{{cost}}",
    details: [{ label: "Service", value: "{{service}}" }],
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
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
  expect(screen.getByText("SQL")).toBeTruthy();
  view.rerender(wrap(true, null));
  expect(screen.queryByText("SQL")).toBeNull();
  expect(screen.getByText("Loading")).toBeTruthy();
  view.rerender(wrap(false, null));
  expect(screen.getByRole("button", { name: "Show" })).toBeTruthy();
  view.rerender(wrap(false, "Denied"));
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});
