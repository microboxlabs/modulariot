// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createStatusStatRegistry } from "./status-stat-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createStatusStatRegistry({
  defaultTitle: "Status",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
  renderIcon: (name) => <span>{name}</span>,
});
function Card({ config }: { readonly config: Widget["config"] }) {
  const widget: Widget = {
    id: "s",
    componentId: "stat_status",
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
it("resolves templates as text, targets the strongest matching rules and preserves base colors", () => {
  const view = render(
    <Card
      config={{
        title: "{{{name}}}",
        value: "{{cost}}",
        subtitle: "USD",
        icon: "database",
        staticData: '{"name":"<img src=x>","cost":42}',
        showColor: true,
        color: "0000ff",
        valueColorRules: {
          rules: [
            {
              operator: "greater_than",
              value: "10",
              color: "00ff00",
              targets: ["text"],
            },
            {
              operator: "greater_than",
              value: "40",
              color: "ff0000",
              targets: ["text"],
            },
            {
              operator: "equals",
              value: "42",
              color: "ffff00",
              target: "border",
            },
          ],
        },
      }}
    />,
  );
  expect(
    screen.getByRole("article", { name: "<img src=x>" }).style.borderLeftColor,
  ).toBe("rgb(255, 255, 0)");
  expect(view.container.querySelector("strong")?.style.color).toBe(
    "rgb(255, 0, 0)",
  );
  expect(
    view.container.querySelector<HTMLElement>(".miot-status-stat__icon")?.style
      .color,
  ).toBe("rgb(0, 0, 255)");
  expect(screen.getByText("database")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
});
it("rejects invalid colors and honors default text targets", () => {
  const view = render(
    <Card
      config={{
        value: "42",
        showColor: true,
        color: "url(secret)",
        valueColorRules: {
          rules: [
            { operator: "equals", value: "42", color: "bad" },
            {
              operator: "equals",
              value: "42",
              color: "ff0000",
              targets: ["invalid"],
            },
          ],
        },
      }}
    />,
  );
  expect(screen.getByRole("article").style.borderLeftColor).toBe("");
  expect(view.container.querySelector("strong")?.style.color).toBe(
    "rgb(255, 0, 0)",
  );
});
it("clears saved-query values on loading, failure and unsupported bindings", () => {
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
  expect(screen.getByText("42")).toBeTruthy();
  view.rerender(wrap(true, null));
  expect(screen.getByText("Loading")).toBeTruthy();
  expect(screen.queryByRole("article")).toBeNull();
  view.rerender(wrap(false, "Denied"));
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  view.rerender(<Card config={config} />);
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});
