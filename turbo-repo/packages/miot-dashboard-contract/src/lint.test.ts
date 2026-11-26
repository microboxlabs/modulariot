import { describe, expect, it } from "vitest";

import type { DashboardQueryCatalogResponse } from "./catalog";
import type {
  DashboardFilterParam,
  DashboardQueryDefinition,
  DashboardStorageSchema,
  Widget,
} from "./document";
import {
  DASHBOARD_LINT_RULES,
  deliveredFilterNames,
  lintDashboardConfig,
  type DashboardProblem,
} from "./lint";

const stamp = "2026-01-01T00:00:00.000Z";

function widget(
  id: string,
  componentId: string,
  config: Record<string, unknown>,
  children?: Widget[],
): Widget {
  return {
    id,
    componentId,
    layout: { i: id, x: 0, y: 0, w: 6, h: 4 },
    config,
    ...(children ? { children } : {}),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

const dateFilter: DashboardFilterParam = {
  key: "fecha",
  label: "Date",
  type: "date_range",
};
const serviceFilter: DashboardFilterParam = {
  key: "service",
  label: "Service",
  type: "select",
};

const costs: DashboardQueryDefinition = {
  id: "costs",
  variableName: "costsByService",
  connectionId: "billing",
  operationId: "cost-summary",
  parameters: {
    days: { kind: "literal", value: 30 },
    from: { kind: "filter", key: "fecha_from" },
    to: { kind: "filter", key: "fecha_to" },
    service: { kind: "filter", key: "service", defaultValue: null },
  },
};

const chart = widget("costs-chart", "chart_v2", {
  title: "Costs",
  dataMode: "planner",
  plannerVariableName: "costsByService",
  chartFamily: "cartesian",
  xAxisColumn: "day",
  representations: [{ columnKey: "amount", label: "Amount", type: "bar" }],
});

/** A realistic, clean document. Every rule's passing case starts here. */
const clean: DashboardStorageSchema = {
  version: 2,
  name: "Costs",
  preferences: { editMode: false },
  filters: [dateFilter, serviceFilter],
  queries: [costs],
  widgets: [
    widget("row", "flex_container", {}, [chart]),
    widget("note", "text_card", { text: "Static" }),
  ],
};

const catalog: DashboardQueryCatalogResponse = {
  connections: [
    {
      id: "billing",
      label: "Billing",
      operations: [
        {
          id: "cost-summary",
          label: "Cost summary",
          schema: ["day", "service", "amount"],
          parameters: [{ name: "from", required: true }, { name: "to" }],
        },
      ],
    },
  ],
};

function rules(problems: readonly DashboardProblem[]) {
  return problems.map((problem) => problem.rule);
}

describe("deliveredFilterNames", () => {
  it("delivers the key for text and select", () => {
    expect(deliveredFilterNames({ key: "q", type: "text" })).toEqual(["q"]);
    expect(deliveredFilterNames(serviceFilter)).toEqual(["service"]);
  });
  it("delivers _from and _to for date_range, never the bare key", () => {
    expect(deliveredFilterNames(dateFilter)).toEqual([
      "fecha_from",
      "fecha_to",
    ]);
  });
});

describe("lintDashboardConfig", () => {
  it("finds nothing in a clean document, with or without a catalog", () => {
    expect(lintDashboardConfig(clean)).toEqual({ valid: true, problems: [] });
    expect(lintDashboardConfig(clean, catalog)).toEqual({
      valid: true,
      problems: [],
    });
  });

  it("gives each problem the severity of its rule", () => {
    const { problems } = lintDashboardConfig(
      { ...clean, filters: [...clean.filters!, { key: "x", label: "X", type: "text" }] },
      catalog,
    );
    for (const problem of problems) {
      expect(problem.severity).toBe(
        DASHBOARD_LINT_RULES[problem.rule as keyof typeof DASHBOARD_LINT_RULES],
      );
    }
  });

  describe("contract", () => {
    it("returns the zod issues as problems and applies no other rule", () => {
      const broken = {
        ...clean,
        filters: [dateFilter, dateFilter],
        widgets: [{ ...chart, layout: { ...chart.layout, x: "0" } }],
      };
      expect(lintDashboardConfig(broken)).toEqual({
        valid: false,
        problems: [
          {
            rule: "contract",
            path: "widgets.0.layout.x",
            message: "Expected number, received string",
            severity: "error",
          },
        ],
      });
    });
    it("reports a root problem with an empty path", () => {
      const { problems } = lintDashboardConfig(null);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatchObject({ rule: "contract", path: "" });
    });
  });

  describe("filter-key-unique", () => {
    it("flags the second filter with a key already used", () => {
      const { valid, problems } = lintDashboardConfig({
        ...clean,
        filters: [dateFilter, serviceFilter, { ...serviceFilter, type: "text" }],
      });
      expect(valid).toBe(false);
      expect(problems).toEqual([
        {
          rule: "filter-key-unique",
          path: "filters.2.key",
          message: 'Filter key "service" is already used by filters.1.',
          severity: "error",
        },
      ]);
    });
    it("accepts distinct keys", () => {
      expect(rules(lintDashboardConfig(clean).problems)).not.toContain(
        "filter-key-unique",
      );
    });
  });

  describe("query-id-unique", () => {
    it("flags the second query with an id already used", () => {
      const { problems } = lintDashboardConfig({
        ...clean,
        queries: [costs, { ...costs, variableName: "other" }],
      });
      expect(problems).toEqual([
        expect.objectContaining({
          rule: "query-id-unique",
          path: "queries.1.id",
          severity: "error",
        }),
      ]);
    });
    it("accepts distinct ids", () => {
      const { problems } = lintDashboardConfig({
        ...clean,
        queries: [costs, { ...costs, id: "costs-2", variableName: "other" }],
      });
      expect(problems).toEqual([]);
    });
  });

  describe("filter-binding", () => {
    it("flags a binding to a key no filter delivers, listing the delivered names", () => {
      const { valid, problems } = lintDashboardConfig({
        ...clean,
        queries: [
          {
            ...costs,
            parameters: {
              ...costs.parameters,
              asset: { kind: "filter", key: "asset_id" },
            },
          },
        ],
      });
      expect(valid).toBe(false);
      expect(problems).toEqual([
        {
          rule: "filter-binding",
          path: "queries.0.parameters.asset.key",
          message:
            'Parameter "asset" of query "costs" is bound to filter "asset_id", which no filter delivers. Delivered names: "fecha_from", "fecha_to", "service".',
          severity: "error",
        },
      ]);
    });
    it("says none when the document has no filters", () => {
      const { problems } = lintDashboardConfig({
        ...clean,
        filters: undefined,
        queries: [{ ...costs, parameters: { q: { kind: "filter", key: "q" } } }],
      });
      expect(problems[0]?.message).toContain("Delivered names: none.");
    });
    it("accepts bindings to delivered names and literal parameters", () => {
      expect(rules(lintDashboardConfig(clean).problems)).not.toContain(
        "filter-binding",
      );
    });
  });

  describe("date-range-binding", () => {
    it("flags a binding to the bare key of a date_range filter, naming _from and _to", () => {
      const { valid, problems } = lintDashboardConfig({
        ...clean,
        queries: [
          {
            ...costs,
            parameters: { day: { kind: "filter", key: "fecha" } },
          },
        ],
        filters: [dateFilter],
      });
      expect(valid).toBe(false);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatchObject({
        rule: "date-range-binding",
        path: "queries.0.parameters.day.key",
        severity: "error",
      });
      expect(problems[0]?.message).toContain('"fecha_from"');
      expect(problems[0]?.message).toContain('"fecha_to"');
    });
    it("accepts a binding to fecha_from", () => {
      expect(
        lintDashboardConfig({
          ...clean,
          queries: [
            {
              ...costs,
              parameters: { day: { kind: "filter", key: "fecha_from" } },
            },
          ],
          filters: [dateFilter],
        }),
      ).toEqual({ valid: true, problems: [] });
    });
  });

  describe("widget-query", () => {
    it("flags a planner widget, nested in a container, whose variable no query defines", () => {
      const stale = widget("stale", "chart", {
        dataMode: "planner",
        plannerVariableName: "removedQuery",
      });
      const { valid, problems } = lintDashboardConfig({
        ...clean,
        widgets: [widget("row", "flex_container", {}, [chart, stale])],
      });
      expect(valid).toBe(false);
      expect(problems).toEqual([
        {
          rule: "widget-query",
          path: "widgets.0.children.1.config.plannerVariableName",
          message:
            'Widget "stale" reads query "removedQuery", which no query defines. Query variables: "costsByService".',
          severity: "error",
        },
      ]);
    });
    it("flags a planner widget that names no query", () => {
      const { problems } = lintDashboardConfig({
        ...clean,
        widgets: [widget("table", "data_table", { dataMode: "planner" })],
      });
      expect(rules(problems)).toEqual(["widget-query"]);
    });
    it("accepts query and legacy planner variables, and static widgets", () => {
      const legacy = widget("legacy", "data_table", {
        dataMode: "planner",
        plannerVariableName: "assets",
      });
      const fixed = widget("fixed", "chart", {
        dataMode: "static",
        plannerVariableName: "nothing",
      });
      expect(
        lintDashboardConfig({
          ...clean,
          requestPlanner: [
            {
              id: "assets",
              variableName: "assets",
              pgrestFunctionName: "assets",
              pgrestHttpMethod: "GET",
              pgrestParams: [],
            },
          ],
          widgets: [chart, legacy, fixed],
        }).problems,
      ).toEqual([]);
    });
  });

  describe("operation-exists", () => {
    it("flags an unknown connection and an unknown operation", () => {
      const { valid, problems } = lintDashboardConfig(
        {
          ...clean,
          queries: [
            costs,
            { ...costs, id: "a", variableName: "a", connectionId: "gone" },
            { ...costs, id: "b", variableName: "b", operationId: "gone" },
          ],
        },
        catalog,
      );
      expect(valid).toBe(false);
      expect(problems).toEqual([
        expect.objectContaining({
          rule: "operation-exists",
          path: "queries.1.connectionId",
        }),
        expect.objectContaining({
          rule: "operation-exists",
          path: "queries.2.operationId",
        }),
      ]);
    });
    it("does not run without a catalog", () => {
      expect(
        lintDashboardConfig({
          ...clean,
          queries: [{ ...costs, connectionId: "gone" }],
        }).problems,
      ).toEqual([]);
    });
    it("accepts operations the catalog lists", () => {
      expect(rules(lintDashboardConfig(clean, catalog).problems)).not.toContain(
        "operation-exists",
      );
    });
  });

  describe("filter-unused", () => {
    it("warns about a filter no query reads, and stays valid", () => {
      const { valid, problems } = lintDashboardConfig({
        ...clean,
        filters: [...clean.filters!, { key: "region", label: "Region", type: "date_range" }],
      });
      expect(valid).toBe(true);
      expect(problems).toEqual([
        {
          rule: "filter-unused",
          path: "filters.2",
          message:
            'Filter "region" delivers "region_from", "region_to", and no query reads any of them.',
          severity: "warning",
        },
      ]);
    });
    it("counts a date_range filter as read when only one of its names is", () => {
      const { problems } = lintDashboardConfig({
        ...clean,
        queries: [
          {
            ...costs,
            parameters: {
              from: { kind: "filter", key: "fecha_from" },
              service: { kind: "filter", key: "service" },
            },
          },
        ],
      });
      expect(problems).toEqual([]);
    });
    it("counts {{filter.x}} templates in legacy planner parameters as reads", () => {
      const { problems } = lintDashboardConfig({
        ...clean,
        queries: [],
        widgets: [],
        requestPlanner: [
          {
            id: "trips",
            variableName: "trips",
            pgrestFunctionName: "trips",
            pgrestHttpMethod: "GET",
            pgrestParams: [
              { key: "created_at", value: "gte.{{filter.fecha_from}}" },
              { key: "service", value: "{{#if filter.service}}eq.{{filter.service}}{{/if}}" },
            ],
          },
        ],
      });
      expect(problems).toEqual([]);
    });
  });

  describe("column-exists", () => {
    it("warns about chart columns the operation does not return", () => {
      const legacyChart = widget("legacy-chart", "chart", {
        dataMode: "planner",
        plannerVariableName: "costsByService",
        xAxisColumn: "date",
        series: [
          { columnKey: "amount", label: "Amount" },
          { columnKey: "total", label: "Total" },
        ],
      });
      const { valid, problems } = lintDashboardConfig(
        { ...clean, widgets: [legacyChart] },
        catalog,
      );
      expect(valid).toBe(true);
      expect(problems).toEqual([
        {
          rule: "column-exists",
          path: "widgets.0.config.xAxisColumn",
          message:
            'Widget "legacy-chart" uses column "date", which operation "billing/cost-summary" does not return. Columns: "day", "service", "amount".',
          severity: "warning",
        },
        expect.objectContaining({
          rule: "column-exists",
          path: "widgets.0.config.series.1.columnKey",
        }),
      ]);
    });
    it("checks the representations of chart_v2, not its leftover series", () => {
      const v2 = widget("v2", "chart_v2", {
        dataMode: "planner",
        plannerVariableName: "costsByService",
        xAxisColumn: "day",
        series: [{ columnKey: "leftover", label: "Old" }],
        representations: [{ columnKey: "missing", label: "M", type: "line" }],
      });
      const { problems } = lintDashboardConfig({ ...clean, widgets: [v2] }, catalog);
      expect(problems.map((problem) => problem.path)).toEqual([
        "widgets.0.config.representations.0.columnKey",
      ]);
    });
    it("skips tables, operations without a schema, and runs without a catalog", () => {
      const table = widget("table", "data_table", {
        dataMode: "planner",
        plannerVariableName: "costsByService",
        columns: [{ key: "{{service}} / {{day}}", label: "Both" }],
      });
      const stale = widget("stale", "chart", {
        dataMode: "planner",
        plannerVariableName: "costsByService",
        xAxisColumn: "nope",
      });
      const withoutSchema: DashboardQueryCatalogResponse = {
        connections: [
          {
            id: "billing",
            label: "Billing",
            operations: [{ id: "cost-summary", label: "Cost summary" }],
          },
        ],
      };
      expect(
        lintDashboardConfig({ ...clean, widgets: [table] }, catalog).problems,
      ).toEqual([]);
      expect(
        lintDashboardConfig({ ...clean, widgets: [stale] }, withoutSchema)
          .problems,
      ).toEqual([]);
      expect(lintDashboardConfig({ ...clean, widgets: [stale] }).problems).toEqual(
        [],
      );
    });
    it("accepts columns the operation returns", () => {
      expect(rules(lintDashboardConfig(clean, catalog).problems)).not.toContain(
        "column-exists",
      );
    });
  });
});
