import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const forwardMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1" } }) }));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: async () => ({
    resolved: true,
    scope: { activeOrg: { slug: "acme" } },
  }),
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));
vi.mock(
  "@/features/common/providers/sreamhub-api/streamhub-api.provider",
  () => ({
    AuthToken: class {
      getToken = async () => "m2m";
    },
  })
);

import { GET } from "./route";

// POINT(-68 -33.25) as hex EWKB with SRID 4326.
const POINT = "0101000020E610000000000000000051C00000000000A040C0";

const collection = {
  type: "FeatureCollection",
  description: { symptom_name: "Speed" },
  features: [
    {
      type: "Feature",
      geometry: POINT,
      properties: { speed: 90, timestamp: "2026-10-15T10:00:00+00:00" },
    },
  ],
};

describe("GET /api/treatments/location", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forwardMock.mockImplementation(async () => NextResponse.json(collection));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads the signals through the modulith and adds coordinates", async () => {
    vi.stubEnv("STREAMHUB_URL", "");
    const res = await GET(
      new Request("http://x/l?trip_id=T1&symptom_name=Speed&symptom_id=7")
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms/7/signals",
      { method: "GET", sessionOnly: true }
    );
    const body = await res.json();
    expect(body.description).toEqual({ symptom_name: "Speed" });
    expect(body.features[0]).toMatchObject({
      longitude: -68,
      latitude: -33.25,
      symptom_name: "Speed",
      geometry: POINT,
    });
  });

  it("reads a case without a trip through the modulith", async () => {
    vi.stubEnv("STREAMHUB_URL", "http://pgrest");
    const res = await GET(
      new Request("http://x/l?symptom_name=Panic&symptom_id=-9")
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms/-9/signals",
      { method: "GET", sessionOnly: true }
    );
    expect((await res.json()).features[0].latitude).toBe(-33.25);
  });

  it("refuses a GPS database symptom without a trip", async () => {
    vi.stubEnv("STREAMHUB_URL", "");
    const res = await GET(
      new Request("http://x/l?symptom_name=S&symptom_id=7")
    );
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("passes a modulith error through", async () => {
    vi.stubEnv("STREAMHUB_URL", "");
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ error: "Symptom not found" }, { status: 404 })
    );
    const res = await GET(
      new Request("http://x/l?trip_id=T1&symptom_name=Speed&symptom_id=8")
    );
    expect(res.status).toBe(404);
  });

  it("answers no features when the signals have no GPS rows", async () => {
    vi.stubEnv("STREAMHUB_URL", "http://pgrest");
    vi.stubGlobal("fetch", async () =>
      Response.json({
        status: 200,
        message: "ok",
        data: { ...collection, features: null },
      })
    );
    const res = await GET(
      new Request("http://x/l?trip_id=T1&symptom_name=Speed&symptom_id=7")
    );
    expect(res.status).toBe(200);
    expect((await res.json()).features).toEqual([]);
  });

  it("keeps PostgREST when it is configured", async () => {
    vi.stubEnv("STREAMHUB_URL", "http://pgrest");
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
      Response.json({ status: 200, message: "ok", data: collection })
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(
      new Request("http://x/l?trip_id=T1&symptom_name=Speed&symptom_id=7")
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/rpc/api_modular_treatment_symptoms_signals_map"
    );
    expect(forwardMock).not.toHaveBeenCalled();
    expect((await res.json()).features[0].latitude).toBe(-33.25);
  });
});
