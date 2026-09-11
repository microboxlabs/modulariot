/**
 * The list filter is the app's copy of the `allowedGroups` rule, and it now
 * calls the package's. These cases are written against what the route did
 * before that move, so a divergence in either implementation fails here.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const listMock = vi.fn();
const groupsMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock(
  "@/features/common/providers/alfresco-api/alfresco-api.provider",
  () => ({
    listDashboardConfigs: (...args: unknown[]) => listMock(...args),
    getGroupsForPerson: (...args: unknown[]) => groupsMock(...args),
  })
);

import { GET } from "./route";

const request = (url: string) =>
  new Request(url) as unknown as import("next/server").NextRequest;

/** `nextUrl` is what the route reads; a plain Request has no such property. */
const withNextUrl = (url: string) => {
  const req = request(url);
  Object.defineProperty(req, "nextUrl", { value: new URL(url) });
  return req;
};

const listing = (
  entries: Array<{ slug: string; config: Record<string, unknown> }>
) => listMock.mockResolvedValue({ data: entries });

const slugsOf = async (response: Response) =>
  ((await response.json()) as { data: Array<{ slug: string }> }).data.map(
    (d) => d.slug
  );

describe("GET /api/dashboard/configs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    groupsMock.mockResolvedValue(["GROUP_fleet"]);
  });

  it("401s an unauthenticated caller before asking Alfresco anything", async () => {
    authMock.mockResolvedValue(null);
    const response = await GET(withNextUrl("https://app.test/api?site=acme"));
    expect(response.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("400s without a site", async () => {
    const response = await GET(withNextUrl("https://app.test/api"));
    expect(response.status).toBe(400);
  });

  it("keeps a dashboard that names no audience", async () => {
    listing([{ slug: "fleet", config: { name: "Fleet" } }]);
    await expect(
      slugsOf(await GET(withNextUrl("https://app.test/api?site=acme")))
    ).resolves.toEqual(["fleet"]);
  });

  it("keeps a dashboard whose audience is empty", async () => {
    listing([{ slug: "fleet", config: { allowedGroups: [] } }]);
    await expect(
      slugsOf(await GET(withNextUrl("https://app.test/api?site=acme")))
    ).resolves.toEqual(["fleet"]);
  });

  it("keeps only the dashboards the caller's groups reach", async () => {
    listing([
      { slug: "mine", config: { allowedGroups: ["GROUP_fleet"] } },
      { slug: "theirs", config: { allowedGroups: ["GROUP_other"] } },
    ]);
    await expect(
      slugsOf(await GET(withNextUrl("https://app.test/api?site=acme")))
    ).resolves.toEqual(["mine"]);
  });

  it("drops a dashboard whose audience is malformed", async () => {
    // The case that must not read as "no restriction": a shape nobody expected
    // would otherwise publish a dashboard meant to be restricted.
    listing([
      { slug: "bad", config: { allowedGroups: "GROUP_fleet" } },
      { slug: "worse", config: { allowedGroups: ["GROUP_fleet", 1] } },
    ]);
    await expect(
      slugsOf(await GET(withNextUrl("https://app.test/api?site=acme")))
    ).resolves.toEqual([]);
  });

  it("falls back to the slug when the config carries no usable name", async () => {
    listing([
      { slug: "fleet", config: { name: "   " } },
      { slug: "ops", config: { name: "Ops", order: 2 } },
    ]);
    const response = await GET(withNextUrl("https://app.test/api?site=acme"));
    await expect(response.json()).resolves.toEqual({
      data: [
        { slug: "fleet", name: "fleet", order: undefined },
        { slug: "ops", name: "Ops", order: 2 },
      ],
    });
  });
});
