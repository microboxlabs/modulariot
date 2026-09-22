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

import { DELETE, GET, POST } from "./route";

const req = (url: string, init?: RequestInit) => {
  const r = new Request(url, init) as unknown as import("next/server").NextRequest;
  Object.defineProperty(r, "nextUrl", { value: new URL(url) });
  return r;
};
const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/control-tower/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({ resolved: true, scope: { activeOrg: { slug: "acme org" } } });
    forwardMock.mockResolvedValue(NextResponse.json({ ok: true }));
  });

  it("forwards to the active organization's Control Tower path with the query", async () => {
    await GET(req("http://x/app/api/control-tower/contacts?active=true"), ctx(["contacts"]));
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/control-tower/contacts?active=true",
      { method: "GET", body: undefined }
    );
  });

  it("passes the JSON body on writes and an empty object when there is none", async () => {
    await POST(
      req("http://x/app/api/control-tower/symptoms/42/treatments", {
        method: "POST",
        body: JSON.stringify({ type: "CALL" }),
      }),
      ctx(["symptoms", "42", "treatments"])
    );
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/acme%20org/control-tower/symptoms/42/treatments",
      { method: "POST", body: { type: "CALL" } }
    );

    await POST(req("http://x/app/api/control-tower/selectables/reset", { method: "POST" }), ctx(["selectables", "reset"]));
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/acme%20org/control-tower/selectables/reset",
      { method: "POST", body: {} }
    );
  });

  it("never lets the browser pick the organization or climb the path", async () => {
    const traversal = await DELETE(req("http://x/app/api/control-tower/x"), ctx(["..", "orgs"]));
    expect(traversal.status).toBe(400);
    const empty = await GET(req("http://x/app/api/control-tower"), ctx([]));
    expect(empty.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and returns the scope failure as is", async () => {
    const bad = await POST(
      req("http://x/app/api/control-tower/contacts", { method: "POST", body: "{nope" }),
      ctx(["contacts"])
    );
    expect(bad.status).toBe(400);

    scopeMock.mockResolvedValue({ resolved: false, response: NextResponse.json({}, { status: 403 }) });
    const denied = await GET(req("http://x/app/api/control-tower/contacts"), ctx(["contacts"]));
    expect(denied.status).toBe(403);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
