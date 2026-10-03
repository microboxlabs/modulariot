// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createSensitiveStatRegistry } from "./sensitive-stat-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createSensitiveStatRegistry({
  defaultTitle: "Balance",
  defaultUnit: "$",
  showLabel: "Show",
  hideLabel: "Hide",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
  locale: "en-US",
});
function Card({ config }: { readonly config: Widget["config"] }) {
  const widget: Widget = {
    id: "s",
    componentId: "stat_sensitive",
    config,
    layout: { i: "s", x: 0, y: 0, w: 3, h: 2 },
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
it("masks formatted templates and applies the first matching threshold only when revealed", () => {
  const view = render(
    <Card
      config={{
        title: "{{name}}",
        value: "{{cost}}",
        staticData: '{"name":"Billing","cost":1234.5}',
        thresholds: {
          enabled: true,
          field: "{{cost}}",
          applyTo: ["text"],
          rules: [
            { operator: "greater_than", value: "100", color: "red" },
            { operator: "greater_than", value: "1000", color: "blue" },
          ],
        },
      }}
    />,
  );
  expect(view.container.textContent).not.toContain("1,234.50");
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
  expect(screen.getByText("$1,234.50").style.color).toBe("rgb(239, 68, 68)");
  view.rerender(<Card config={{ value: "<img>", isSensitive: false }} />);
  expect(screen.getByText("$<img>")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
});
it("does not apply disabled, unsafe or background-only threshold rules", () => {
  const base = {
    enabled: true,
    field: "42",
    rules: [{ operator: "equals", value: "42", color: "ff0000" }],
  };
  const view = render(
    <Card
      config={{
        value: "42",
        isSensitive: false,
        thresholds: { ...base, applyTo: ["background"] },
      }}
    />,
  );
  expect(screen.getByText("$42.00").style.color).toBe("");
  view.rerender(
    <Card
      config={{
        value: "42",
        isSensitive: false,
        thresholds: { ...base, enabled: false },
      }}
    />,
  );
  expect(screen.getByText("$42.00").style.color).toBe("");
  view.rerender(
    <Card
      config={{
        value: "42",
        isSensitive: false,
        thresholds: {
          ...base,
          rules: [{ operator: "equals", value: "42", color: "url(secret)" }],
        },
      }}
    />,
  );
  expect(screen.getByText("$42.00").style.color).toBe("");
});
it("clears disclosure after query loading and failures", () => {
  const config = {
    dataMode: "planner",
    plannerVariableName: "costs",
    value: "{{cost}}",
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
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
  expect(screen.getByText("$42.00")).toBeTruthy();
  view.rerender(wrap(true, null));
  expect(screen.queryByText("$42.00")).toBeNull();
  expect(screen.getByText("Loading")).toBeTruthy();
  view.rerender(wrap(false, null));
  expect(screen.queryByText("$42.00")).toBeNull();
  view.rerender(wrap(false, "Denied"));
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});
