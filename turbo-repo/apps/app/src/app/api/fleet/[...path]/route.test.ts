import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const scopeMock = vi.fn();
const forwardMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: () => {
    throw new Error("the fleet goes to the StreamHub modulith");
  },
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));

import { GET, PATCH } from "./route";

const req = (url: string, init?: RequestInit) => {
  const r = new Request(
    url,
    init
  ) as unknown as import("next/server").NextRequest;
  Object.defineProperty(r, "nextUrl", { value: new URL(url) });
  return r;
};
const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/fleet/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme org" } },
    });
    forwardMock.mockResolvedValue(NextResponse.json({}));
  });

  it("forwards to the active organization's fleet path, query included", async () => {
    await GET(
      req("http://x/app/api/fleet/assets?kind=TRUCK&page=1"),
      ctx(["assets"])
    );
    await GET(
      req("http://x/app/api/fleet/assets/00:1A:2B:3C"),
      ctx(["assets", "00:1A:2B:3C"])
    );
    expect(forwardMock.mock.calls).toEqual([
      [
        "/api/v1/orgs/acme%20org/fleet/assets?kind=TRUCK&page=1",
        { method: "GET", body: undefined, sessionOnly: true },
      ],
      [
        "/api/v1/orgs/acme%20org/fleet/assets/00%3A1A%3A2B%3A3C",
        { method: "GET", body: undefined, sessionOnly: true },
      ],
    ]);
  });

  it("sends edits with their body", async () => {
    await PATCH(
      req("http://x/app/api/fleet/assets/AB 12", {
        method: "PATCH",
        body: JSON.stringify({ fields: { label: "Tracto" } }),
      }),
      ctx(["assets", "AB 12"])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/fleet/assets/AB%2012",
      {
        method: "PATCH",
        body: { fields: { label: "Tracto" } },
        sessionOnly: true,
      }
    );
  });

  it("refuses dot-only and slash segments", async () => {
    for (const path of [
      ["..", "x"],
      ["assets", "a/b"],
      ["assets", "."],
    ]) {
      const res = await GET(req("http://x/app/api/fleet/x"), ctx(path));
      expect(res.status).toBe(400);
    }
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
