import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const forward = vi.fn();
const fetchMock = vi.fn();
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "user" } }) }));
vi.mock("@/app/api/utils/control-tower-map", () => ({
  forwardControlTowerMap: (...args: string[]) => forward(...args),
}));
vi.mock(
  "@/features/common/providers/sreamhub-api/streamhub-api.provider",
  () => ({
    AuthToken: class {
      getToken = async () => "test-token";
    },
  })
);
import { GET } from "./route";

describe("trip geofence source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("STREAMHUB_IOT_URL", "http://avl.test");
    forward.mockResolvedValue(NextResponse.json([]));
    fetchMock.mockResolvedValue(NextResponse.json({ data: [] }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the modulith for a UUID with the AVL API configured", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const result = await GET(
      new NextRequest(`http://app.test/map?tripId=${id}`)
    );
    expect(await result.json()).toEqual({ data: [] });
    expect(forward).toHaveBeenCalledWith(`trips/${id}/geofences`);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps a numeric trip on the legacy RPC", async () => {
    const result = await GET(new NextRequest("http://app.test/map?tripId=123"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "api_modular_treatments_geofences_service?p_trip_id=123"
      ),
      expect.any(Object)
    );
    expect(await result.json()).toEqual({ data: [] });
    expect(forward).not.toHaveBeenCalled();
  });
  it("uses the modulith without the AVL API", async () => {
    vi.stubEnv("STREAMHUB_IOT_URL", "");
    await GET(new NextRequest("http://app.test/map?tripId=123"));
    expect(forward).toHaveBeenCalledWith("trips/123/geofences");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("accepts an empty legacy response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(
      await (
        await GET(new NextRequest("http://app.test/map?tripId=123"))
      ).json()
    ).toEqual([]);
  });
});
