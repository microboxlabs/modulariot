// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createCircularStatRegistry } from "./circular-stat-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createCircularStatRegistry({
  defaultTitle: "Storage",
  defaultUnit: "GB",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
  formatTotal: (max, unit) => `de ${max} ${unit}`,
});
function Card({ config }: { readonly config: Widget["config"] }) {
  const widget: Widget = {
    id: "s",
    componentId: "stat_circular",
    config,
    layout: { i: "s", x: 0, y: 0, w: 3, h: 3 },
    createdAt: "2026-09-29",
    updatedAt: "2026-09-29",
  };
  return (
    <WidgetRenderer
      registry={registry}
      widget={widget}
      unknownWidgetLabel="Missing"
    />
  );
}
it("resolves localized labels, provider values and numeric legacy configs", () => {
  render(
    <Card
      config={{
        title: "{{name}}",
        value: 25,
        maxValue: 100,
        unit: "{{data_provider.unit}}",
        dataProvider: [{ key: "unit", value: "USD" }],
        staticData: '{"name":"Costs"}',
      }}
    />,
  );
  const progress = screen.getByRole("progressbar", { name: "Costs" });
  expect(progress.getAttribute("value")).toBe("25");
  expect(progress.getAttribute("aria-valuetext")).toBe("25 USD; de 100 USD");
  expect(screen.getByText("de 100 USD")).toBeTruthy();
});
it("preserves circular mixed-rule order while selecting strongest same-direction thresholds", () => {
  const rules = [
    { operator: "greater_than", value: "10", color: "ffff00" },
    { operator: "less_than_or_equal", value: "10", color: "00ff00" },
    { operator: "greater_than", value: "35", color: "ff0000" },
  ];
  const view = render(
    <Card config={{ value: "50", ringColorRules: { rules } }} />,
  );
  const color = () =>
    view.container
      .querySelector(".miot-circular-stat__ring")
      ?.getAttribute("stroke");
  expect(color()).toBe("#ffff00");
  view.rerender(
    <Card
      config={{ value: "50", ringColorRules: { rules: [rules[0], rules[2]] } }}
    />,
  );
  expect(color()).toBe("#ff0000");
  expect(rules[0]?.value).toBe("10");
});
it("keeps formatted text literal and sanitizes ring colors and nonfinite progress", () => {
  const view = render(
    <Card
      config={{
        title: "<img src=x>",
        value: "Infinity",
        maxValue: "100",
        ringColor: "url(secret)",
      }}
    />,
  );
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("0");
  expect(screen.getByText("Infinity")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  expect(
    view.container
      .querySelector(".miot-circular-stat__ring")
      ?.getAttribute("stroke"),
  ).toBe("#3b82f6");
});
it("reads query rows then clears the ring on an error", () => {
  const card = (
    <Card
      config={{
        dataMode: "planner",
        plannerVariableName: "costs",
        value: "{{cost}}",
        maxValue: "100",
      }}
    />
  );
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
      {card}
    </PlannerResultsProvider>,
  );
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("42");
  view.rerender(card);
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  expect(screen.queryByRole("progressbar")).toBeNull();
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});

it("rejects object template fields and ignores invalid matching rule colors", () => {
  const view = render(
    <Card
      config={{
        title: { unexpected: true },
        value: [50],
        maxValue: {},
        unit: {},
      }}
    />,
  );
  expect(view.container.textContent).not.toContain("[object Object]");
  expect(screen.getByRole("progressbar", { name: "Storage" })).toBeTruthy();
  view.rerender(<Card config={{ title: "{{missing}}" }} />);
  expect(screen.getByRole("progressbar", { name: "Storage" })).toBeTruthy();
  view.rerender(<Card config={{ title: "   ", value: 0 }} />);
  expect(screen.getByRole("progressbar", { name: "Storage" })).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("0");
  view.rerender(
    <Card
      config={{
        value: 50,
        ringColor: "00ff00",
        ringColorRules: {
          rules: [
            { operator: "greater_than", value: "10", color: "red" },
            { operator: "greater_than", value: "20", color: "" },
          ],
        },
      }}
    />,
  );
  expect(
    view.container
      .querySelector(".miot-circular-stat__ring")
      ?.getAttribute("stroke"),
  ).toBe("#00ff00");
});
