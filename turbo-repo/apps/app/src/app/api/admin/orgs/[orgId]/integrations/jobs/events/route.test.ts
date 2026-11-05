import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  value: { user: { id: "u1", email: "ana@example.com" } } as unknown,
}));
vi.mock("@/auth", () => ({ auth: async () => session.value }));
vi.mock("@/lib/modulith-host", () => ({
  modulithHost: () => "http://modulith.test/",
}));
vi.mock("@/features/auth/services/session-auth", () => ({
  sessionAuthHeader: () => ({ Authorization: "Bearer user-jwt" }),
}));

import { GET } from "./route";

const params = { params: Promise.resolve({ orgId: "org a" }) };

describe("GET /api/admin/orgs/[orgId]/integrations/jobs/events", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    session.value = { user: { id: "u1", email: "ana@example.com" } };
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("relays the org's job stream from the modulith with the caller's token", async () => {
    fetchMock.mockResolvedValue(new Response("data: {}\n\n", { status: 200 }));
    const request = new Request("http://app.test/x");

    const response = await GET(request, params);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://modulith.test/api/v1/orgs/org%20a/integrations/console/jobs/events"
    );
    expect(init.headers).toMatchObject({
      Authorization: "Bearer user-jwt",
      Accept: "text/event-stream",
    });
    expect(init.signal).toBe(request.signal);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(await response.text()).toBe("data: {}\n\n");
  });

  it("passes the modulith's refusal through and needs a session", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 403 }));
    expect((await GET(new Request("http://app.test/x"), params)).status).toBe(
      403
    );

    session.value = null;
    expect((await GET(new Request("http://app.test/x"), params)).status).toBe(
      401
    );
  });
});
