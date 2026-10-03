// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createInfoCardRegistry } from "./info-card-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createInfoCardRegistry({
  defaultTitle: "Metric",
  addDetailLabel: "Add detail",
  viewMoreLabel: "View",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
});
const widget = (config: Widget["config"]): Widget => ({
  id: "info",
  componentId: "info_card",
  config,
  layout: { i: "info", x: 0, y: 0, w: 4, h: 4 },
  createdAt: "2026-09-30",
  updatedAt: "2026-09-30",
});
it("resolves provider templates, colors and web links with authorized child actions", () => {
  const onAction = vi.fn();
  const config = {
    staticData: '{"amount":42}',
    dataProvider: [{ key: "label", value: "Provider" }],
    title: "{{data_provider.label}}",
    value: "{{amount}}",
    viewMoreUrl: "/report",
    valueColorRules: {
      rules: [
        {
          operator: "greater_than",
          value: "30",
          color: "ff0000",
          targets: ["text"],
        },
      ],
    },
  };
  const view = render(
    <WidgetRenderer
      registry={registry}
      widget={widget(config)}
      unknownWidgetLabel="Unknown"
      editMode
      onAction={onAction}
    />,
  );
  expect(screen.getByRole("article", { name: "Provider" })).toBeTruthy();
  expect(screen.getByText("42").style.color).toBe("rgb(255, 0, 0)");
  expect(screen.getByRole("link").getAttribute("href")).toBe("/report");
  fireEvent.click(screen.getByRole("button", { name: "Add detail" }));
  expect(onAction).toHaveBeenCalledWith(expect.anything(), "add", "info_card");
  view.rerender(
    <WidgetRenderer
      registry={registry}
      widget={{
        ...widget(config),
        children: [{ ...widget({ title: "Child", value: "7" }), id: "child" }],
      }}
      unknownWidgetLabel="Unknown"
    />,
  );
  expect(screen.getByRole("article", { name: "Child" })).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
it("clears saved-query card and navigation on loading or denial", () => {
  const card = (
    <WidgetRenderer
      registry={registry}
      widget={widget({
        dataMode: "planner",
        plannerVariableName: "costs",
        value: "{{cost}}",
        viewMoreUrl: "{{href}}",
      })}
      unknownWidgetLabel="Unknown"
    />
  );
  const wrap = (loading: boolean, error: string | null) => (
    <PlannerResultsProvider
      value={{
        results: new Map([
          [
            "costs",
            { rows: [{ cost: "42", href: "/report" }], loading, error },
          ],
        ]),
        definitions: [],
        schemas: new Map(),
      }}
    >
      {card}
    </PlannerResultsProvider>
  );
  const view = render(wrap(false, null));
  expect(screen.getByText("42")).toBeTruthy();
  view.rerender(wrap(true, null));
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByText("Loading")).toBeTruthy();
  view.rerender(wrap(false, "Denied"));
  expect(screen.queryByText("42")).toBeNull();
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
});
