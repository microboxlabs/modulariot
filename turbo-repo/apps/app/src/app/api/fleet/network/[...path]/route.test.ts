import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const scopeMock = vi.fn();
const forwardMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: () => {
    throw new Error("the asset network goes to the StreamHub modulith");
  },
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));

import { GET } from "./route";

const req = (url: string) => {
  const r = new Request(url) as unknown as import("next/server").NextRequest;
  Object.defineProperty(r, "nextUrl", { value: new URL(url) });
  return r;
};
const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/fleet/network/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme org" } },
    });
    forwardMock.mockResolvedValue(NextResponse.json([]));
  });

  it("forwards to the active organization's network path", async () => {
    await GET(req("http://x/app/api/fleet/network/assets"), ctx(["assets"]));
    await GET(
      req("http://x/app/api/fleet/network/assets/JAULA-01"),
      ctx(["assets", "JAULA-01"])
    );
    expect(forwardMock.mock.calls).toEqual([
      [
        "/api/v1/orgs/acme%20org/fleet/network/assets",
        { method: "GET", body: undefined },
      ],
      [
        "/api/v1/orgs/acme%20org/fleet/network/assets/JAULA-01",
        { method: "GET", body: undefined },
      ],
    ]);
  });

  it("refuses a path that is not plain segments", async () => {
    const res = await GET(
      req("http://x/app/api/fleet/network/x"),
      ctx(["..", "x"])
    );
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
