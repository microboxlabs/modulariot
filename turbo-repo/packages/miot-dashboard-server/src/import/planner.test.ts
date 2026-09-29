import { describe, expect, it } from "vitest";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";
import { migratePlannerQueries, type PlannerQueryMapping } from "./planner";

const request = {
  id: "summary",
  variableName: "fleet_summary",
  dataSourceId: "legacy-reference",
  pgrestFunctionName: "rpc/old_summary",
  pgrestHttpMethod: "GET" as const,
  pgrestParams: [{ key: "tenant", value: "legacy-tenant" }],
  schema: ["count"],
};
const source = () => ({
  ...DEFAULT_STORAGE,
  requestPlanner: [request],
  filters: [{ key: "asset", label: "Asset", type: "text" as const }],
  allowedGroups: ["ops"],
  customMetadata: { owner: "team" },
});
const mapping: PlannerQueryMapping = {
  plannerId: "summary",
  connectionId: "fleet",
  operationId: "summary",
  parameters: { asset: { kind: "filter", key: "asset", defaultValue: null } },
};

describe("migratePlannerQueries", () => {
  it("preserves document settings and variable names without carrying legacy execution fields", () => {
    const input = source();
    const before = JSON.stringify(input);
    const result = migratePlannerQueries(input, [mapping]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toEqual({
      ...input,
      requestPlanner: undefined,
      queries: [
        {
          id: "summary",
          variableName: "fleet_summary",
          connectionId: "fleet",
          operationId: "summary",
          parameters: mapping.parameters,
          schema: ["count"],
        },
      ],
    });
    expect(Object.hasOwn(result.config, "requestPlanner")).toBe(false);
    expect(JSON.stringify(result.config)).not.toContain("legacy-");
    expect(JSON.stringify(input)).toBe(before);
    result.config.queries![0]!.parameters.asset = {
      kind: "literal",
      value: "changed",
    };
    expect(mapping.parameters.asset).toEqual({
      kind: "filter",
      key: "asset",
      defaultValue: null,
    });
  });

  it.each([
    { mappings: [] },
    { mappings: [mapping, mapping] },
    { mappings: [{ ...mapping, plannerId: "unknown" }] },
    { mappings: [mapping, { ...mapping, plannerId: "extra" }] },
  ])("refuses incomplete, duplicate or unrelated mappings", ({ mappings }) => {
    expect(migratePlannerQueries(source(), mappings).ok).toBe(false);
  });

  it.each([
    { ...source(), requestPlanner: [request, request] },
    { ...source(), requestPlanner: [request, { ...request, id: "other" }] },
    {
      ...source(),
      queries: [
        {
          id: "existing",
          variableName: "existing",
          connectionId: "c",
          operationId: "o",
          parameters: {},
        },
      ],
    },
    { ...source(), preferences: null },
    { ...source(), requestPlanner: [] },
  ])("refuses ambiguous or invalid source documents", (input) => {
    expect(migratePlannerQueries(input, [mapping]).ok).toBe(false);
  });

  it("validates catalog identifiers in the converted contract", () => {
    const result = migratePlannerQueries(source(), [
      { ...mapping, connectionId: "" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.problems.join()).toContain("queries.0.connectionId");
  });

  it("preserves source order when mappings are supplied in another order", () => {
    const result = migratePlannerQueries(
      {
        ...source(),
        requestPlanner: [
          request,
          { ...request, id: "details", variableName: "details" },
        ],
      },
      [{ ...mapping, plannerId: "details" }, mapping],
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.config.queries?.map((q) => q.id)).toEqual([
        "summary",
        "details",
      ]);
  });
});
