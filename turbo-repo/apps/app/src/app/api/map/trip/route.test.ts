import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const forwardMock = vi.fn();
const fetchMock = vi.fn();

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
    received_at: "2026-10-15T10:00:02+00:00",
    delay_s: 2,
  },
  {
    assetid: "AB12",
    timestamp: "2026-10-15T10:01:00+00:00",
    speed: 0,
    heading: 0,
    location: "0101000020E610000000000000000051C00000000000A040C0",
    longitude: -68,
    latitude: -33.25,
    received_at: "2026-10-15T10:31:00+00:00",
    delay_s: 1800,
  },
];

function events(body: string) {
  return body
    .split("\n\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line.replace(/^data: /, "")));
}

describe("GET /api/map/trip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forwardMock.mockImplementation(async () => NextResponse.json(positions));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads a service code from the modulith, keeping received_at and delay_s", async () => {
    const res = await GET(
      new NextRequest("http://x/t?tripId=SVC%20001&assetId=AB12")
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/trips/SVC%20001/positions?assetId=AB12",
      { method: "GET" }
    );
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(events(await res.text())).toEqual(positions);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads a numeric GPS-database trip from the modulith", async () => {
    await GET(new NextRequest("http://x/t?tripId=123&assetId=AB12"));
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/trips/123/positions?assetId=AB12",
      { method: "GET" }
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads a trips-module trip from the modulith", async () => {
    const trip = "62920df5-094f-4ec5-ba3f-b382fe7375a7";
    const res = await GET(
      new NextRequest(`http://x/t?tripId=${trip}&assetId=AB12`)
    );
    expect(forwardMock).toHaveBeenCalledWith(
      `/api/v1/orgs/acme/control-tower/map/trips/${trip}/positions?assetId=AB12`,
      { method: "GET" }
    );
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads an engine case without a trip by its symptom", async () => {
    const res = await GET(
      new NextRequest("http://x/t?tripId=null&assetId=DEMO008&symptomId=-9")
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms/-9/positions",
      { method: "GET" }
    );
    expect(events(await res.text())).toEqual(positions);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes a modulith 404 through", async () => {
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ error: "Trip not found" }, { status: 404 })
    );
    const res = await GET(new NextRequest("http://x/t?tripId=T9&assetId=AB12"));
    expect(res.status).toBe(404);
  });

  it("refuses a missing asset", async () => {
    const res = await GET(new NextRequest("http://x/t?tripId=T1"));
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("refuses the string null as a trip of a symptom that is not an engine case", async () => {
    const res = await GET(
      new NextRequest("http://x/t?tripId=null&assetId=DEMO008&symptomId=7")
    );
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
