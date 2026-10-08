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

import { GET as positions } from "./route";
import { GET as summary } from "./resume/route";
import { GET as dashboard } from "../symptoms/dashboard/route";

const req = (url: string) => new NextRequest(url);

describe("map and dashboard routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme org" } },
    });
    forwardMock.mockResolvedValue(NextResponse.json([]));
  });

  it("reads positions and the summary of the active organization", async () => {
    await positions();
    await summary();
    expect(forwardMock.mock.calls).toEqual([
      [
        "/api/v1/orgs/acme%20org/control-tower/map/positions",
        { method: "GET" },
      ],
      ["/api/v1/orgs/acme%20org/control-tower/map/summary", { method: "GET" }],
    ]);
  });

  it("returns the scope's response when there is no active organization", async () => {
    scopeMock.mockResolvedValue({
      resolved: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    expect((await positions()).status).toBe(401);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("maps condition counts to the dashboard cards", async () => {
    forwardMock.mockResolvedValue(
      NextResponse.json({
        "Critical condition": 2,
        "Code Black": 1,
        "Under Treatment": 4,
      })
    );
    const res = await dashboard(req("http://x/app/api/symptoms/dashboard"));
    expect(await res.json()).toEqual({
      critic: 2,
      stable: 0,
      codeBlack: 1,
      remission: 0,
      treatment: 4,
      compromised: 0,
      observation: 0,
    });
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/control-tower/map/conditions",
      { method: "GET" }
    );
  });

  it("sends the date range only when both dates are given", async () => {
    forwardMock.mockImplementation(async () => NextResponse.json({}));
    await dashboard(req("http://x/d?from=2026-10-01&to=2026-10-07"));
    await dashboard(req("http://x/d?from=2026-10-01"));
    expect(forwardMock.mock.calls.map((c) => c[0])).toEqual([
      "/api/v1/orgs/acme%20org/control-tower/map/conditions?from=2026-10-01&to=2026-10-07",
      "/api/v1/orgs/acme%20org/control-tower/map/conditions",
    ]);
  });

  it("passes a modulith error through", async () => {
    forwardMock.mockResolvedValue(
      NextResponse.json(
        { error: "GPS data is not configured" },
        { status: 503 }
      )
    );
    const res = await dashboard(req("http://x/d"));
    expect(res.status).toBe(503);
  });
});
