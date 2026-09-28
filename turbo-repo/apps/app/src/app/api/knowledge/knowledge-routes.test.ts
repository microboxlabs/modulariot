import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAuthMock = vi.fn();

vi.mock("../utils/alfresco-crud-client", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

vi.mock("../utils/tenant-scope", () => ({
  resolveTenantScope: async () => ({
    resolved: true,
    scope: { activeOrg: { slug: "acme" } },
  }),
}));

vi.mock("@/lib/modulith-host", () => ({
  modulithHost: () => "http://modulith.test",
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET as getTrainer } from "./trainer/route";
import { GET as getCards } from "./cards/route";
import { DELETE as deleteCard } from "./cards/[connection]/[cardId]/route";
import {
  PATCH as editCandidate,
  POST as reviewCandidate,
} from "./candidates/[id]/route";

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function candidate(connection: string, status = "approved") {
  return {
    id: `id-${connection}`,
    connection,
    term: "orders",
    kind: null,
    scope: "tenant",
    confidence: null,
    body: "meaning",
    provenance: {},
    status,
    createdBy: "u",
    reviewedBy: "r",
  };
}

const card = {
  id: "orders",
  title: "Orders",
  term: "orders",
  kind: "metric",
  scope: "tenant",
  body: "meaning",
  updated_at: "2026-01-01",
};

beforeEach(() => {
  requireAuthMock.mockResolvedValue({
    authenticated: true,
    session: { user: { email: "ana@example.com", rawJWT: "jwt" } },
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/knowledge/trainer", () => {
  it("asks the modulith for the caller's HARNESS_TRAINER decision", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ permissionCode: "HARNESS_TRAINER", allowed: true })
    );
    const res = await getTrainer();
    expect(await res.json()).toEqual({ trainer: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://modulith.test/api/v1/orgs/acme/permissions/HARNESS_TRAINER/me"
    );
    expect(init.headers.Authorization).toBe("Bearer jwt");
  });

  it("answers 401 without a session", async () => {
    requireAuthMock.mockResolvedValue({
      authenticated: false,
      response: new Response(null, { status: 401 }),
    });
    const res = await getTrainer();
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/knowledge/cards", () => {
  it("lists the cards of each connection with an approved candidate", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json([candidate("b"), candidate("a"), candidate("b")])
      )
      .mockResolvedValueOnce(json({ cards: [card] }))
      .mockResolvedValueOnce(json({ detail: "boom" }, 500));
    const res = await getCards();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connections: [
        { connection: "a", cards: [card] },
        { connection: "b", cards: [], error: true },
      ],
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://modulith.test/api/v1/orgs/acme/knowledge/candidates?status=approved&limit=500"
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://modulith.test/api/v1/orgs/acme/harness/connections/a/knowledge"
    );
  });

  it("answers 403 when the caller is not a trainer", async () => {
    fetchMock
      .mockResolvedValueOnce(json([candidate("a")]))
      .mockResolvedValueOnce(json({ error: "forbidden" }, 403));
    const res = await getCards();
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/knowledge/cards/[connection]/[cardId]", () => {
  const ctx = {
    params: Promise.resolve({ connection: "a b", cardId: "orders" }),
  };

  it("deletes through the harness proxy and answers 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await deleteCard(new Request("http://app.test"), ctx);
    expect(res.status).toBe(204);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://modulith.test/api/v1/orgs/acme/harness/connections/a%20b/knowledge/orders"
    );
    expect(init.method).toBe("DELETE");
  });

  it.each([
    [404, 404],
    [403, 403],
    [500, 502],
  ])("maps an upstream %i to %i", async (upstream, expected) => {
    fetchMock.mockResolvedValueOnce(json({}, upstream));
    const res = await deleteCard(new Request("http://app.test"), ctx);
    expect(res.status).toBe(expected);
  });
});

describe("/api/knowledge/candidates/[id]", () => {
  const ctx = { params: Promise.resolve({ id: "c1" }) };

  function patch(body: unknown): NextRequest {
    return new NextRequest("http://app.test/api/knowledge/candidates/c1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  it("edits the term and body of a pending candidate", async () => {
    fetchMock.mockResolvedValueOnce(json(candidate("a", "pending")));
    const res = await editCandidate(
      patch({ term: " orders ", body: "new meaning" }),
      ctx
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://modulith.test/api/v1/orgs/acme/knowledge/candidates/c1"
    );
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      term: "orders",
      body: "new meaning",
    });
  });

  it("rejects a blank term without calling the modulith", async () => {
    const res = await editCandidate(patch({ term: " ", body: "x" }), ctx);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [404, 404],
    [403, 403],
    [500, 502],
  ])("maps an upstream edit %i to %i", async (upstream, expected) => {
    fetchMock.mockResolvedValueOnce(json({}, upstream));
    const res = await editCandidate(patch({ term: "t", body: "b" }), ctx);
    expect(res.status).toBe(expected);
  });

  it("passes a 403 review through", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 403));
    const req = new NextRequest("http://app.test/api/knowledge/candidates/c1", {
      method: "POST",
      body: JSON.stringify({ decision: "approve" }),
    });
    const res = await reviewCandidate(req, ctx);
    expect(res.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
