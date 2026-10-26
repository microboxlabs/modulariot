import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

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

const positions = [
  {
    assetid: "AB12",
    timestamp: "2026-10-15T10:00:00+00:00",
    speed: 50,
    heading: 1.5,
    location: "0101000020E610000000000000000051C00000000000A040C0",
    longitude: -68,
    latitude: -33.25,
  },
  {
    assetid: "AB12",
    timestamp: "2026-10-15T10:01:00+00:00",
    speed: 0,
    heading: 0,
    location: "0101000020E610000000000000000051C00000000000A040C0",
    longitude: -68,
    latitude: -33.25,
  },
];

describe("GET /api/map/trip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forwardMock.mockImplementation(async () => NextResponse.json(positions));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the modulith's positions as server-sent events without the AVL API", async () => {
    vi.stubEnv("STREAMHUB_IOT_URL", "");
    const res = await GET(
      new NextRequest("http://x/t?tripId=T%201&assetId=AB12")
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/trips/T%201/positions?assetId=AB12",
      { method: "GET", sessionOnly: true }
    );
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const events = (await res.text())
      .split("\n\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line.replace(/^data: /, "")));
    expect(events).toEqual(positions);
  });

  it("passes a modulith 404 through", async () => {
    vi.stubEnv("STREAMHUB_IOT_URL", "");
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ error: "Trip not found" }, { status: 404 })
    );
    const res = await GET(new NextRequest("http://x/t?tripId=T9&assetId=AB12"));
    expect(res.status).toBe(404);
  });

  it("refuses a missing asset", async () => {
    vi.stubEnv("STREAMHUB_IOT_URL", "");
    const res = await GET(new NextRequest("http://x/t?tripId=T1"));
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("reads a case without a trip by its symptom, even with the AVL API", async () => {
    vi.stubEnv("STREAMHUB_IOT_URL", "http://avl");
    const res = await GET(
      new NextRequest("http://x/t?tripId=null&assetId=DEMO008&symptomId=-9")
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms/-9/positions",
      { method: "GET", sessionOnly: true }
    );
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect((await res.text()).split("\n\n").filter(Boolean)).toHaveLength(2);
  });

  it("reads a trips-module trip from the modulith, even with the AVL API", async () => {
    vi.stubEnv("STREAMHUB_IOT_URL", "http://avl");
    const trip = "62920df5-094f-4ec5-ba3f-b382fe7375a7";
    const res = await GET(
      new NextRequest(`http://x/t?tripId=${trip}&assetId=AB12`)
    );
    expect(forwardMock).toHaveBeenCalledWith(
      `/api/v1/orgs/acme/control-tower/map/trips/${trip}/positions?assetId=AB12`,
      { method: "GET", sessionOnly: true }
    );
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("refuses the string null as a trip of a symptom on the GPS database", async () => {
    vi.stubEnv("STREAMHUB_IOT_URL", "");
    const res = await GET(
      new NextRequest("http://x/t?tripId=null&assetId=DEMO008&symptomId=7")
    );
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
