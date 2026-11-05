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

import { GET as icu } from "./route";
import { GET as trip } from "../trip/route";
import { GET as taskConditions } from "../../task/conditions/route";
import { NextRequest } from "next/server";

const row = { id: -3, symptom_name: "Panic", icu_code: "4", asset_id: "AB12" };

describe("legacy symptom routes with MIOT_SYMPTOMS_LEGACY_ENABLED=false", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STREAMHUB_URL", "http://pgrest");
    vi.stubEnv("MIOT_SYMPTOMS_LEGACY_ENABLED", "false");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ data: [row], total_rows: 1 })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lists a level's cases from the modulith", async () => {
    const res = await icu(new Request("http://x/i?p_icu_code=4"));
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms?p_page_size=200&p_icu_code=4",
      { method: "GET", sessionOnly: true }
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await res.json()).toEqual([row]);
  });

  it("passes a modulith error through", async () => {
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ error: "x" }, { status: 503 })
    );
    expect((await icu(new Request("http://x/i"))).status).toBe(503);
  });

  it("answers no legacy symptoms for a trip", async () => {
    expect(await (await trip(new Request("http://x/t?id=T1"))).json()).toEqual(
      []
    );
    const res = await taskConditions(new NextRequest("http://x/c?tripId=T1"));
    expect(await res.json()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps PostgREST when legacy symptoms are on", async () => {
    vi.stubEnv("MIOT_SYMPTOMS_LEGACY_ENABLED", "true");
    fetchMock.mockImplementation(async () =>
      Response.json({ status: 200, message: "ok", data: [row] })
    );
    expect(
      await (await icu(new Request("http://x/i?p_icu_code=4"))).json()
    ).toEqual([row]);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/rpc/api_modular_symptoms_icu_view"
    );
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
