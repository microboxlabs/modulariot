import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: async () => ({
    resolved: true,
    scope: { activeOrg: { slug: "example org" } },
  }),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

import { GET as list, POST, DELETE } from "./items/route";
import { PUT } from "./items/[id]/route";
import { GET as codeUsage } from "./items/code-usage/route";
import { GET as geofences } from "./geofences/route";
import { forwardToStreamhubModulith } from "../utils/streamhub-modulith-proxy";

const place = {
  kind: "geofence",
  parentId: null,
  externalCode: "DEPOT/01",
  name: "Depot",
  icon: null,
  color: null,
  address: null,
  categories: null,
  metadata: { enabled: true, count: 3, nested: { value: "sample" } },
  geojson: {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-70, -33] },
    properties: { radius_m: 20 },
  },
  validFrom: null,
  validUntil: null,
};
const replacement = {
  ...place,
  inners: [],
  version: { bump: "MINOR", reason: "Moved", changes: ["geometry"] },
};
const orgPath = "/api/v1/orgs/example%20org/places";
const codeQuery = "code=DEPOT%2F01";
const request = (method: string, body?: object) =>
  new Request(`http://app.test/app/api/places/items?${codeQuery}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const calls = [
  {
    name: "items GET",
    method: "GET",
    path: "/items?size=2000&page=0",
    run: list,
  },
  {
    name: "items POST",
    method: "POST",
    path: "/items",
    run: () => POST(request("POST", place)),
    body: place,
  },
  {
    name: "item PUT",
    method: "PUT",
    path: "/items/place%201",
    run: () =>
      PUT(request("PUT", replacement), {
        params: Promise.resolve({ id: "place 1" }),
      }),
    body: replacement,
  },
  {
    name: "items DELETE",
    method: "DELETE",
    path: `/items?${codeQuery}`,
    run: () => DELETE(request("DELETE")),
  },
  {
    name: "code-usage GET",
    method: "GET",
    path: `/items/code-usage?${codeQuery}`,
    run: () => codeUsage(request("GET")),
  },
  {
    name: "geofences GET",
    method: "GET",
    path: "/geofences?size=2000&page=0",
    run: geofences,
  },
];

describe.each([
  {
    mode: "coordinator",
    streamhub: "https://streamhub.test/",
    base: "https://streamhub.test",
  },
  { mode: "GKE fallback", streamhub: undefined, base: "https://modulith.test" },
])("Places proxy ($mode)", ({ streamhub, base }) => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("MIOT_STREAMHUB_API_URL", streamhub);
    vi.stubEnv("MIOT_MODULITH_URL", "https://modulith.test/");
    // An old deployment setting must never switch Places to a service token.
    vi.stubEnv("MIOT_STREAMHUB_AUTH", "m2m");
    authMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.test",
        rawJWT: "test-user-jwt",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(calls)("forwards $name with the user's JWT", async (call) => {
    let status = 200;
    if (call.method === "DELETE") status = 204;
    if (call.method === "POST") status = 201;
    const payload = call.method === "GET" ? [] : { id: "place-1" };
    fetchMock.mockResolvedValue(
      new Response(status === 204 ? null : JSON.stringify(payload), { status })
    );
    expect((await call.run()).status).toBe(status);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `${base}${orgPath}${call.path}`,
      expect.objectContaining({
        method: call.method,
        headers: expect.objectContaining({
          Authorization: "Bearer test-user-jwt",
        }),
        body: "body" in call ? JSON.stringify(call.body) : undefined,
      })
    );
    if ("body" in call) {
      expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBe(
        "application/json"
      );
    }
  });

  it.each(calls)("preserves upstream errors for $name", async (call) => {
    for (const status of [400, 401, 403, 404, 409, 500, 503]) {
      const error = { error: `Upstream ${status}` };
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(error), { status })
      );
      const response = await call.run();
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(error);
    }
  });

  it.each([list, geofences])(
    "reads subsequent pages without changing paging or auth",
    async (read) => {
      const row =
        read === geofences
          ? {
              id: 1,
              code: "DEPOT",
              name: "Depot",
              polygonType: "polygonal",
              category: null,
              shape: null,
              properties: null,
            }
          : { ...place, id: "place-1" };
      fetchMock
        .mockResolvedValueOnce(
          new Response(JSON.stringify(Array.from({ length: 2000 }, () => row)))
        )
        .mockResolvedValueOnce(new Response("[]"));
      expect((await read()).status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toBe(
        fetchMock.mock.calls[0][0].replace("page=0", "page=1")
      );
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
        "Bearer test-user-jwt"
      );
    }
  );

  it("preserves an encoded search and pagination through the real helper", async () => {
    fetchMock.mockResolvedValue(new Response("[]"));
    const path = `${orgPath}/items?size=25&page=2&q=Depot%20%26%20yard`;
    await forwardToStreamhubModulith(path);
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}${path}`);
  });

  it.each(calls)("does not forward $name without a session", async (call) => {
    authMock.mockResolvedValue(null);
    expect((await call.run()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
