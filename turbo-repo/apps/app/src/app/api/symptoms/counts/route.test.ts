import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const scopeMock = vi.fn();
const forwardMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));
vi.mock("@/features/auth/config/carrier-matrix", () => ({
  CARRIER_PORTAL_MODULE: "carrier-portal",
}));

import { GET } from "./route";

const scope = (modules: string[] = [], taxIds: string[] = []) => ({
  resolved: true,
  scope: { activeOrg: { slug: "acme", modules }, effectiveTaxIds: taxIds },
});

describe("GET /api/symptoms/counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue(scope());
    forwardMock.mockImplementation(async () =>
      NextResponse.json({
        conditions: {
          "Code Black": 2,
          "Compromised condition": 1,
          "Under Treatment": 3,
          Ignored: 4,
        },
        vehicles_on_trip: 9,
      })
    );
  });

  it("maps the counts by condition and the vehicles on a trip", async () => {
    const body = await (await GET(new NextRequest("http://x/c"))).json();

    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/case-counts",
      { method: "GET" }
    );
    expect(body).toEqual({
      conditions: {
        codeBlack: 2,
        critic: 0,
        compromised: 1,
        observation: 0,
        treatment: 3,
        stable: 0,
      },
      vehiclesOnTrip: 9,
      ignored: 4,
    });
  });

  it("sends the list's filters, without the condition and the page", async () => {
    await GET(
      new NextRequest(
        "http://x/c?asset_id=%20AB12%20&symptom_name=Speed&icu_code=4&page=2&limit=13&from=2026-10-15%2000:00:00&to=2026-10-15T23:59:59"
      )
    );

    expect(forwardMock.mock.calls[0][0]).toBe(
      "/api/v1/orgs/acme/control-tower/map/case-counts?p_asset_id=AB12&p_symptom_name=Speed&p_start_date_historic=2026-10-15T00%3A00%3A00&p_end_date_historic=2026-10-15T23%3A59%3A59"
    );
  });

  it("answers zero when the modulith has no counts", async () => {
    forwardMock.mockImplementation(async () => NextResponse.json({}));

    const body = await (await GET(new NextRequest("http://x/c"))).json();

    expect(body.vehiclesOnTrip).toBe(0);
    expect(body.ignored).toBe(0);
    expect(Object.values(body.conditions)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("forces a carrier organization's tax id over the browser's", async () => {
    scopeMock.mockResolvedValue(scope(["carrier-portal"], ["76.111.111-1"]));
    await GET(new NextRequest("http://x/c?carrier_id=someone-else"));
    expect(forwardMock.mock.calls[0][0]).toBe(
      "/api/v1/orgs/acme/control-tower/map/case-counts?p_carrier_id=76.111.111-1"
    );
  });

  it("refuses a carrier organization without tax ids", async () => {
    scopeMock.mockResolvedValue(scope(["carrier-portal"], []));
    const res = await GET(new NextRequest("http://x/c"));
    expect(res.status).toBe(403);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("passes a modulith error through", async () => {
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ error: "unavailable" }, { status: 503 })
    );
    expect((await GET(new NextRequest("http://x/c"))).status).toBe(503);
  });
});
