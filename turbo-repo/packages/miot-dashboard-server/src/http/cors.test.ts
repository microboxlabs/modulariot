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
      request: (init: RequestInit, suffix = "") =>
        server
          ? fetch(server.url + path + suffix, init)
          : handler(new Request("http://local" + path + suffix, init)),
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
    "gives origin %s no read of the response",
    async (forbidden) => {
      // Not a 403. Browsers put an Origin on every non-GET request, a
      // same-origin one included, so refusing here would 403 the deployment's
      // own front end and its own /docs page. The missing header is what
      // stops a cross-origin page reading the answer, and every write to this
      // API is preflighted, so a write from an unlisted origin never arrives.
      const { request } = await setup();
      const response = await request({ headers: { origin: forbidden } });
      expect(response.headers.has("access-control-allow-origin")).toBe(false);
    },
  );

  it("refuses a preflight from an origin that is not listed", async () => {
    // The preflight is where the no belongs: the browser is asking whether it
    // may send the real request, and never sends it after a 403.
    const { request, resolve } = await setup();
    const response = await request({
      method: "OPTIONS",
      headers: {
        origin: "https://dashboard.example.evil",
        "access-control-request-method": "PUT",
      },
    });
    expect(response.status).toBe(403);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("lets a same-origin write reach the API once CORS is configured", async () => {
    // The regression this pair guards: with an allowlist set, a PUT carrying
    // the server's own origin was refused before it reached the handler, so
    // configuring CORS for an embedding front end broke the first-party one.
    const { request, resolve } = await setup();
    const response = await request(
      {
        method: "PUT",
        headers: {
          origin: "http://localhost:3070",
          "content-type": "application/json",
        },
        body: JSON.stringify({ version: 2, name: "Fleet", widgets: [] }),
      },
      "/fleet",
    );
    // 401, because this test resolves no identity. The point is that it is
    // the API answering rather than CORS refusing, and that the resolver was
    // reached at all.
    expect(response.status).not.toBe(403);
    expect(resolve).toHaveBeenCalled();
  });

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
