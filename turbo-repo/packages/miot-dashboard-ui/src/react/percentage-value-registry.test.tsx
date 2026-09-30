// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createPercentageValueRegistry } from "./percentage-value-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createPercentageValueRegistry({
  defaultTitle: "Progress",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
});
function Card({ config }: { readonly config: Widget["config"] }) {
  const widget: Widget = {
    id: "p",
    componentId: "percentage_value",
    config,
    layout: { i: "p", x: 0, y: 0, w: 3, h: 1 },
    createdAt: "2026-09-29",
    updatedAt: "2026-09-29",
  };
  return (
    <WidgetRenderer
      registry={registry}
      unknownWidgetLabel="Unknown"
      widget={widget}
    />
  );
}
it("renders static template fields and selects the strongest percentage rule", () => {
  const view = render(
    <Card
      config={{
        title: "{{name}}",
        value: "{{count}}",
        max: "{{total}}",
        staticData: '{"name":"Storage","count":40,"total":50}',
        barColorRules: {
          enabled: false,
          rules: [
            { operator: "greater_than", value: "10", color: "ffff00" },
            { operator: "greater_than", value: "75", color: "ff0000" },
          ],
        },
      }}
    />,
  );
  expect(
    screen.getByRole("progressbar", { name: "Storage" }).getAttribute("value"),
  ).toBe("80");
  expect(
    (
      view.container.querySelector(".miot-percentage-value") as HTMLElement
    ).style.getPropertyValue("--miot-progress-color"),
  ).toBe("#ff0000");
});
it("uses count rules and sanitizes invalid colors and numeric templates", () => {
  const config = {
    value: "4",
    max: "5",
    barColorRules: {
      evalMode: "count",
      rules: [
        null,
        { operator: "invalid", value: "0", color: "red" },
        { operator: "greater_than", value: "5", color: "ff0000" },
      ],
    },
    barColor: "00ff00",
  };
  const view = render(<Card config={config} />);
  expect(
    (
      view.container.querySelector(".miot-percentage-value") as HTMLElement
    ).style.getPropertyValue("--miot-progress-color"),
  ).toBe("#00ff00");
  view.rerender(
    <Card
      config={{
        value: "{{missing}}",
        max: "no number",
        barColor: "url(secret)",
      }}
    />,
  );
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("0");
  expect(
    (
      view.container.querySelector(".miot-percentage-value") as HTMLElement
    ).style.getPropertyValue("--miot-progress-color"),
  ).toBe("#2563eb");
});
it("consumes saved-query rows and removes values when queries fail", () => {
  const card = (
    <Card
      config={{
        dataMode: "planner",
        plannerVariableName: "costs",
        value: "{{cost}}",
        max: "100",
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
  view.rerender(
    <PlannerResultsProvider
      value={{
        results: new Map([
          [
            "costs",
            { rows: [{ cost: "42" }], loading: false, error: "private" },
          ],
        ]),
        definitions: [],
        schemas: new Map(),
      }}
    >
      {card}
    </PlannerResultsProvider>,
  );
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  expect(screen.queryByRole("progressbar")).toBeNull();
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});
