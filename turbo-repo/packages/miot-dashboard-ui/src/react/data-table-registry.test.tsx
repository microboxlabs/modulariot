// @vitest-environment jsdom
import { within, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import {
  createDataTableRegistry,
  createDataListRegistry,
  createResizableDataTableRegistry,
  type DataTableRegistryOptions,
} from "./data-table-registry";
import { WidgetRenderer } from "./widget-renderer";
import {
  PlannerResultsProvider,
  type PlannerQueryResult,
} from "./planner-results";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const exportCsv = vi.fn();
const options: DataTableRegistryOptions = {
  defaultTitle: "Costs",
  exportLabel: "Export CSV",
  onExportCsv: exportCsv,
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
};
const registry = createDataTableRegistry(options);
const listRegistry = createDataListRegistry(options);
const resizableRegistry = createResizableDataTableRegistry({
  ...options,
  resizeLabel: (label) => `Resize ${label}`,
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
  resizable = false,
  list = false,
}: {
  readonly config: Widget["config"];
  readonly resizable?: boolean;
  readonly list?: boolean;
  readonly result?: PlannerQueryResult;
}) {
  const basicType = list ? "data_list" : "data_table";
  const basicRegistry = list ? listRegistry : registry;
  const widget: Widget = {
    id: "t",
    componentId: resizable ? "data_table_v2" : basicType,
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
        registry={resizable ? resizableRegistry : basicRegistry}
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
  fireEvent.click(screen.getByRole("button", { name: "Filter Service" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "SQL" }));
  expect(screen.getByRole("cell", { name: "SQL" })).toBeTruthy();
  expect(screen.queryByRole("cell", { name: "BQ" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  expect(exportCsv).toHaveBeenCalledWith("Service;Cost\nSQL;10", "Costs.csv");
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
  expect(screen.getAllByRole("button", { name: "Actions" })).toHaveLength(1);
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

it("keeps duplicate-column filter pills distinct across updates", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const config = {
      columns,
      rows,
      filter: {
        enabled: true,
        items: [
          { column: "{{row.service}}", label: "Primary" },
          { column: "{{row.service}}", label: "Secondary" },
        ],
      },
    };
    const view = render(<Table config={config} />);
    expect(screen.getByRole("group", {name: "Primary"})).toBeTruthy();
    expect(screen.getByRole("group", {name: "Secondary"})).toBeTruthy();
    view.rerender(
      <Table
        config={{
          ...config,
          filter: { ...config.filter, items: [config.filter.items[1]!] },
        }}
      />,
    );
    expect(screen.queryByRole("group", {name: "Primary"})).toBeNull();
    expect(screen.getByRole("group", {name: "Secondary"})).toBeTruthy();
    expect(errors).not.toHaveBeenCalled();
  } finally {
    errors.mockRestore();
  }
});
it("renders saved resizable dashboards with header sorting and safe row actions", () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === "TABLE" ? 600 : 100;
    },
  );
  const view = render(
    <Table
      resizable
      config={{
        columns,
        rows,
        striped: true,
        sort: { enabled: true, columns: ["{{row.cost}}"] },
        columnWidths: { "{{row.service}}": 160 },
        rowActions: [
          {
            method: "goto",
            name: "Report",
            link: "{{row.href}}",
            target: "_self",
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole("table").style.tableLayout).toBe("fixed");
  expect(view.container.querySelector("col")?.style.width).toBe("160px");
  expect(screen.getByRole("button", { name: "Resize Service" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Resize Cost" })).toBeNull();
  expect(screen.getAllByRole("link", { name: "Report" })).toHaveLength(1);
  expect(
    screen.getByRole("link", { name: "Report" }).getAttribute("href"),
  ).toBe("/report");
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Cost" }));
  expect(screen.getAllByRole("row")[1]?.textContent).toContain("SQL");
  view.rerender(
    <Table
      resizable
      config={{ columns, rows, columnWidths: { "{{row.service}}": -1 } }}
    />,
  );
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  vi.restoreAllMocks();

});

it("honors disabled sorting and limits header sorting to configured columns", () => {
 const view=render(<Table resizable config={{columns,rows,sort:{enabled:false,columns:["{{row.cost}}"]}}}/>);
 expect(screen.queryByRole("button",{name:"Cost"})).toBeNull();
 view.rerender(<Table resizable config={{columns,rows,sort:{enabled:true,columns:["{{row.cost}}"]}}}/>);
 expect(within(screen.getByRole("table")).getByRole("button",{name:"Cost"})).toBeTruthy();
 expect(screen.queryByRole("button",{name:"Service"})).toBeNull();
});
const cardLayout = {
  titleColumn: "{{row.service}}",
  subtitleColumn: "",
  headerBadgeColumns: [],
  kpiColumns: ["{{row.cost}}"],
  footerColumns: [],
};
it("renders saved-query lists, filters cards and clears them on permission errors", () => {
  const config = {
    columns,
    cardLayout,
    dataMode: "planner",
    plannerVariableName: "costs",
    filter: {
      enabled: true,
      items: [{ column: "{{row.service}}", label: "Service" }],
    },
  };
  const view = render(
    <Table
      list
      config={config}
      result={{ rows, loading: false, error: null }}
    />,
  );
  expect(screen.getAllByRole("article")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "SQL" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("article", { name: "SQL" }).textContent).toContain(
    "10",
  );
  fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  expect(exportCsv).toHaveBeenCalledWith("Service;Cost\nSQL;10", "Costs.csv");
  view.rerender(
    <Table
      list
      config={config}
      result={{ rows, loading: false, error: "403" }}
    />,
  );
  expect(screen.queryByRole("article")).toBeNull();
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
});
it("requires explicit list layout and rejects arbitrary legacy URLs", () => {
  const view = render(<Table list config={{ columns, rows }} />);
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  view.rerender(
    <Table
      list
      config={{
        columns,
        rows,
        cardLayout,
        dataMode: "dynamic",
        apiUrl: "https://example.com/private",
      }}
    />,
  );
  expect(screen.getByRole("alert").textContent).toBe("Migrate");
  expect(screen.queryByRole("article")).toBeNull();
});
