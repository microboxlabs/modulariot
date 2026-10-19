import { describe, expect, it } from "vitest";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";
import { plannerOperationContracts } from "./planner-contracts";

const dashboard = (
  requests: {
    id: string;
    fn: string;
    params: Record<string, string>;
    method?: "GET" | "POST";
  }[],
) => ({
  ...DEFAULT_STORAGE,
  requestPlanner: requests.map((r) => ({
    id: r.id,
    variableName: r.id,
    dataSourceId: "source-a",
    pgrestFunctionName: r.fn,
    pgrestHttpMethod: r.method ?? "GET",
    pgrestParams: Object.entries(r.params).map(([key, value]) => ({ key, value })),
  })),
});

describe("plannerOperationContracts", () => {
  it("merges parameters of one path across dashboards and pins the named literal", () => {
    const result = plannerOperationContracts(
      {
        one: dashboard([
          { id: "a", fn: "rpc/fn_summary", params: { p_client: "c1", p_dim: "dow" } },
        ]),
        two: dashboard([
          { id: "b", fn: "rpc/fn_summary", params: { p_client: "c1", p_from: "{{filter.date_range_from}}" } },
        ]),
      },
      { pinnedParameters: ["p_client"] },
    );
    expect(result).toEqual({
      ok: true,
      contracts: [
        {
          dataSourceId: "source-a",
          name: "fn_summary",
          method: "GET",
          path: "/rpc/fn_summary",
          requestSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              p_client: { type: "string", const: "c1" },
              p_dim: { type: "string", maxLength: 2048 },
              p_from: { type: "string", maxLength: 2048 },
            },
            required: ["p_client"],
            "x-dashboard": { readOnly: true, kind: "HTTP_GET", credentialScoped: true },
          },
          usedBy: ["one/a", "two/b"],
        },
      ],
    });
  });

  it.each([
    [{ one: dashboard([{ id: "a", fn: "rpc/fn", params: {}, method: "POST" }]) }],
    [{ one: dashboard([{ id: "a", fn: "rpc/../fn", params: {} }]) }],
    [
      {
        one: dashboard([
          { id: "a", fn: "rpc/fn", params: { p_client: "c1" } },
          { id: "b", fn: "rpc/fn", params: { p_client: "c2" } },
        ]),
      },
    ],
  ])("reports requests it cannot turn into a pinned GET operation", (input) => {
    const result = plannerOperationContracts(input, { pinnedParameters: ["p_client"] });
    expect(result.ok).toBe(false);
  });
});
