import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/app/api/utils/alfresco-crud-client", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: async () => ({
    resolved: true,
    scope: { activeOrg: { slug: "acme" } },
  }),
}));

vi.mock("@/auth", () => ({ auth: () => authMock() }));

vi.mock("@/lib/modulith-host", () => ({
  modulithHost: () => "http://modulith.test",
}));

import * as knowledge from "./knowledge/[...path]/route";
import * as learning from "./learning/[...path]/route";
import { GET as getTranscript } from "./transcripts/[ref]/route";
import { GET as listThreads } from "./threads/route";

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const paths = (path: string[]) => ({ params: Promise.resolve({ path }) });

beforeEach(() => {
  requireAuthMock.mockResolvedValue({
    authenticated: true,
    session: { user: { rawJWT: "jwt" } },
  });
  authMock.mockResolvedValue({
    user: { id: "u1", rawJWT: "jwt", email: "trainer@example.test" },
  });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/harness/knowledge/[...path]", () => {
  it("forwards a read under the org's harness proxy with the user's token and query", async () => {
    const res = await knowledge.GET(
      new Request(
        "http://app/api/harness/knowledge/items/fact/states?target=trips"
      ),
      paths(["items", "fact", "states"])
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "http://modulith.test/api/v1/orgs/acme/harness/knowledge/items/fact/states?target=trips"
    );
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer jwt");
  });

  it("forwards a new version as JSON", async () => {
    const body = { title: "T", content: "C", reason: "R" };
    await knowledge.PUT(
      new Request("http://app/api/harness/knowledge/items/rule/loaded", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
      paths(["items", "rule", "loaded"])
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "http://modulith.test/api/v1/orgs/acme/harness/knowledge/items/rule/loaded"
    );
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(body);
  });

  it("forwards a revert and a delete", async () => {
    await knowledge.POST(
      new Request("http://app/x", {
        method: "POST",
        body: JSON.stringify({ version: 1 }),
      }),
      paths(["items", "rule", "loaded", "revert"])
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await knowledge.DELETE(
      new Request("http://app/x?reason=old", { method: "DELETE" }),
      paths(["items", "rule", "loaded"])
    );
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://modulith.test/api/v1/orgs/acme/harness/knowledge/items/rule/loaded/revert"
    );
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "http://modulith.test/api/v1/orgs/acme/harness/knowledge/items/rule/loaded?reason=old"
    );
    expect(res.status).toBe(204);
  });

  it("encodes each segment and refuses a dot segment", async () => {
    await knowledge.GET(
      new Request("http://app/x"),
      paths(["items", "fact", "a b"])
    );
    expect(fetchMock.mock.calls[0]![0]).toContain(
      "/knowledge/items/fact/a%20b"
    );
    const res = await knowledge.GET(
      new Request("http://app/x"),
      paths(["items", "..", "secrets"])
    );
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a write without a JSON body", async () => {
    const res = await knowledge.PUT(
      new Request("http://app/x", { method: "PUT", body: "not json" }),
      paths(["items", "rule", "a"])
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the modulith's 403 for a non-trainer through", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "forbidden" }, 403));
    const res = await knowledge.GET(
      new Request("http://app/x"),
      paths(["layers"])
    );
    expect(res.status).toBe(403);
  });

  it("answers 401 without a session", async () => {
    requireAuthMock.mockResolvedValue({
      authenticated: false,
      response: new Response(null, { status: 401 }),
    });
    const res = await knowledge.GET(
      new Request("http://app/x"),
      paths(["layers"])
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("/api/harness/learning/[...path]", () => {
  it("starts and reads evaluations", async () => {
    const body = { cases: [{ question: "q", expectation: "e" }], changes: [] };
    await learning.POST(
      new Request("http://app/x", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      paths(["evaluations"])
    );
    await learning.GET(
      new Request("http://app/x"),
      paths(["evaluations", "ev1"])
    );
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://modulith.test/api/v1/orgs/acme/harness/learning/evaluations"
    );
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual(body);
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "http://modulith.test/api/v1/orgs/acme/harness/learning/evaluations/ev1"
    );
  });
});

describe("/api/harness/transcripts/[ref]", () => {
  it("reads a transcript by share token or thread id", async () => {
    await getTranscript(new Request("http://app/x"), {
      params: Promise.resolve({ ref: "tok_1" }),
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://modulith.test/api/v1/orgs/acme/harness/transcripts/tok_1"
    );
  });
});

describe("/api/harness/threads", () => {
  it("passes the kind filter on", async () => {
    await listThreads(
      new Request(
        "http://app/api/harness/threads?kind=learning&limit=20&other=x"
      )
    );
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://modulith.test/api/v1/orgs/acme/chat/threads?limit=20&kind=learning"
    );
  });

  it("asks for every thread when no filter is given", async () => {
    await listThreads(new Request("http://app/api/harness/threads"));
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://modulith.test/api/v1/orgs/acme/chat/threads"
    );
  });
});
