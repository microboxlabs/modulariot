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

const cuadrado: [number, number][] = [
  [-70, -33],
  [-70, -32],
  [-69, -32],
  [-69, -33],
  [-70, -33],
];

const geocerca = (over: Record<string, unknown> = {}) => ({
  id: 7,
  code: "SCL",
  name: "SITRANS SANTIAGO",
  polygonType: "polygonal",
  category: null,
  shape: { type: "Polygon", coordinates: [cuadrado] },
  properties: null,
  ...over,
});

describe("GET /api/places/geofences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forwardToQuarkusMock.mockReset();
    resolveTenantScopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme corp" } },
    });
  });

  it("returns the active organization's geofences as places", async () => {
    forwardToQuarkusMock.mockResolvedValue(
      NextResponse.json([
        geocerca(),
        // no usable shape: left out
        geocerca({ id: 8, name: "Rota", shape: null }),
      ])
    );
    const { GET } = await import("./route");
    const res = await GET();
    expect(forwardToQuarkusMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20corp/places/geofences?size=2000&page=0"
    );
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      place_id: "streamhub-7",
      name: "SITRANS SANTIAGO",
      external_id: "SCL",
      geometry_type: "polygon",
    });
    expect(body[0].polygon).toHaveLength(4);
  });

  it("needs a session and an organization", async () => {
    const denied = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    resolveTenantScopeMock.mockResolvedValue({
      resolved: false,
      response: denied,
    });
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(401);
    expect(forwardToQuarkusMock).not.toHaveBeenCalled();
  });

  it("passes the modulith's errors through", async () => {
    forwardToQuarkusMock.mockResolvedValue(
      NextResponse.json({ error: "forbidden" }, { status: 403 })
    );
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(403);
  });

  it("passes through that the GPS database is not configured", async () => {
    forwardToQuarkusMock.mockResolvedValue(
      NextResponse.json(
        { error: "The GPS database is not configured" },
        { status: 503 }
      )
    );
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(503);
  });

  it("fails clearly when the modulith answers an unexpected shape", async () => {
    forwardToQuarkusMock.mockResolvedValue(
      NextResponse.json({ not: "a list" })
    );
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(502);
  });

  it("loads the catalog past the first 2000 geofences", async () => {
    forwardToQuarkusMock
      .mockResolvedValueOnce(
        NextResponse.json(
          Array.from({ length: 2000 }, (_, id) => geocerca({ id }))
        )
      )
      .mockResolvedValueOnce(NextResponse.json([geocerca({ id: 2000 })]));
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(2001);
    expect(body.at(-1).place_id).toBe("streamhub-2000");
    expect(forwardToQuarkusMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/orgs/acme%20corp/places/geofences?size=2000&page=1"
    );
  });

  it("does not present a partial catalog when a later page fails", async () => {
    forwardToQuarkusMock
      .mockResolvedValueOnce(
        NextResponse.json(
          Array.from({ length: 2000 }, (_, id) => geocerca({ id }))
        )
      )
      .mockResolvedValueOnce(
        NextResponse.json({ error: "unavailable" }, { status: 503 })
      );
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(503);
  });
});
