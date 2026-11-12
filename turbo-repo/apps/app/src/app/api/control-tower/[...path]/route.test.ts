import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const scheduled = vi.hoisted(() => [] as Array<() => Promise<void>>);
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (callback: () => Promise<void>) => scheduled.push(callback),
}));
const scopeMock = vi.fn();
const forwardMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: () => {
    throw new Error("the Control Tower goes to the StreamHub modulith");
  },
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));

import { DELETE, GET, POST } from "./route";

const req = (url: string, init?: RequestInit) => {
  const r = new Request(
    url,
    init
  ) as unknown as import("next/server").NextRequest;
  Object.defineProperty(r, "nextUrl", { value: new URL(url) });
  return r;
};
const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/control-tower/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduled.length = 0;
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: {
        activeOrg: { slug: "acme org" },
        availableOrgs: [{ slug: "acme org" }, { slug: "symptoms" }],
      },
    });
    forwardMock.mockResolvedValue(NextResponse.json({ ok: true }));
  });

  it("forwards to the active organization's Control Tower path with the query", async () => {
    await GET(
      req("http://x/app/api/control-tower/contacts?active=true"),
      ctx(["contacts"])
    );
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

    await POST(
      req("http://x/app/api/control-tower/treatments/t1/close", {
        method: "POST",
      }),
      ctx(["treatments", "t1", "close"])
    );
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/acme%20org/control-tower/treatments/t1/close",
      { method: "POST", body: {} }
    );
  });

  it("never lets the browser pick the organization or climb the path", async () => {
    const traversal = await DELETE(
      req("http://x/app/api/control-tower/x"),
      ctx(["..", "orgs"])
    );
    expect(traversal.status).toBe(400);
    const empty = await GET(req("http://x/app/api/control-tower"), ctx([]));
    expect(empty.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and returns the scope failure as is", async () => {
    const bad = await POST(
      req("http://x/app/api/control-tower/contacts", {
        method: "POST",
        body: "{nope",
      }),
      ctx(["contacts"])
    );
    expect(bad.status).toBe(400);

    scopeMock.mockResolvedValue({
      resolved: false,
      response: NextResponse.json({}, { status: 403 }),
    });
    const denied = await GET(
      req("http://x/app/api/control-tower/contacts"),
      ctx(["contacts"])
    );
    expect(denied.status).toBe(403);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("forwards a save as template", async () => {
    await POST(
      req(
        "http://x/app/api/control-tower/symptom-definitions/abc/save-as-template",
        {
          method: "POST",
          body: "{}",
        }
      ),
      ctx(["symptom-definitions", "abc", "save-as-template"])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/control-tower/symptom-definitions/abc/save-as-template",
      { method: "POST", body: {} }
    );
  });

  it.each([
    "webrtc-token",
    "reconcile",
    "calls/ref-1/ended",
    "whatsapp-calls/incoming-1/answer",
  ])("forwards telephony %s", async (endpoint) => {
    await POST(
      req(`http://x/app/api/control-tower/telephony/${endpoint}`, {
        method: "POST",
      }),
      ctx(["telephony", ...endpoint.split("/")])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      `/api/v1/orgs/acme%20org/control-tower/telephony/${endpoint}`,
      { method: "POST", body: {} }
    );
  });
});

describe("an opening request whose browser disconnected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduled.length = 0;
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: {
        activeOrg: { slug: "acme org" },
        availableOrgs: [{ slug: "acme org" }, { slug: "symptoms" }],
      },
    });
    forwardMock.mockResolvedValue(NextResponse.json({}));
  });
  it("abandons a new treatment after its delayed response, using the original organization", async () => {
    const controller = new AbortController();
    let complete!: (response: NextResponse) => void;
    forwardMock.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    const response = POST(
      req("http://x/api/control-tower/symptoms/-7/treatments", {
        method: "POST",
        body: '{"type":"CALL"}',
        signal: controller.signal,
      }),
      ctx(["symptoms", "-7", "treatments"])
    );
    await vi.waitFor(() => expect(forwardMock).toHaveBeenCalled());
    controller.abort();
    complete(NextResponse.json({ id: "synthetic-treatment" }, { status: 201 }));
    expect((await response).status).toBe(201);
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "different-org" } },
    });
    await scheduled[0]!();
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/acme%20org/control-tower/treatments/synthetic-treatment/abandon",
      { method: "POST", body: {} }
    );
  });

  it("keeps a newly created episode when its response reaches the browser", async () => {
    forwardMock.mockResolvedValue(
      NextResponse.json({ id: "synthetic-treatment" }, { status: 201 })
    );
    await POST(
      req("http://x/api/control-tower/symptoms/-7/treatments", {
        method: "POST",
      }),
      ctx(["symptoms", "-7", "treatments"])
    );
    await scheduled[0]!();
    expect(forwardMock).toHaveBeenCalledTimes(1);
  });

  it.each([200, 409])(
    "does not abandon a resumed or refused treatment (%s)",
    async (status) => {
      scopeMock.mockResolvedValue({
        resolved: true,
        scope: {
          activeOrg: { slug: "acme org" },
          availableOrgs: [{ slug: "acme org" }, { slug: "symptoms" }],
        },
      });
      forwardMock.mockResolvedValue(
        NextResponse.json({ id: "synthetic-treatment" }, { status })
      );
      await POST(
        req("http://x/api/control-tower/symptoms/-7/treatments", {
          method: "POST",
          signal: AbortSignal.abort(),
        }),
        ctx(["symptoms", "-7", "treatments"])
      );
      await scheduled.at(-1)!();
      expect(forwardMock).toHaveBeenCalledTimes(1);
    }
  );
});

