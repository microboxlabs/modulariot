import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveTenantScopeMock = vi.fn();
const forwardToQuarkusMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => resolveTenantScopeMock(),
}));

vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: (...args: unknown[]) => forwardToQuarkusMock(...args),
}));

import { forwardToOrg, orgPath, pickQuery } from "./org-proxy";
import { GET as listStoriesRoute } from "../stories/route";
import { DELETE as revokeShareRoute } from "../stories/[storyId]/shares/[principal]/route";

beforeEach(() => {
  resolveTenantScopeMock.mockReset();
  forwardToQuarkusMock.mockReset();
  resolveTenantScopeMock.mockResolvedValue({
    resolved: true,
    scope: { activeOrg: { slug: "acme org" } },
  });
  forwardToQuarkusMock.mockResolvedValue(new Response("[]"));
});

describe("orgPath", () => {
  it("encodes every segment under the org", () => {
    expect(orgPath("acme", ["stories", "a/b", "shares", "x@y.com"])).toBe(
      "/api/v1/orgs/acme/stories/a%2Fb/shares/x%40y.com"
    );
  });

  it("appends a query only when it has values", () => {
    expect(orgPath("acme", ["stories"], new URLSearchParams())).toBe(
      "/api/v1/orgs/acme/stories"
    );
    expect(
      orgPath("acme", ["stories"], new URLSearchParams({ kind: "pdf" }))
    ).toBe("/api/v1/orgs/acme/stories?kind=pdf");
  });
});

describe("pickQuery", () => {
  it("keeps only named keys whose values match their rule", () => {
    const picked = pickQuery(new URLSearchParams("kind=pdf&limit=abc&evil=1"), {
      kind: /^pdf$/,
      limit: /^\d+$/,
    });
    expect(picked.toString()).toBe("kind=pdf");
  });
});

describe("forwardToOrg", () => {
  it("returns the tenant-scope response when no org resolves", async () => {
    const denied = new Response(null, { status: 403 });
    resolveTenantScopeMock.mockResolvedValue({
      resolved: false,
      response: denied,
    });
    expect(await forwardToOrg(["stories"])).toBe(denied);
    expect(forwardToQuarkusMock).not.toHaveBeenCalled();
  });

  it("forwards method and body without the query option", async () => {
    await forwardToOrg(["stories"], { method: "POST", body: { title: "t" } });
    expect(forwardToQuarkusMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/stories",
      {
        method: "POST",
        body: { title: "t" },
      }
    );
  });
});

describe("story routes", () => {
  it("forwards only the allowed list filters", async () => {
    await listStoriesRoute(
      new Request(
        "http://localhost/api/stories?kind=deck&search=q3&limit=20&owner=other"
      )
    );
    expect(forwardToQuarkusMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/stories?kind=deck&search=q3&limit=20",
      {}
    );
  });

  it("drops an unknown kind", async () => {
    await listStoriesRoute(
      new Request("http://localhost/api/stories?kind=exe")
    );
    expect(forwardToQuarkusMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/stories",
      {}
    );
  });

  it("revokes a share by its encoded principal", async () => {
    await revokeShareRoute(new Request("http://localhost"), {
      params: Promise.resolve({ storyId: "s1", principal: "ana@example.com" }),
    });
    expect(forwardToQuarkusMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/stories/s1/shares/ana%40example.com",
      { method: "DELETE" }
    );
  });
});
