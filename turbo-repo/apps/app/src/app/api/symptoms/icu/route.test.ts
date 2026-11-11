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

import { GET as icu } from "./route";
import { GET as trip } from "../trip/route";

const row = {
  id: -3,
  symptom_name: "Panic",
  icu_code: "4",
  asset_id: "AB12",
  trip_code: "SERVICE-001",
};

describe("symptom routes read the engine only", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
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
      { method: "GET" }
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await res.json()).toEqual([row]);
  });

  it("lists every level without p_icu_code", async () => {
    await icu(new Request("http://x/i"));
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms?p_page_size=200",
      { method: "GET" }
    );
  });

  it("passes the operator filter to the modulith and drops any other value", async () => {
    await icu(new Request("http://x/i?p_icu_code=4&operator=none"));
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms?p_page_size=200&p_icu_code=4&operator=none",
      { method: "GET" }
    );

    await icu(new Request("http://x/i?operator=junk"));
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms?p_page_size=200",
      { method: "GET" }
    );
  });

  it("passes a modulith error through", async () => {
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ error: "x" }, { status: 503 })
    );
    expect((await icu(new Request("http://x/i"))).status).toBe(503);
  });

  it("reads a trip's engine symptoms from the modulith by service code", async () => {
    const body = { trip: "SVC 1/A", symptoms: [{ name: "Demo", cases: 2 }] };
    forwardMock.mockImplementation(async () => NextResponse.json(body));
    const res = await trip(new Request("http://x/t?id=%20SVC%201%2FA%20"));
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/trips/SVC%201%2FA/symptoms",
      { method: "GET" }
    );
    expect(await res.json()).toEqual(body);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads a trips-module trip's engine symptoms from the modulith", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    await trip(new Request(`http://x/t?id=${id}`));
    expect(forwardMock).toHaveBeenCalledWith(
      `/api/v1/orgs/acme/control-tower/map/trips/${id}/symptoms`,
      { method: "GET" }
    );
  });

  it("answers no engine symptoms without a trip", async () => {
    const res = await trip(new Request("http://x/t"));
    expect(await res.json()).toEqual({ trip: "", symptoms: [] });
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
