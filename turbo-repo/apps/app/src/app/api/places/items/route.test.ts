import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const resolveTenantScopeMock = vi.fn();
const forwardToQuarkusMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: (...args: unknown[]) => resolveTenantScopeMock(...args),
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: (...args: unknown[]) => forwardToQuarkusMock(...args),
}));
vi.mock("@/lib/logger", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const circle = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [-70, -33] },
  properties: { radius_m: 20 },
};
const line = {
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [
      [-70, -33],
      [-71, -33],
    ],
  },
  properties: { kind: "vial" },
};

const place = (over: Record<string, unknown> = {}) => ({
  id: "p-1",
  kind: "geofence",
  parentId: null,
  externalCode: "SCL",
  name: "Planta",
  icon: null,
  color: null,
  address: null,
  categories: null,
  metadata: {},
  geojson: circle,
  validFrom: null,
  validUntil: null,
  ...over,
});

const body = {
  kind: "geofence",
  parentId: null,
  externalCode: null,
  name: "Planta",
  icon: null,
  color: null,
  address: null,
  categories: null,
  metadata: {},
  geojson: circle,
  validFrom: null,
  validUntil: null,
};

const post = (json: unknown) =>
  new Request("http://localhost/app/api/places/items", {
    method: "POST",
    body: JSON.stringify(json),
  });

describe("/api/places/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forwardToQuarkusMock.mockReset();
    resolveTenantScopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme corp" } },
    });
  });

  it("lists the organization's places and routes apart", async () => {
    forwardToQuarkusMock.mockResolvedValue(
      NextResponse.json([
        place(),
        place({ id: "t-1", kind: "route", name: "Ruta 68", geojson: line }),
      ])
    );
    const { GET } = await import("./route");
    const res = await GET();
    expect(forwardToQuarkusMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20corp/places/items?size=2000&page=0"
    );
    const json = await res.json();
    expect(json.lugares.map((l: { place_id: string }) => l.place_id)).toEqual([
      "p-1",
    ]);
    expect(
      json.trayectos.map((t: { trayecto_id: string }) => t.trayecto_id)
    ).toEqual(["t-1"]);
    expect(json.lugares[0].center).toEqual([-33, -70]);
  });

  it("fails clearly when the modulith answers an unexpected shape", async () => {
    forwardToQuarkusMock.mockResolvedValue(
      NextResponse.json({ not: "a list" })
    );
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(502);
  });

  it("forwards a valid new place to the active organization", async () => {
    forwardToQuarkusMock.mockResolvedValue(
      NextResponse.json(place(), { status: 201 })
    );
    const { POST } = await import("./route");
    const res = await POST(post(body));
    expect(res.status).toBe(201);
    expect(forwardToQuarkusMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20corp/places/items",
      { method: "POST", body }
    );
  });

  it("rejects a body that is not a place without calling the modulith", async () => {
    const { POST } = await import("./route");
    expect((await POST(post({ name: "Sin forma" }))).status).toBe(400);
    expect(forwardToQuarkusMock).not.toHaveBeenCalled();
  });

  it("needs a session and an organization", async () => {
    resolveTenantScopeMock.mockResolvedValue({
      resolved: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const { GET, POST } = await import("./route");
    expect((await GET()).status).toBe(401);
    expect((await POST(post(body))).status).toBe(401);
    expect(forwardToQuarkusMock).not.toHaveBeenCalled();
  });
});

describe("/api/places/items/[id]", () => {
  const params = Promise.resolve({ id: "p 1" });

  beforeEach(() => {
    forwardToQuarkusMock.mockReset();
    resolveTenantScopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
  });

  it("replaces by id and deletes by External ID in the active organization", async () => {
    forwardToQuarkusMock.mockResolvedValue(NextResponse.json(place()));
    const { PUT } = await import("./[id]/route");
    const { DELETE } = await import("./route");
    await PUT(
      new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
      { params }
    );
    await DELETE(
      new Request("http://localhost/app/api/places/items?code=PL%2F01")
    );
    expect(forwardToQuarkusMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/orgs/acme/places/items/p%201",
      { method: "PUT", body }
    );
    expect(forwardToQuarkusMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/orgs/acme/places/items?code=PL%2F01",
      { method: "DELETE" }
    );
  });

  it("does not delete without a code", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request("http://localhost/app/api/places/items?code=%20")
    );
    expect(res.status).toBe(400);
    expect(forwardToQuarkusMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid replacement", async () => {
    const { PUT } = await import("./[id]/route");
    const res = await PUT(
      new Request("http://localhost", { method: "PUT", body: "nope" }),
      { params }
    );
    expect(res.status).toBe(400);
    expect(forwardToQuarkusMock).not.toHaveBeenCalled();
  });
});
