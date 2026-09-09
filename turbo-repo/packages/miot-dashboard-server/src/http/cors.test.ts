import { afterEach, describe, expect, it, vi } from "vitest";
import { withCors } from "./cors";
import { createDashboardHandler } from "./handler";
import { serve, type RunningServer } from "../server/serve";
import {
  createMemoryStore,
  createMemoryScopeAuthority,
  createMemoryTenantAuthority,
} from "../testing";

const origin = "https://dashboard.example";
const path = "/tenants/acme/scopes/ops/dashboards";

describe.each(["direct", "http"])("CORS %s", (mode) => {
  let server: RunningServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });
  const setup = async () => {
    const resolve = vi.fn().mockResolvedValue(null);
    const options = {
      identity: { resolve },
      tenants: createMemoryTenantAuthority({}),
      scopes: createMemoryScopeAuthority({}),
      store: createMemoryStore(),
      cors: { origins: [origin], credentials: true, headers: ["x-ticket"] },
    };
    const handler = createDashboardHandler(options);
    if (mode === "http")
      server = await serve({
        ...options,
        port: 0,
        host: "127.0.0.1",
        log: () => {},
      });
    return {
      resolve,
      request: (init: RequestInit) =>
        server
          ? fetch(server.url + path, init)
          : handler(new Request("http://local" + path, init)),
    };
  };
  it("answers preflight without resolving identity", async () => {
    const { request, resolve } = await setup();
    const response = await request({
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "PUT",
        "access-control-request-headers":
          "Authorization, Content-Type, If-Match, X-Ticket",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(resolve).not.toHaveBeenCalled();
  });
  it("exposes auth errors to an allowed origin without bypassing auth", async () => {
    const { request, resolve } = await setup();
    const response = await request({ headers: { origin } });
    expect(response.status).toBe(401);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("vary")).toContain("Origin");
    expect(resolve).toHaveBeenCalledOnce();
  });
  it.each(["https://dashboard.example.evil", "null"])(
    "refuses origin %s before reaching the API",
    async (forbidden) => {
      const { request, resolve } = await setup();
      const response = await request({ headers: { origin: forbidden } });
      expect(response.status).toBe(403);
      expect(response.headers.has("access-control-allow-origin")).toBe(false);
      expect(resolve).not.toHaveBeenCalled();
    },
  );
  it("refuses unsupported preflight headers", async () => {
    const { request, resolve } = await setup();
    const response = await request({
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "PUT",
        "access-control-request-headers": "x-impersonate-user",
      },
    });
    expect(response.status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  });
  it("keeps non-browser clients subject to ordinary authentication", async () => {
    const { request } = await setup();
    const response = await request({});
    expect(response.status).toBe(401);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  });
});

it.each([
  "*",
  "null",
  "https://host/path",
  "https://user:pass@host",
  "ftp://host",
  "https://host/",
])("refuses unsafe CORS origin %s at construction", (origin) => {
  expect(() =>
    withCors(async () => new Response(), { origins: [origin] }),
  ).toThrow("CORS origins");
});
