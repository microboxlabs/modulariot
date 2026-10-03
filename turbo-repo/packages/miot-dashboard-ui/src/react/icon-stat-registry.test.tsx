// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createIconStatRegistry } from "./icon-stat-registry";
import { WidgetRenderer } from "./widget-renderer";
import { PlannerResultsProvider } from "./planner-results";
afterEach(cleanup);
const registry = createIconStatRegistry({
  defaultTitle: "Cost",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
  renderIcon: (name) => <span>{name}</span>,
  formatValue: (value) => value.toFixed(2),
});
function Card({
  config,
  editMode = false,
}: {
  readonly config: Widget["config"];
  readonly editMode?: boolean;
}) {
  const widget: Widget = {
    id: "i",
    componentId: "stat_icon",
    config,
    layout: { i: "i", x: 0, y: 0, w: 3, h: 2 },
    createdAt: "2026-09-30",
    updatedAt: "2026-09-30",
  };
  return (
    <WidgetRenderer
      registry={registry}
      widget={widget}
      editMode={editMode}
      onAction={vi.fn()}
      unknownWidgetLabel="Unknown"
    />
  );
}
it("resolves data and safe links with targeted color rules and scalable layout", () => {
  const config = {
    title: "{{service}}",
    value: "{{cost}}",
    unit: "USD",
    subtitle: "<img src=x>",
    staticData: '{"service":"Cloud SQL","cost":42}',
    icon: "database",
    cardVariant: "vertical",
    expandable: true,
    showGoTo: true,
    goToUrl: "reports/costs",
    showBgColor: true,
    bgColor: "0000ff",
    valueColorRules: {
      rules: [
        {
          operator: "greater_than",
          value: "10",
          color: "ff0000",
          targets: ["text", "icon"],
        },
      ],
    },
  };
  const view = render(<Card config={config} />);
  expect(screen.getByRole("link").getAttribute("href")).toBe("/reports/costs");
  const card = screen.getByRole("article", { name: "Cloud SQL" });
  expect(card.dataset.scalable).toBe("true");
  expect(card.dataset.variant).toBe("vertical");
  expect(card.querySelector("strong")?.textContent).toBe("42.00USD");
  expect(card.querySelector("strong")?.style.color).toBe("rgb(255, 0, 0)");
  expect(card.style.backgroundColor).toBe("rgba(0, 0, 255, 0.8)");
  expect(screen.getByText("database")).toBeTruthy();
  expect(card.querySelector("img")).toBeNull();
  view.rerender(<Card config={config} editMode />);
  expect(screen.queryByRole("link")).toBeNull();
});
it.each(["javascript:alert(1)", "java\tscript:alert(1)", "data:text/html,bad"])(
  "rejects unsafe destination %s and invalid colors",
  (url) => {
    const view = render(
      <Card
        config={{
          value: "Infinity",
          showGoTo: true,
          goToUrl: url,
          showValueColor: true,
          valueColor: "url(secret)",
          showIcon: false,
        }}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(view.container.querySelector("strong")?.textContent).toBe("0.00");
    expect(view.container.querySelector("strong")?.style.color).toBe("");
    expect(screen.queryByText("cart")).toBeNull();
  },
);
it("clears saved-query values and navigation during loading, failure and migration", () => {
  const config = {
    dataMode: "planner",
    plannerVariableName: "costs",
    value: "{{cost}}",
    showGoTo: true,
    goToUrl: "/report",
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
  expect(screen.getByText("Loading")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
  view.rerender(wrap(false, "Denied"));
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  expect(screen.queryByRole("article")).toBeNull();
  view.rerender(<Card config={{ dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
});
