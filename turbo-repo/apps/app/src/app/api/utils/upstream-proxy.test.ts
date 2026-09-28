import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, fetchMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  fetchMock: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/modulith-host", () => ({
  modulithHost: () => "https://backend.example.test",
}));

import { forwardToQuarkus } from "./quarkus-proxy";

beforeEach(() => {
  authMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  authMock.mockResolvedValue({
    user: { id: "alice", rawJWT: "session-token" },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("dashboard revision forwarding", () => {
  it("uses server-side identity and preserves read and save revisions", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"data":{"name":"Fleet"}}', { headers: { ETag: '"7"' } })
    );
    const loaded = await forwardToQuarkus("/api/v1/orgs/acme/dashboards/fleet");
    expect(loaded.headers.get("etag")).toBe('"7"');
    expect(loaded.headers.get("cache-control")).toBe("private, no-store");
    fetchMock.mockResolvedValueOnce(
      new Response('{"data":{"revision":8}}', { headers: { ETag: '"8"' } })
    );
    const saved = await forwardToQuarkus("/api/v1/orgs/acme/dashboards/fleet", {
      method: "PUT",
      body: { name: "Updated" },
      ifMatch: loaded.headers.get("etag")!,
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://backend.example.test/api/v1/orgs/acme/dashboards/fleet",
      expect.objectContaining({
        method: "PUT",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer session-token",
          "If-Match": '"7"',
          "Content-Type": "application/json",
        },
        body: '{"name":"Updated"}',
      })
    );
    expect(saved.headers.get("etag")).toBe('"8"');
    expect(await saved.json()).toEqual({ data: { revision: 8 } });
  });

  it("returns a stale-save conflict without retrying or copying private headers", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":{"code":"CONFLICT"}}', {
        status: 409,
        headers: { "Set-Cookie": "internal=value", Authorization: "private" },
      })
    );
    const response = await forwardToQuarkus(
      "/api/v1/orgs/acme/dashboards/fleet",
      {
        method: "PUT",
        body: {},
        ifMatch: '"2"',
      }
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "CONFLICT" } });
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(response.headers.has("authorization")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthenticated writes before calling the backend", async () => {
    authMock.mockResolvedValue(null);
    const response = await forwardToQuarkus(
      "/api/v1/orgs/acme/dashboards/fleet",
      {
        method: "PUT",
        body: {},
        ifMatch: '"0"',
      }
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps empty successful responses empty and private", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const response = await forwardToQuarkus(
      "/api/v1/orgs/acme/dashboards/fleet",
      {
        method: "DELETE",
      }
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
