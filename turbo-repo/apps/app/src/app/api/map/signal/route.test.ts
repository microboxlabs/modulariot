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

import { GET } from "./route";

describe("asset signal route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
    forwardMock.mockResolvedValue(NextResponse.json({ state: "online" }));
  });

  it("reads the asset's signal of the active organization", async () => {
    await GET(new NextRequest("http://x/app/api/map/signal?assetId=AB%2012"));
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/assets/AB%2012/signal",
      { method: "GET", sessionOnly: true }
    );
  });

  it("needs an asset", async () => {
    const res = await GET(new NextRequest("http://x/app/api/map/signal"));
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
