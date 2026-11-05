import { expect, it, vi } from "vitest";
import type { QueryPlan } from "@microboxlabs/miot-dashboard-contract/authoring";
import {
  createQueryAuthoringClient,
  createQueryAuthoringRoute,
  QueryAuthoringError,
} from "./client";
import { formatBytes } from "./labels";
import { toCsv } from "./results-table";

const plan = {
  id: "daily/v1",
  revision: "r1",
} as QueryPlan;
const draft = {
  name: "Daily",
  projectId: "analytics-prod",
  location: "US",
  sql: "SELECT 1",
  maximumBytesBilled: 1000,
  parameters: [],
};

function setup(response?: Response) {
  const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
    if (response) return response.clone();
    if (String(url).includes("/schema?"))
      return Response.json({
        data: { projectId: "analytics-prod", datasets: [], truncated: false },
      });
    if (init?.method === "PUT")
      return Response.json({
        data: {
          ...draft,
          ...plan,
          sourceId: "warehouse",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      });
    return Response.json({ data: [] });
  });
  const client = createQueryAuthoringClient({
    route: createQueryAuthoringRoute({
      baseUrl: "/api/dashboard",
      tenantId: "acme",
      scopeId: "ops",
    }),
    fetch: fetchImpl,
    getToken: async () => "token",
  });
  return { client, fetchImpl };
}

it("addresses the query-source routes of one tenant and scope", async () => {
  const { client, fetchImpl } = setup();
  await client.listSources();
  await client.schema("ware house", "analytics-prod", { refresh: true });
  await client.updatePlan("warehouse", plan, draft);
  const calls = fetchImpl.mock.calls.map(([url, init]) => [
    init?.method ?? "GET",
    String(url),
  ]);
  expect(calls).toEqual([
    ["GET", "/api/dashboard/tenants/acme/scopes/ops/query-sources"],
    [
      "GET",
      "/api/dashboard/tenants/acme/scopes/ops/query-sources/ware%20house/schema?projectId=analytics-prod&refresh=1",
    ],
    [
      "PUT",
      "/api/dashboard/tenants/acme/scopes/ops/query-sources/warehouse/plans/daily%2Fv1",
    ],
  ]);
  const headers = fetchImpl.mock.calls[2]![1]!.headers as Record<
    string,
    string
  >;
  expect(headers["if-match"]).toBe('"r1"');
  expect(headers.authorization).toBe("Bearer token");
});

it("keeps the server's message on a failure", async () => {
  const { client } = setup(
    Response.json(
      { error: "Invalid query projectId: Invalid", status: 400 },
      { status: 400 },
    ),
  );
  const failure = await client.estimate("warehouse", draft).catch((e) => e);
  expect(failure).toBeInstanceOf(QueryAuthoringError);
  expect(failure).toMatchObject({
    status: 400,
    detail: "Invalid query projectId: Invalid",
  });
});

it("formats bytes in decimal units and rows as CSV", () => {
  expect(formatBytes(42_000_000, "en")).toBe("42 MB");
  expect(formatBytes(1_500, "en")).toBe("1.5 KB");
  expect(formatBytes(12, "en")).toBe("12 B");
  expect(
    toCsv({
      ok: true,
      columns: [
        { name: "name", type: "STRING" },
        { name: "n", type: "INT64" },
      ],
      rows: [
        { name: 'a, "b"', n: 1 },
        { name: null, n: 2 },
      ],
      totalRows: 2,
      truncated: false,
      totalBytesProcessed: 0,
      cacheHit: false,
      durationMs: 0,
      warnings: [],
    }),
  ).toBe('name,n\n"a, ""b""",1\n,2');
});

it("keeps a host proxy's query string on every route", async () => {
  const fetchImpl = vi.fn<typeof fetch>(async (_url, init) =>
    init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({
          data: { projectId: "analytics-prod", datasets: [], truncated: false },
        }),
  );
  const client = createQueryAuthoringClient({
    route: "/app/api/query-sources?org=acme",
    fetch: fetchImpl,
  });
  await client.schema("c1", "analytics-prod");
  await client.removePlan("c1", "p1");
  expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
    "/app/api/query-sources/c1/schema?org=acme&projectId=analytics-prod",
    "/app/api/query-sources/c1/plans/p1?org=acme",
  ]);
});

it.each(["schema", "listPlans", "preview", "estimate"] as const)(
  "rejects malformed successful %s responses at the API boundary",
  async (action) => {
    const { client } = setup(Response.json({ data: { wrong: true } }));
    const pending =
      action === "listPlans"
        ? client.listPlans("demo")
        : action === "schema"
          ? client.schema("demo", "demo-project")
          : client[action]("demo", draft);
    await expect(pending).rejects.toMatchObject({ status: 502 });
  },
);
it("neutralizes CSV formulas in strings and headers while retaining numeric values", () => {
  expect(
    toCsv({
      ok: true,
      columns: [
        { name: "=header", type: "STRING" },
        { name: "n", type: "INT64" },
      ],
      rows: [{ "=header": "=1+1", n: -7 }],
      totalRows: 1,
      truncated: false,
      totalBytesProcessed: 0,
      cacheHit: false,
      durationMs: 0,
      warnings: [],
    }),
  ).toBe("'=header,n\n'=1+1,-7");
});
