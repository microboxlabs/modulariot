import { expect, it, vi } from "vitest";
import { createDashboardClient } from "../client";
const connection = { id: "billing", label: "Billing", operations: [{ id: "costs", label: "Costs", schema: ["service"] }] };
function setup(body: object, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));
  const client = createDashboardClient({ routes: { dashboards: "/api/dashboards?org=acme", scopeCapabilities: "/api/capabilities" }, fetch: fetcher });
  return { client, fetcher };
}
it("preserves scope routing/cancellation and returns only projected authoring metadata", async () => {
  const { client, fetcher } = setup({ connections: [{ ...connection, credentialRef: "secret", operations: [{ ...connection.operations[0], sql: "private" }] }] });
  const controller = new AbortController();
  expect(await client.queryCatalog("sales/east", controller.signal)).toEqual([connection]);
  expect(fetcher.mock.lastCall?.[0]).toBe("/api/dashboards/sales%2Feast/query-catalog?org=acme");
  expect(fetcher.mock.lastCall?.[1]).toMatchObject({ signal: controller.signal, cache: "no-store", credentials: "omit" });
});
it.each([
  { connections: [connection, connection] },
  { connections: [{ ...connection, operations: [connection.operations[0], connection.operations[0]] }] },
  { connections: [{ ...connection, id: " " }] },
  { connections: Array(101).fill(connection) },
  { connections: [{ ...connection, operations: [{ id: "costs", label: "Costs", schema: [42] }] }] },
])("rejects malformed or ambiguous catalog data", async (body) => {
  await expect(setup(body).client.queryCatalog("sales")).rejects.toMatchObject({ status: 502 });
});
it.each([401,403,404])("preserves catalog denial status %i", async (status) => {
  await expect(setup({ error: "denied" },status).client.queryCatalog("sales")).rejects.toMatchObject({ status });
});
