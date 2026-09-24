import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const scopeMock = vi.fn();
const forwardMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: (...args: unknown[]) => forwardMock(...args),
}));

import { GET, POST } from "./route";

const req = (url: string, init?: RequestInit) => {
  const r = new Request(url, init) as unknown as import("next/server").NextRequest;
  Object.defineProperty(r, "nextUrl", { value: new URL(url) });
  return r;
};
const ctx = (path?: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/selectables/[[...path]]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({ resolved: true, scope: { activeOrg: { slug: "acme" } } });
    forwardMock.mockResolvedValue(NextResponse.json([]));
  });

  it("lists at the root of the active organization's selectables", async () => {
    await GET(req("http://x/app/api/selectables"), ctx());
    expect(forwardMock).toHaveBeenCalledWith("/api/v1/orgs/acme/selectables", { method: "GET", body: undefined });
  });

  it("forwards sub-paths with the body", async () => {
    await POST(req("http://x/app/api/selectables/reset", { method: "POST" }), ctx(["reset"]));
    expect(forwardMock).toHaveBeenCalledWith("/api/v1/orgs/acme/selectables/reset", { method: "POST", body: {} });
  });

  it("refuses path traversal", async () => {
    const res = await GET(req("http://x/app/api/selectables/x"), ctx([".."]));
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
