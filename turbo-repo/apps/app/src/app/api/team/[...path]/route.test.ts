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

import { DELETE, GET, PATCH, POST } from "./route";

const req = (url: string, init?: RequestInit) => {
  const r = new Request(
    url,
    init
  ) as unknown as import("next/server").NextRequest;
  Object.defineProperty(r, "nextUrl", { value: new URL(url) });
  return r;
};
const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/team/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
    forwardMock.mockResolvedValue(NextResponse.json({ ok: true }));
  });

  it("lists the active organization's members", async () => {
    await GET(req("http://x/app/api/team/members"), ctx(["members"]));
    expect(forwardMock).toHaveBeenCalledWith("/api/v1/orgs/acme/team/members", {
      method: "GET",
      body: undefined,
    });
  });

  it("forwards role changes and invitations with their body", async () => {
    await PATCH(
      req("http://x/app/api/team/members/u-1", {
        method: "PATCH",
        body: JSON.stringify({ baseRole: "ADMIN" }),
      }),
      ctx(["members", "u-1"])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/team/members/u-1",
      {
        method: "PATCH",
        body: { baseRole: "ADMIN" },
      }
    );

    await POST(
      req("http://x/app/api/team/invitations", {
        method: "POST",
        body: JSON.stringify({ emails: ["a@b.cl"] }),
      }),
      ctx(["invitations"])
    );
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/acme/team/invitations",
      {
        method: "POST",
        body: { emails: ["a@b.cl"] },
      }
    );
  });

  it("refuses path segments that could leave the team API", async () => {
    const res = await DELETE(
      req("http://x/app/api/team/..%2Froles", { method: "DELETE" }),
      ctx(["..", "roles"])
    );
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("answers with the scope error when there is no active organization", async () => {
    scopeMock.mockResolvedValue({
      resolved: false,
      response: NextResponse.json(
        { error: "No organization" },
        { status: 403 }
      ),
    });
    const res = await GET(
      req("http://x/app/api/team/members"),
      ctx(["members"])
    );
    expect(res.status).toBe(403);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
