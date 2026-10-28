import { beforeEach, describe, expect, it, vi } from "vitest";

const { scopeMock, forwardMock } = vi.hoisted(() => ({
  scopeMock: vi.fn(),
  forwardMock: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: scopeMock,
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: forwardMock,
}));

import { DELETE, GET, PUT, POST } from "./route";

const context = (path?: string[]) => ({ params: Promise.resolve({ path }) });

beforeEach(() => {
  scopeMock.mockReset().mockResolvedValue({
    resolved: true,
    scope: { activeOrg: { slug: "acme" } },
  });
  forwardMock.mockReset().mockResolvedValue(new Response("{}"));
});

describe("query-sources proxy", () => {
  it("forwards to the active org with only the schema parameters", async () => {
    await GET(
      new Request(
        "https://app.test/api/query-sources/c1/schema?org=acme&projectId=analytics-prod&refresh=1&tenantId=foreign"
      ),
      context(["c1", "schema"])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/query-sources/c1/schema?projectId=analytics-prod&refresh=1",
      expect.objectContaining({ method: "GET", timeoutMs: 30_000 })
    );
  });

  it("passes the revision of a saved query", async () => {
    await PUT(
      new Request("https://app.test/api/query-sources/c1/plans/p1", {
        method: "PUT",
        body: JSON.stringify({ name: "Daily" }),
        headers: { "if-match": '"17"' },
      }),
      context(["c1", "plans", "p1"])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/query-sources/c1/plans/p1",
      expect.objectContaining({
        method: "PUT",
        body: { name: "Daily" },
        ifMatch: '"17"',
      })
    );
  });

  it("refuses another org's tab and dot segments", async () => {
    const other = await DELETE(
      new Request("https://app.test/api/query-sources/c1/plans/p1?org=globex", {
        method: "DELETE",
      }),
      context(["c1", "plans", "p1"])
    );
    expect(other.status).toBe(409);
    const dots = await GET(
      new Request("https://app.test/api/query-sources/x"),
      context(["..", "plans"])
    );
    expect(dots.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});

it.each(["estimate", "plans"])(
  "allows the server dry run to finish for %s writes and propagates cancellation",
  async (action) => {
    const request = new Request(
      `https://app.test/api/query-sources/demo/${action}?org=acme`,
      { method: "POST", body: JSON.stringify({ sql: "SELECT 1" }) }
    );
    await POST(request, context(["demo", action]));
    expect(forwardMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ timeoutMs: 30_000, signal: request.signal })
    );
  }
);
