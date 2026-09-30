// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createDataTableRegistry } from "./data-table-registry";
import { WidgetRenderer } from "./widget-renderer";
import {
  PlannerResultsProvider,
  type PlannerQueryResult,
} from "./planner-results";
afterEach(cleanup);
const registry = createDataTableRegistry({
  defaultTitle: "Costs",
  loadingLabel: "Loading",
  errorLabel: "Unavailable",
  unsupportedDataLabel: "Migrate",
  emptyLabel: "No rows",
  actionsLabel: "Actions",
  allLabel: "All",
  sortLabel: "Sort",
  clearFilterLabel: "Clear",
  clearAllLabel: "Clear all",
  directionLabels: { asc: "Ascending", desc: "Descending" },
  filterLabels: {
    search: "Search",
    equals: "Equals",
    greaterThan: "Greater",
    lessThan: "Less",
    between: "Between",
    min: "Minimum",
    value: "Value",
    max: "Maximum",
    from: "From",
    to: "To",
    empty: "Empty",
    noMatches: "No matches",
    noValues: "No values",
    all: "All",
    yes: "Yes",
    no: "No",
    operator: "Operator",
  },
  filterTitle: (label) => `Filter ${label}`,
  filterSummary: (n, total) => `${n} of ${total}`,
  removeFilterLabel: (label) => `Remove ${label}`,
  formatFilterValue: (filter) => String(filter.value),
  rowCountLabel: (count) => `${count} rows`,
});
const columns = [
  { key: "{{row.service}}", label: "Service", type: "text" },
  { key: "{{row.cost}}", label: "Cost", type: "signed" },
];
const rows = [
  { service: "BQ", cost: "20", href: "java\nscript:alert(1)" },
  { service: "SQL", cost: "10", href: "/report" },
];
function Table({
  config,
  result,
}: {
  readonly config: Widget["config"];
  readonly result?: PlannerQueryResult;
}) {
  const widget: Widget = {
    id: "t",
    componentId: "data_table",
    config,
    layout: { i: "t", x: 0, y: 0, w: 8, h: 5 },
    createdAt: "2026-09-30",
    updatedAt: "2026-09-30",
  };
  return (
    <PlannerResultsProvider
      value={{
        results: result ? new Map([["costs", result]]) : new Map(),
        definitions: [],
        schemas: new Map(),
      }}
    >
      <WidgetRenderer
        registry={registry}
        widget={widget}
        unknownWidgetLabel="Unknown"
      />
    </PlannerResultsProvider>
  );
}
it("renders named saved-query rows and clears output during loading, error and missing binding", () => {
  const config = { columns, dataMode: "planner", plannerVariableName: "costs" };
  const view = render(
    <Table config={config} result={{ rows, loading: false, error: null }} />,
  );
  expect(screen.getByRole("table", { name: "Costs" })).toBeTruthy();
  expect(screen.getByRole("cell", { name: "BQ" })).toBeTruthy();
  view.rerender(
    <Table config={config} result={{ rows, loading: true, error: null }} />,
  );
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Loading");
  view.rerender(
    <Table config={config} result={{ rows, loading: false, error: "403" }} />,
  );
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  expect(screen.queryByText("BQ")).toBeNull();
  view.rerender(<Table config={config} />);
  expect(screen.queryByRole("table")).toBeNull();
});
it("composes static template cells, filters and numeric sort", () => {
  render(
    <Table
      config={{
        columns,
        rows,
        sort: { enabled: true, columns: ["{{row.cost}}"] },
        filter: {
          enabled: true,
          items: [{ column: "{{row.service}}", label: "Service" }],
        },
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Cost" }));
  expect(screen.getAllByRole("cell").map((e) => e.textContent)).toEqual([
    "SQL",
    "10",
    "BQ",
    "20",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "BQ" }));
  expect(screen.getAllByRole("cell").map((e) => e.textContent)).toEqual([
    "BQ",
    "20",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Filter Service" }),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "SQL" }));
  expect(screen.getByRole("cell", { name: "SQL" })).toBeTruthy();
  expect(screen.queryByRole("cell", { name: "BQ" })).toBeNull();
});
it("rechecks templated action destinations and rejects malformed or legacy bindings", () => {
  const view = render(
    <Table
      config={{
        columns,
        rows,
        actions: {
          enabled: true,
          items: [{ name: "Open", link: "{{row.href}}", target: "_blank" }],
        },
      }}
    />,
  );
  expect(
    screen.getAllByRole("button", { name: "Actions" }),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe(
    "/report",
  );
  view.rerender(<Table config={{ columns, rows, dataMode: "pgrest" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
  view.rerender(<Table config={{ columns: "invalid" }} />);
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
});

it("preserves static titles and action destinations", () => {
  render(
    <Table
      config={{
        columns,
        rows: [rows[1]!],
        title: "Billing report",
        actions: {
          enabled: true,
          items: [{ name: "Report", link: "/static-report", target: "_self" }],
        },
      }}
    />,
  );
  expect(screen.getByRole("table", { name: "Billing report" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  expect(
    screen.getByRole("link", { name: "Report" }).getAttribute("href"),
  ).toBe("/static-report");
});
