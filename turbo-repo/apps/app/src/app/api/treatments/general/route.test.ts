import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const scopeMock = vi.fn();
const forwardMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1" } }) }));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
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

const header = {
  symptom_info: { id: 7, name: "Speed", type: "signal", icu_code: 3 },
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
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads the symptom through the modulith without PostgREST", async () => {
    vi.stubEnv("STREAMHUB_URL", "");
    const res = await GET(new Request("http://x/g?id=7"));
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms/7",
      { method: "GET", sessionOnly: true }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(header);
  });

  it("passes a modulith 404 through", async () => {
    vi.stubEnv("STREAMHUB_URL", "");
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ error: "Symptom not found" }, { status: 404 })
    );
    expect((await GET(new Request("http://x/g?id=8"))).status).toBe(404);
  });

  it("refuses a missing id", async () => {
    vi.stubEnv("STREAMHUB_URL", "");
    expect((await GET(new Request("http://x/g"))).status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("keeps PostgREST when it is configured", async () => {
    vi.stubEnv("STREAMHUB_URL", "http://pgrest");
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
      Response.json({ status: 200, message: "ok", data: header })
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(new Request("http://x/g?id=7"));
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/rpc/api_modular_treatments_info_general?p_symptom_id=7&p_dev_env=1"
    );
    expect(forwardMock).not.toHaveBeenCalled();
    expect(await res.json()).toEqual(header);
  });
});
