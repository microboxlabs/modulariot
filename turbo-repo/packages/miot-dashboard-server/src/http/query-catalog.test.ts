import { expect, it, vi } from "vitest";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";
import { createDashboardHandler } from "./handler";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryStore,
  createMemoryScopeAuthority,
  createMemoryTenantAuthority,
} from "../testing";
import { projectQueryCatalog } from "./query-catalog";
const path =
  "https://dashboard.test/tenants/acme/scopes/ops/dashboards/costs/query-catalog";
const connection = {
  id: "billing",
  label: "Billing",
  operations: [{ id: "costs", label: "Costs", schema: ["service", "cost"] }],
};
function setup() {
  const memberships = {
    acme: { ops: { editor: "Editor" as const, viewer: "Consumer" as const } },
  };
  const list = vi
    .fn()
    .mockResolvedValue([
      {
        ...connection,
        credentialRef: "secret",
        baseUrl: "private",
        operations: [{ ...connection.operations[0], sql: "private SQL" }],
      },
    ]);
  const options = {
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    store: createMemoryStore({
      seed: [
        {
          ref: { tenantId: "acme", scopeId: "ops", slug: "costs" },
          record: { config: DEFAULT_STORAGE },
        },
      ],
    }),
    queryCatalog: { list },
  };
  return { list, options, handler: createDashboardHandler(options) };
}
const request = (user: string, url = path) =>
  new Request(url, { headers: { "x-dev-user": user } });
it("authorizes before discovery and copies only public metadata", async () => {
  const { list, handler } = setup();
  expect((await handler(request(""))).status).toBe(401);
  expect((await handler(request("viewer"))).status).toBe(403);
  expect(
    (await handler(request("editor", path.replace("acme", "foreign")))).status,
  ).toBe(403);
  expect(
    (await handler(request("editor", path.replace("costs", "missing")))).status,
  ).toBe(404);
  expect(list).not.toHaveBeenCalled();
  const response = await handler(request("editor"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({ connections: [connection] });
  expect(list.mock.lastCall?.[0]).toMatchObject({
    identity: { userId: "editor", tenantId: "acme" },
    ref: { tenantId: "acme", scopeId: "ops", slug: "costs" },
    signal: expect.any(AbortSignal),
  });
});
it("fails closed for disabled or invalid providers and redacts provider errors", async () => {
  const { list, options, handler } = setup();
  expect(
    (
      await createDashboardHandler({ ...options, queryCatalog: undefined })(
        request("editor"),
      )
    ).status,
  ).toBe(404);
  list.mockRejectedValueOnce(new Error("private token"));
  const response = await handler(request("editor"));
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private token");
  list.mockResolvedValueOnce([connection, connection]);
  expect((await handler(request("editor"))).status).toBe(500);
  expect(() =>
    projectQueryCatalog([
      { ...connection, operations: [{ id: "", label: "invalid" }] },
    ]),
  ).toThrow();
  expect(() => projectQueryCatalog(Array(101).fill(connection))).toThrow();
});

it("serves authorized metadata through the standalone Node adapter", async () => {
  const { serve } = await import("../server/serve");
  const { options } = setup();
  const running = await serve({ ...options, host: "127.0.0.1", port: 0, log: () => {} });
  try {
    const response = await fetch(running.url + new URL(path).pathname, { headers: { "x-dev-user": "editor" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connections: [connection] });
  } finally {
    await running.close();
  }
});