describe("deferred treatment cleanup scope and actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduled.length = 0;
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: {
        activeOrg: { slug: "new-org" },
        availableOrgs: [{ slug: "new-org" }, { slug: "old-org" }],
      },
    });
    forwardMock.mockResolvedValue(NextResponse.json({}));
  });
  it("abandons in the original organization after the active one changes", async () => {
    await POST(
      req("http://x/api/control-tower/treatments/t1/abandon", {
        method: "POST",
        body: JSON.stringify({ organizationSlug: "old-org" }),
      }),
      ctx(["treatments", "t1", "abandon"])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/old-org/control-tower/treatments/t1/abandon",
      { method: "POST", body: {} }
    );
  });
  it("rejects an original organization the caller does not belong to", async () => {
    const result = await POST(
      req("http://x/api/control-tower/treatments/t1/abandon", {
        method: "POST",
        body: JSON.stringify({ organizationSlug: "foreign-org" }),
      }),
      ctx(["treatments", "t1", "abandon"])
    );
    expect(result.status).toBe(403);
    expect(forwardMock).not.toHaveBeenCalled();
  });
  it("cleans up a failed action after a client disconnect", async () => {
    forwardMock.mockResolvedValueOnce(
      NextResponse.json({ error: "failed" }, { status: 500 })
    );
    await POST(
      req("http://x/api/control-tower/treatments/t1/actions", {
        method: "POST",
        signal: AbortSignal.abort(),
      }),
      ctx(["treatments", "t1", "actions"])
    );
    await scheduled[0]!();
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/new-org/control-tower/treatments/t1/abandon",
      { method: "POST", body: {} }
    );
  });
  it("does not confuse an organization named symptoms with the resource", async () => {
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: {
        activeOrg: { slug: "symptoms" },
        availableOrgs: [{ slug: "symptoms" }],
      },
    });
    forwardMock.mockResolvedValueOnce(
      NextResponse.json({ id: "t1" }, { status: 201 })
    );
    const result = await POST(
      req("http://x/api/control-tower/symptoms/-7/treatments", {
        method: "POST",
        signal: AbortSignal.abort(),
      }),
      ctx(["symptoms", "-7", "treatments"])
    );
    expect(result.headers.get("X-Control-Tower-Organization")).toBe("symptoms");
    await scheduled[0]!();
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/symptoms/control-tower/treatments/t1/abandon",
      { method: "POST", body: {} }
    );
  });
});
