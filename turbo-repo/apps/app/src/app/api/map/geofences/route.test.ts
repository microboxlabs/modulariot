import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const forward = vi.fn();
const fetchMock = vi.fn();
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "user" } }) }));
vi.mock("@/app/api/utils/control-tower-map", () => ({
  forwardControlTowerMap: (...args: string[]) => forward(...args),
}));
import { GET } from "./route";

const geofences = [{ id: "g1", name: "Origin" }];

describe("trip geofence source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    forward.mockImplementation(async () => NextResponse.json(geofences));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads a trips-module UUID from the modulith", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const result = await GET(
      new NextRequest(`http://app.test/map?tripId=${id}`)
    );
    expect(await result.json()).toEqual({ data: geofences });
    expect(forward).toHaveBeenCalledWith(`trips/${id}/geofences`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads a service code from the modulith", async () => {
    const result = await GET(
      new NextRequest("http://app.test/map?tripId=SVC%20001")
    );
    expect(await result.json()).toEqual({ data: geofences });
    expect(forward).toHaveBeenCalledWith("trips/SVC%20001/geofences");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes a modulith error through", async () => {
    forward.mockImplementation(async () =>
      NextResponse.json({ error: "Trip not found" }, { status: 404 })
    );
    const result = await GET(new NextRequest("http://app.test/map?tripId=9"));
    expect(result.status).toBe(404);
  });

  it("refuses a missing trip", async () => {
    const result = await GET(
      new NextRequest("http://app.test/map?tripId=null")
    );
    expect(result.status).toBe(400);
    expect(forward).not.toHaveBeenCalled();
  });
});
