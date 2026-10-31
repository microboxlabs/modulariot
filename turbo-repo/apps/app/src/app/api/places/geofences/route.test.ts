import { beforeEach, describe, expect, it, vi } from "vitest";
import wkx from "wkx";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const requireAuthMock = vi.fn();
const resolveScopeMock = vi.fn();
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => resolveScopeMock(),
}));
const fetchClientGeofencesMock = vi.fn();

vi.mock("@/app/api/utils/alfresco-crud-client", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/app/api/utils/pgrest-client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchClientGeofences: (...args: unknown[]) =>
    fetchClientGeofencesMock(...args),
}));
vi.mock("@/lib/logger", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/** EWKB hex of a polygon, as streamhub stores `coordinates`. */
function ewkb(ring: [number, number][]): string {
  const poligono = new wkx.Polygon(ring.map(([x, y]) => new wkx.Point(x, y)));
  poligono.srid = 4326;
  return poligono.toEwkb().toString("hex");
}

const cuadrado: [number, number][] = [
  [-70, -33],
  [-70, -32],
  [-69, -32],
  [-69, -33],
  [-70, -33],
];

describe("GET /api/places/geofences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STREAMHUB_CLIENT_ID", "app-client");
    requireAuthMock.mockResolvedValue({ authenticated: true });
    resolveScopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { modules: [] }, effectiveTaxIds: [] },
    });
  });

  it("returns the app client's geofences as places", async () => {
    fetchClientGeofencesMock.mockResolvedValue([
      {
        geofence_id: 7,
        client_geofence_id: "DEMO-7",
        geofence_name: "Demo depot",
        polygon_type: "polygonal",
        coordinates: ewkb(cuadrado),
        properties: null,
      },
      // no usable shape: left out
      {
        geofence_id: 8,
        client_geofence_id: "x",
        geofence_name: "Rota",
        polygon_type: "polygonal",
        coordinates: "zz",
        properties: null,
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET();
    expect(fetchClientGeofencesMock).toHaveBeenCalledWith("app-client");
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      place_id: "streamhub-7",
      name: "Demo depot",
      external_id: "DEMO-7",
      geometry_type: "polygon",
    });
    expect(body[0].polygon).toHaveLength(4);
  });

  it("needs a session", async () => {
    const denied = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    requireAuthMock.mockResolvedValue({
      authenticated: false,
      response: denied,
    });
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(401);
    expect(fetchClientGeofencesMock).not.toHaveBeenCalled();
  });

  it("fails clearly when the source is not configured or down", async () => {
    const { GET } = await import("./route");
    vi.stubEnv("STREAMHUB_CLIENT_ID", "");
    expect((await GET()).status).toBe(500);
    vi.stubEnv("STREAMHUB_CLIENT_ID", "app-client");
    fetchClientGeofencesMock.mockRejectedValue(new Error("pgrest down"));
    expect((await GET()).status).toBe(500);
  });
});

it("does not expose the configured tower client to carrier organizations", async () => {
  requireAuthMock.mockResolvedValue({ authenticated: true });
  resolveScopeMock.mockResolvedValue({
    resolved: true,
    scope: {
      activeOrg: { modules: ["CARRIER_PORTAL"] },
      effectiveTaxIds: ["demo-tax-id"],
    },
  });
  fetchClientGeofencesMock.mockClear();
  const { GET } = await import("./route");
  expect((await GET()).status).toBe(403);
  expect(fetchClientGeofencesMock).not.toHaveBeenCalled();
});
it("does not fetch a global source when tenant resolution fails", async () => {
  requireAuthMock.mockResolvedValue({ authenticated: true });
  resolveScopeMock.mockResolvedValue({
    resolved: false,
    response: NextResponse.json({ error: "Unavailable" }, { status: 502 }),
  });
  fetchClientGeofencesMock.mockClear();
  const { GET } = await import("./route");
  expect((await GET()).status).toBe(502);
  expect(fetchClientGeofencesMock).not.toHaveBeenCalled();
});
