import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  scope: vi.fn(),
  permission: vi.fn(),
  upstream: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: mocks.scope,
}));
vi.mock("@/features/auth/access/server-access", () => ({
  requirePermission: mocks.permission,
}));
import { GET, POST } from "./route";

const session = { user: { id: "demo-user", email: "demo@example.test" } };
const tenant = (carrier = true, ids = ["DEMO-ORG-A"]) => ({
  resolved: true,
  scope: {
    activeOrg: {
      slug: "demo-a",
      modules: carrier ? ["CARRIER_PORTAL"] : ["controltower"],
    },
    effectiveTaxIds: ids,
  },
  session,
});
const context = (fn: string) => ({ params: Promise.resolve({ fn }) });
const request = (body: unknown = {}) =>
  new NextRequest("http://localhost/api/atc/rpc/fn_pt4_create_place", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.upstream);
  mocks.auth.mockResolvedValue(session);
  mocks.scope.mockResolvedValue(tenant());
  mocks.permission.mockResolvedValue({ authorized: true, session });
  mocks.upstream.mockImplementation(
    async () =>
      new Response("[]", { headers: { "content-type": "application/json" } })
  );
});

describe("Places RPC authorization and tenant isolation", () => {
  it("requires the server-side places edit permission before writing", async () => {
    mocks.permission.mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await POST(request(), context("fn_pt4_create_place"));
    expect(response.status).toBe(403);
    expect(mocks.permission).toHaveBeenCalledWith(
      { requiredPermissions: ["controltower:places.edit"] },
      expect.any(String)
    );
    expect(mocks.upstream).not.toHaveBeenCalled();
  });

  it.each(["GET", "POST"])(
    "fails closed when %s cannot resolve the organization",
    async (method) => {
      mocks.scope.mockResolvedValue({
        resolved: false,
        response: NextResponse.json({ error: "Unavailable" }, { status: 502 }),
      });
      const response =
        method === "GET"
          ? await GET(
              new NextRequest("http://localhost/api/atc/rpc/fn_pt4_places"),
              context("fn_pt4_places")
            )
          : await POST(request(), context("fn_pt4_create_place"));
      expect(response.status).toBe(502);
      expect(mocks.upstream).not.toHaveBeenCalled();
    }
  );

  it("replaces an injected tenant with the carrier organization on reads and writes", async () => {
    await GET(
      new NextRequest(
        "http://localhost/api/atc/rpc/fn_pt4_places?p_org_id=DEMO-ORG-B"
      ),
      context("fn_pt4_places")
    );
    expect(
      new URL(mocks.upstream.mock.calls[0][0]).searchParams.get("p_org_id")
    ).toBe("DEMO-ORG-A");
    await POST(
      request({ p_org_id: "DEMO-ORG-B", p_name: "Demo site" }),
      context("fn_pt4_create_place")
    );
    expect(JSON.parse(mocks.upstream.mock.calls[1][1].body)).toMatchObject({
      p_org_id: "DEMO-ORG-A",
      p_name: "Demo site",
    });
  });

  it("never accepts a caller-selected tenant for the global layer", async () => {
    mocks.scope.mockResolvedValue(tenant(false));
    await GET(
      new NextRequest(
        "http://localhost/api/atc/rpc/fn_pt4_places?p_org_id=DEMO-ORG-B"
      ),
      context("fn_pt4_places")
    );
    expect(
      new URL(mocks.upstream.mock.calls[0][0]).searchParams.has("p_org_id")
    ).toBe(false);
    await POST(
      request({ p_org_id: "DEMO-ORG-B", p_name: "Demo site" }),
      context("fn_pt4_create_place")
    );
    expect(JSON.parse(mocks.upstream.mock.calls[1][1].body)).not.toHaveProperty(
      "p_org_id"
    );
  });

  it.each([
    { body: null },
    { body: [] },
    { body: "text" },
    { body: 3 },
    { body: false },
  ])("refuses a non-object RPC body: $body", async ({ body }) => {
    const response = await POST(request(body), context("fn_pt4_create_place"));
    expect(response.status).toBe(400);
    expect(mocks.upstream).not.toHaveBeenCalled();
  });

  it("refuses a carrier with no tax identifiers", async () => {
    mocks.scope.mockResolvedValue(tenant(true, []));
    const response = await POST(request(), context("fn_pt4_create_place"));
    expect(response.status).toBe(403);
    expect(mocks.upstream).not.toHaveBeenCalled();
  });

  it("denies an unsigned caller and unknown RPC functions", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(
      (
        await GET(
          new NextRequest("http://localhost/api/atc/rpc/fn_pt4_places"),
          context("fn_pt4_places")
        )
      ).status
    ).toBe(401);
    expect(mocks.upstream).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue(session);
    expect((await POST(request(), context("arbitrary_rpc"))).status).toBe(403);
    expect(mocks.upstream).not.toHaveBeenCalled();
  });
});
