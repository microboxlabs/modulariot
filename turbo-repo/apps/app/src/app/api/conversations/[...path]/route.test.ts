import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const scopeMock = vi.fn();
const forwardMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: () => {
    throw new Error("conversations go to the StreamHub modulith");
  },
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));

import { GET, PUT } from "./route";

const req = (url: string, init?: RequestInit) => {
  const r = new Request(
    url,
    init
  ) as unknown as import("next/server").NextRequest;
  Object.defineProperty(r, "nextUrl", { value: new URL(url) });
  return r;
};
const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/conversations/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
    forwardMock.mockResolvedValue(NextResponse.json({ ok: true }));
  });

  it("forwards to the active organization's conversations path with the query", async () => {
    await GET(
      req("http://x/app/api/conversations/runs?rule=r1&limit=50"),
      ctx(["runs"])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/conversations/runs?rule=r1&limit=50",
      { method: "GET", body: undefined }
    );
  });

  it("passes the JSON body on writes", async () => {
    await PUT(
      req("http://x/app/api/conversations/rules/r1/draft", {
        method: "PUT",
        body: JSON.stringify({ spec: { steps: [] } }),
      }),
      ctx(["rules", "r1", "draft"])
    );
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/acme/conversations/rules/r1/draft",
      { method: "PUT", body: { spec: { steps: [] } } }
    );
  });

  it("refuses a path segment with a dot or a slash", async () => {
    const res = await GET(
      req("http://x/app/api/conversations/rules/..%2Fx"),
      ctx(["rules", "../x"])
    );
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
