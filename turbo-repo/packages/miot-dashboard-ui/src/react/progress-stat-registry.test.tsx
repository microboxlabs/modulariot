// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createProgressStatRegistry } from "./progress-stat-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createProgressStatRegistry({
  defaultTitle: "Goal",
  defaultUnit: "%",
  formatValue: (value, target, unit) => `${value} de ${target} ${unit}`,
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
});
function Card({ config }: { readonly config: Widget["config"] }) {
  const widget: Widget = {
    id: "p",
    componentId: "stat_progress",
    config,
    layout: { i: "p", x: 0, y: 0, w: 3, h: 2 },
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
it("renders template values with accessible progress and quarter milestones", () => {
  const view = render(
    <Card
      config={{
        title: "{{name}}",
        value: "{{cost}}",
        target: 200,
        unit: "USD",
        staticData: '{"name":"Budget","cost":50}',
      }}
    />,
  );
  const bar = screen.getByRole("progressbar", { name: "Budget" });
  expect(bar.getAttribute("value")).toBe("25");
  expect(bar.getAttribute("aria-valuetext")).toBe("50 de 200 USD");
  expect(
    view.container.querySelector(".miot-progress-stat__labels")?.textContent,
  ).toBe("050100150200");
  expect(
    (
      view.container.querySelector(".miot-progress-stat") as HTMLElement
    ).style.getPropertyValue("--miot-progress-color"),
  ).toBe("#eab308");
});
it("honors bar-rule priority, named thresholds, apply targets and disabled thresholds", () => {
  const thresholds = {
    enabled: true,
    field: "{{cost}}",
    applyTo: ["background", "text"],
    rules: [{ operator: "greater_than", value: "10", color: "red" }],
  };
  const config = {
    value: "40",
    staticData: '{"cost":40}',
    thresholds,
    barColorRules: {
      rules: [{ operator: "greater_than", value: "30", color: "00ff00" }],
    },
  };
  const view = render(<Card config={config} />);
  const color = () =>
    (
      view.container.querySelector(".miot-progress-stat") as HTMLElement
    ).style.getPropertyValue("--miot-progress-color");
  expect(color()).toBe("#00ff00");
  expect(view.container.querySelector("strong")?.style.color).toBe(
    "rgb(239, 68, 68)",
  );
  view.rerender(<Card config={{ ...config, barColorRules: {} }} />);
  expect(color()).toBe("#ef4444");
  view.rerender(
    <Card
      config={{
        ...config,
        barColorRules: {},
        thresholds: { ...thresholds, enabled: false },
      }}
    />,
  );
  expect(color()).toBe("#eab308");
});
it("clamps nonfinite values and treats unsafe colors and HTML as data", () => {
  const view = render(
    <Card
      config={{
        title: "<img src=x>",
        value: "Infinity",
        target: "0",
        barColorRules: {
          rules: [{ operator: "equals", value: "0", color: "url(secret)" }],
        },
      }}
    />,
  );
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("0");
  expect(view.container.querySelector("img")).toBeNull();
  expect(
    (
      view.container.querySelector(".miot-progress-stat") as HTMLElement
    ).style.getPropertyValue("--miot-progress-color"),
  ).toBe("#ef4444");
});
it("consumes saved-query values and clears them after failure or legacy binding", () => {
  const config = {
    dataMode: "planner",
    plannerVariableName: "costs",
    value: "{{cost}}",
    target: "100",
  };
  const view = render(
    <PlannerResultsProvider
      value={{
        results: new Map([
          ["costs", { rows: [{ cost: "42" }], loading: false, error: null }],
        ]),
        definitions: [],
        schemas: new Map(),
      }}
    >
      <Card config={config} />
    </PlannerResultsProvider>,
  );
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("42");
  view.rerender(<Card config={config} />);
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  expect(screen.queryByRole("progressbar")).toBeNull();
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});
it.each([
  [0, 100, "0", "#ef4444"],
  [50, 100, "50", "#3b82f6"],
  [150, 100, "100", "#22c55e"],
  [-10, 100, "0", "#ef4444"],
  [40, -10, "0", "#ef4444"],
])(
  "clamps value %s against target %s and selects default bands",
  (value, target, expected, color) => {
    const view = render(<Card config={{ value, target, title: " " }} />);
    expect(
      screen.getByRole("progressbar", { name: "Goal" }).getAttribute("value"),
    ).toBe(expected);
    expect(
      (
        view.container.querySelector(".miot-progress-stat") as HTMLElement
      ).style.getPropertyValue("--miot-progress-color"),
    ).toBe(color);
  },
);
it("shows loading without stale values and uses text-only thresholds by default", () => {
  const config = {
    dataMode: "planner",
    plannerVariableName: "costs",
    value: "{{cost}}",
  };
  const view = render(
    <PlannerResultsProvider
      value={{
        results: new Map([
          ["costs", { rows: [{ cost: "42" }], loading: true, error: null }],
        ]),
        definitions: [],
        schemas: new Map(),
      }}
    >
      <Card config={config} />
    </PlannerResultsProvider>,
  );
  expect(screen.getByText("Loading")).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
  view.rerender(
    <Card
      config={{
        value: "50",
        thresholds: {
          enabled: true,
          field: "50",
          rules: [{ operator: "equals", value: "50", color: "ff0000" }],
        },
      }}
    />,
  );
  expect(view.container.querySelector("strong")?.style.color).toBe(
    "rgb(255, 0, 0)",
  );
  expect(
    (
      view.container.querySelector(".miot-progress-stat") as HTMLElement
    ).style.getPropertyValue("--miot-progress-color"),
  ).toBe("#3b82f6");
});
