import { describe, expect, it, vi } from "vitest";
import { createDashboardClient, createDashboardRoutes } from "../client";

describe("standalone routing and authentication", () => {
  const routes = createDashboardRoutes({
    baseUrl: "https://dashboards.example/api/",
    tenantId: "tenant/a",
    scopeId: "operations & costs",
  });

  it("binds encoded tenant/scope routes under the configured prefix", () => {
    expect(routes).toEqual({
      dashboards:
        "https://dashboards.example/api/tenants/tenant%2Fa/scopes/operations%20%26%20costs/dashboards",
      scopeCapabilities:
        "https://dashboards.example/api/tenants/tenant%2Fa/scopes/operations%20%26%20costs/capabilities",
    });
    expect(createDashboardClient({ routes }).key("capabilities")).not.toBe(
      routes.scopeCapabilities,
    );
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "https://user:secret@example.com",
    "javascript:alert(1)",
    "https://example.com/#fragment",
    "https://example.com/\npath",
    "relative/path",
    "",
    "http://[",
    "/api/%2e%2e",
    "/api/%2E.",
    "/api/.%2e/dashboards",
    "https://dashboards.example/api/../dashboards",
    "https://dashboards.example/api/%2e/dashboards",
  ])("rejects ambiguous endpoint %j", (endpoint) => {
    expect(() =>
      createDashboardClient({
        routes: { dashboards: endpoint, scopeCapabilities: "/capabilities" },
      }),
    ).toThrow("(400)");
  });

  it("rejects base queries and traversal IDs before building routes", () => {
    expect(() =>
      createDashboardRoutes({
        baseUrl: "/api?org=other",
        tenantId: "a",
        scopeId: "b",
      }),
    ).toThrow("(400)");
    expect(() =>
      createDashboardRoutes({
        baseUrl: "/api",
        tenantId: "a/../b",
        scopeId: "b",
      }),
    ).toThrow("(400)");
  });

  it("does not mistake query values or hostnames for path segments", () => {
    expect(() =>
      createDashboardClient({
        routes: {
          dashboards: "/api/dashboards?filter=/../",
          scopeCapabilities: "https://dashboards.example",
        },
      }),
    ).not.toThrow();
  });

  it("refreshes host tokens on every request and omits cookies by default", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ data: [] }));
    const token = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const client = createDashboardClient({
      routes,
      fetch: fetcher,
      getToken: token,
    });
    await client.list();
    await client.list();
    expect(fetcher.mock.calls.map((call) => call[1]?.headers)).toEqual([
      { authorization: "Bearer first" },
      { authorization: "Bearer second" },
    ]);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
  });

  it("does not forward provider errors or issue a request after cancellation", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const controller = new AbortController();
    const getToken = vi
      .fn()
      .mockRejectedValueOnce(new Error("private identity details"));
    const client = createDashboardClient({ routes, fetch: fetcher, getToken });
    await expect(client.list()).rejects.toThrow(
      "Dashboard request failed (401)",
    );
    getToken.mockImplementationOnce(async (signal: AbortSignal) => {
      expect(signal).toBe(controller.signal);
      controller.abort();
      return "unused";
    });
    await expect(client.list(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("permits a host without a bearer and forwards mutation cancellation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status: 204 }));
    const client = createDashboardClient({
      routes,
      fetch: fetcher,
      getToken: async () => null,
    });
    const controller = new AbortController();
    await client.setPermissions("sales", [], controller.signal);
    await client.remove("sales", controller.signal);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.signal).toBe(controller.signal);
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
    }
  });
});
