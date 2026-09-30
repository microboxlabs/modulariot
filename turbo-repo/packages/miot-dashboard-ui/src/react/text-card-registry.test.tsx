// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createTextCardRegistry } from "./text-card-registry";
import {
  PlannerResultsProvider,
  type PlannerContextValue,
} from "./planner-results";
import { createTemplateEngine } from "../templates";
import { WidgetRenderer } from "./widget-renderer";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
afterEach(cleanup);
const labels = {
  defaultText: "Text",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate data binding",
};
const widget = (config: Widget["config"]): Widget => ({
  id: "a",
  componentId: "text_card",
  layout: { i: "a", x: 0, y: 0, w: 4, h: 1 },
  config,
  createdAt: "2026-09-29",
  updatedAt: "2026-09-29",
});
const registry = createTextCardRegistry(labels);
it("renders static templates, providers and literal HTML without host components", () => {
  const view = render(
    <WidgetRenderer
      registry={registry}
      unknownWidgetLabel="Missing"
      widget={widget({
        text: "{{row.cost}} {{data_provider.unit}} <b>cost</b>",
        staticData: '{"cost":42}',
        dataProvider: [
          { key: "unit", value: "USD" },
          null,
          { key: "bad", value: 7 },
        ],
      })}
    />,
  );
  expect(screen.getByText("42 USD <b>cost</b>")).toBeTruthy();
  expect(view.container.querySelector("b")).toBeNull();
  expect(registry.get("text_card")?.meta.hasSettings).toBe(false);
  expect(registry.get("other")).toBeUndefined();
});
it("uses nearest planner results and clears output on failure or missing binding", () => {
  const value: PlannerContextValue = {
    results: new Map([
      ["costs", { rows: [{ cost: "42" }], loading: false, error: null }],
    ]),
    definitions: [],
    schemas: new Map(),
  };
  const card = (
    <WidgetRenderer
      registry={registry}
      unknownWidgetLabel="Missing"
      widget={widget({
        dataMode: "planner",
        plannerVariableName: "costs",
        text: "Cost {{cost}}",
      })}
    />
  );
  const view = render(
    <PlannerResultsProvider value={value}>{card}</PlannerResultsProvider>,
  );
  expect(screen.getByText("Cost 42")).toBeTruthy();
  view.rerender(
    <PlannerResultsProvider
      value={{
        ...value,
        results: new Map([
          ["costs", { rows: [], loading: false, error: "private details" }],
        ]),
      }}
    >
      {card}
    </PlannerResultsProvider>,
  );
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  expect(screen.queryByText("Cost 42")).toBeNull();
  view.rerender(card);
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
});
it("reports loading and unsupported direct-query modes explicitly", () => {
  const card = widget({
    dataMode: "planner",
    plannerVariableName: "costs",
    text: "{{cost}}",
  });
  const view = render(
    <PlannerResultsProvider
      value={{
        results: new Map([["costs", { rows: [], loading: true, error: null }]]),
        definitions: [],
        schemas: new Map(),
      }}
    >
      <WidgetRenderer
        registry={registry}
        unknownWidgetLabel="Missing"
        widget={card}
      />
    </PlannerResultsProvider>,
  );
  expect(screen.getByRole("status").textContent).toBe("Loading");
  view.rerender(
    <WidgetRenderer
      registry={registry}
      unknownWidgetLabel="Missing"
      widget={widget({ dataMode: "pgrest", text: "Do not fetch" })}
    />,
  );
  expect(screen.getByRole("alert").textContent).toBe("Migrate data binding");
});
it("isolates host helper engines between registries", () => {
  const first = createTextCardRegistry({
    ...labels,
    templateEngine: createTemplateEngine({ helpers: { label: () => "First" } }),
  });
  const second = createTextCardRegistry({
    ...labels,
    templateEngine: createTemplateEngine({
      helpers: { label: () => "Second" },
    }),
  });
  render(
    <>
      <WidgetRenderer
        registry={first}
        unknownWidgetLabel="Missing"
        widget={widget({ text: "{{label}}" })}
      />
      <WidgetRenderer
        registry={second}
        unknownWidgetLabel="Missing"
        widget={widget({ text: "{{label}}" })}
      />
    </>,
  );
  expect(screen.getByText("First")).toBeTruthy();
  expect(screen.getByText("Second")).toBeTruthy();
});
