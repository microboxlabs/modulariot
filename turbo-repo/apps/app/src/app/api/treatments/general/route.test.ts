import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const scopeMock = vi.fn();
const forwardMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1" } }) }));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));

import { GET } from "./route";

const header = {
  symptom_info: { id: -7, name: "Speed", type: "signal", icu_code: 3 },
  trip_info: { trip_id: "T1", asset_id: "AB12" },
  conditions_agg: [],
};

describe("GET /api/treatments/general", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
    forwardMock.mockImplementation(async () => NextResponse.json(header));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads an engine case through the modulith", async () => {
    const res = await GET(new Request("http://x/g?id=-7"));
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms/-7",
      { method: "GET" }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(header);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes a modulith 404 through", async () => {
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ error: "Symptom not found" }, { status: 404 })
    );
    expect((await GET(new Request("http://x/g?id=8"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a missing id", async () => {
    expect((await GET(new Request("http://x/g"))).status).toBe(400);
    expect((await GET(new Request("http://x/g?id=%20"))).status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
