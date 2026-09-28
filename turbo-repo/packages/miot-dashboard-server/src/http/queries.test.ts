import { describe, expect, it, vi } from "vitest";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";
import { createDashboardHandler } from "./handler";
import { matchRoute } from "./routes";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryStore,
  createMemoryTenantAuthority,
  createMemoryScopeAuthority,
} from "../testing";
import type { DashboardOperationExecutor } from "../seams/operations";
import { serve } from "../server/serve";

const ref = { tenantId: "acme", scopeId: "ops", slug: "costs" };
const path = "/tenants/acme/scopes/ops/dashboards/costs/queries/by-service";
function setup() {
  const memberships = { acme: { ops: { viewer: "Consumer" as const } } };
  const execute = vi
    .fn<DashboardOperationExecutor["execute"]>()
    .mockResolvedValue({ rows: [{ cost: 10 }] });
  const options = {
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    store: createMemoryStore({
      seed: [
        {
          ref,
          record: {
            config: {
              ...DEFAULT_STORAGE,
              queries: [
                {
                  id: "by-service",
                  variableName: "costs",
                  connectionId: "billing",
                  operationId: "summary",
                  parameters: {
                    service: {
                      kind: "filter",
                      key: "service",
                      defaultValue: null,
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    }),
    queries: { operations: { execute } },
  };
  return { options, execute, handler: createDashboardHandler(options) };
}
function request(body: string, user = "viewer", route = path) {
  return new Request(`https://dashboard.test${route}`, {
    method: "POST",
    headers: { "x-dev-user": user, "content-type": "application/json" },
    body,
  });
}

describe("saved query HTTP route", () => {
  it("runs a saved operation and returns a private response", async () => {
    const { handler, execute } = setup();
    const response = await handler(
      request('{"filters":{"service":"storage"}}'),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { rows: [{ cost: 10 }] } });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(execute.mock.lastCall?.[0].parameters).toEqual({
      service: "storage",
    });
  });

  it("authorizes before decoding malformed bodies", async () => {
    const { handler, execute } = setup();
    expect((await handler(request("not JSON", ""))).status).toBe(401);
    expect((await handler(request("not JSON", "outsider"))).status).toBe(403);
    expect((await handler(request("not JSON"))).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    '{"operationId":"other"}',
    '{"sql":"SELECT secret"}',
    "null",
    "[]",
    '{"filters":null}',
  ])("refuses operation overrides or malformed filters %s", async (body) => {
    const { handler, execute } = setup();
    expect((await handler(request(body))).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("uses default bindings for an empty filter envelope", async () => {
    const { handler, execute } = setup();
    expect((await handler(request("{}"))).status).toBe(200);
    expect(execute.mock.lastCall?.[0].parameters).toEqual({ service: null });
  });

  it("is opt-in, POST-only, and refuses unknown queries", async () => {
    const { options, handler } = setup();
    const disabled = createDashboardHandler({ ...options, queries: undefined });
    expect((await disabled(request("{}"))).status).toBe(404);
    expect(
      (await handler(new Request(`https://dashboard.test${path}`))).status,
    ).toBe(404);
    expect(
      (
        await handler(
          request("{}", "viewer", path.replaceAll("by-service", "unknown")),
        )
      ).status,
    ).toBe(404);
  });

  it("bounds the query body in embedded handlers", async () => {
    const { options, execute } = setup();
    expect(
      (
        await createDashboardHandler({ ...options, maxBodyBytes: 5 })(
          request('{"filters":{}}'),
        )
      ).status,
    ).toBe(413);
    expect(execute).not.toHaveBeenCalled();
  });

  it("decodes query identifiers without accepting traversal", () => {
    expect(matchRoute(path.replaceAll("by-service", "by%2Fservice"))?.id).toBe(
      "by/service",
    );
    expect(matchRoute(path.replaceAll("by-service", "%2E%2E"))).toBeNull();
    expect(matchRoute(path.replaceAll("by-service", "%ZZ"))).toBeNull();
    expect(matchRoute(`${path}/extra`)).toBeNull();
  });

  it("executes through a real standalone listener", async () => {
    const { options, execute } = setup();
    const running = await serve({
      ...options,
      host: "127.0.0.1",
      port: 0,
      docs: false,
      log: () => {},
    });
    try {
      const response = await fetch(`${running.url}${path}`, {
        method: "POST",
        headers: { "x-dev-user": "viewer" },
        body: "{}",
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { rows: [{ cost: 10 }] } });
      expect(execute).toHaveBeenCalledTimes(1);
    } finally {
      await running.close();
    }
  });
});
