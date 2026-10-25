import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const scopeMock = vi.fn();
const forwardMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: () => {
    throw new Error("trips go to the StreamHub modulith");
  },
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));

import { DELETE, GET, POST, PUT } from "./route";

const req = (url: string, init?: RequestInit) => {
  const r = new Request(
    url,
    init
  ) as unknown as import("next/server").NextRequest;
  Object.defineProperty(r, "nextUrl", { value: new URL(url) });
  return r;
};
const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/trips/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
    forwardMock.mockResolvedValue(NextResponse.json({}));
  });

  it("forwards to the active organization's trips path with the session", async () => {
    await GET(req("http://x/app/api/trips/monitors"), ctx(["monitors"]));
    await PUT(
      req("http://x/app/api/trips/monitors/direct", {
        method: "PUT",
        body: JSON.stringify({ name: "Direct" }),
      }),
      ctx(["monitors", "direct"])
    );
    await DELETE(
      req("http://x/app/api/trips/monitors/direct/draft", { method: "DELETE" }),
      ctx(["monitors", "direct", "draft"])
    );
    expect(forwardMock.mock.calls).toEqual([
      [
        "/api/v1/orgs/acme/trips/monitors",
        { method: "GET", body: undefined, sessionOnly: true },
      ],
      [
        "/api/v1/orgs/acme/trips/monitors/direct",
        { method: "PUT", body: { name: "Direct" }, sessionOnly: true },
      ],
      [
        "/api/v1/orgs/acme/trips/monitors/direct/draft",
        { method: "DELETE", body: undefined, sessionOnly: true },
      ],
    ]);
  });

  it("refuses an empty path and odd segments", async () => {
    expect((await GET(req("http://x/app/api/trips"), ctx([]))).status).toBe(
      400
    );
    expect(
      (await GET(req("http://x/app/api/trips/x"), ctx(["monitors", "a/b"])))
        .status
    ).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("forwards a milestone confirmation under the trip path", async () => {
    await POST(
      req("http://x/app/api/trips/test-trip/milestones/departure/confirm", {
        method: "POST",
        body: JSON.stringify({ channel: "ui" }),
      }),
      ctx(["test-trip", "milestones", "departure", "confirm"])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/trips/test-trip/milestones/departure/confirm",
      { method: "POST", body: { channel: "ui" }, sessionOnly: true }
    );
  });
});
