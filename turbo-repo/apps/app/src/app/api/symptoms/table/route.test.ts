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

const page = {
  data: [
    {
      id: 7,
      icu_condition: "Critical",
      icu_code: "3",
      asset_id: "AB12",
      duration_sec: 60,
      trip_id: "T1",
      driver: "Ana",
      start_time: "2026-10-08T10:00:00Z",
      type_of_incidence: "Speed",
      treatment_count: 0,
      last_assigned_to: null,
    },
  ],
  page: 1,
  page_size: 10,
  total_rows: 1,
  total_pages: 1,
  symptom_name_list: ["Speed"],
};

describe("GET /api/symptoms/table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue(scope());
    forwardMock.mockImplementation(async () => NextResponse.json(page));
  });

  it("maps the filters and reads the page through the modulith", async () => {
    const res = await GET(
      new NextRequest(
        "http://x/t?icu_code=3&page=1&limit=10&asset_id=%20AB12%20&carrier_id="
      )
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/symptoms?p_asset_id=AB12&p_icu_code=3&p_page_size=10&p_page=1",
      { method: "GET", sessionOnly: true }
    );
    const body = await res.json();
    expect(body.data[0]).toMatchObject({
      id: "7",
      condition: "critical",
      licensePlate: "AB12",
      status: "",
    });
    expect(body.pagination).toEqual({
      total_rows: 1,
      total_pages: 1,
      currentPage: 1,
      page_size: 10,
    });
    expect(body.symptoms_list).toEqual(["Speed"]);
  });

  it("forces a carrier organization's tax id over the browser's", async () => {
    scopeMock.mockResolvedValue(scope(["carrier-portal"], ["76.111.111-1"]));
    await GET(new NextRequest("http://x/t?carrier_id=someone-else"));
    expect(forwardMock.mock.calls[0][0]).toBe(
      "/api/v1/orgs/acme/control-tower/map/symptoms?p_carrier_id=76.111.111-1"
    );
  });

  it("refuses a carrier organization without tax ids", async () => {
    scopeMock.mockResolvedValue(scope(["carrier-portal"], []));
    const res = await GET(new NextRequest("http://x/t"));
    expect(res.status).toBe(403);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("passes a modulith error through", async () => {
    forwardMock.mockImplementation(async () =>
      NextResponse.json(
        { error: "GPS data is not configured" },
        { status: 503 }
      )
    );
    expect((await GET(new NextRequest("http://x/t"))).status).toBe(503);
  });
});
