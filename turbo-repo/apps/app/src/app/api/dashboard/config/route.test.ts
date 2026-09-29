/**
 * The access check on this route reads the *stored* config, so a caller can
 * never widen its own audience by sending a new one. These cases pin that,
 * and pin that the user's groups are fetched only when a dashboard actually
 * names an audience — the check is on the request path of every read.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getMock = vi.fn();
const saveMock = vi.fn();
const deleteMock = vi.fn();
const groupsMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock(
  "@/features/common/providers/alfresco-api/alfresco-api.provider",
  () => ({
    getDashboardConfig: (...args: unknown[]) => getMock(...args),
    saveDashboardConfig: (...args: unknown[]) => saveMock(...args),
    deleteDashboardConfig: (...args: unknown[]) => deleteMock(...args),
    getGroupsForPerson: (...args: unknown[]) => groupsMock(...args),
  })
);

import { DELETE, GET, PUT } from "./route";

type NextRequestish = import("next/server").NextRequest;

const get = (query: string) => {
  const url = `https://app.test/api/dashboard/config${query}`;
  const req = new Request(url);
  Object.defineProperty(req, "nextUrl", { value: new URL(url) });
  return req as unknown as NextRequestish;
};

const body = (method: string, payload: unknown) =>
  new Request("https://app.test/api/dashboard/config", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }) as unknown as NextRequestish;

const stored = (config: unknown) => getMock.mockResolvedValue({ data: config });

describe("/api/dashboard/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    groupsMock.mockResolvedValue(["GROUP_fleet"]);
    saveMock.mockResolvedValue({ success: true });
    deleteMock.mockResolvedValue({ success: true });
  });

  describe("GET", () => {
    it("401s an unauthenticated caller before asking Alfresco anything", async () => {
      authMock.mockResolvedValue(null);
      expect((await GET(get("?site=acme&slug=fleet"))).status).toBe(401);
      expect(getMock).not.toHaveBeenCalled();
    });

    it("400s without site and slug", async () => {
      expect((await GET(get("?site=acme"))).status).toBe(400);
      expect((await GET(get("?slug=fleet"))).status).toBe(400);
    });

    it("returns a dashboard that names no audience, without fetching groups", async () => {
      stored({ version: 2, name: "Fleet" });
      const response = await GET(get("?site=acme&slug=fleet"));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        data: { version: 2, name: "Fleet" },
      });
      expect(groupsMock).not.toHaveBeenCalled();
    });

    it("returns one whose audience the caller is in", async () => {
      stored({ allowedGroups: ["GROUP_fleet"] });
      expect((await GET(get("?site=acme&slug=fleet"))).status).toBe(200);
      expect(groupsMock).toHaveBeenCalledOnce();
    });

    it("403s one whose audience the caller is not in", async () => {
      stored({ allowedGroups: ["GROUP_other"] });
      const response = await GET(get("?site=acme&slug=fleet"));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "You do not have access to this dashboard",
        status: 403,
      });
    });

    it("403s a malformed audience rather than reading it as open", async () => {
      stored({ allowedGroups: "GROUP_fleet" });
      expect((await GET(get("?site=acme&slug=fleet"))).status).toBe(403);
    });

    it("returns a dashboard that does not exist yet", async () => {
      stored(null);
      const response = await GET(get("?site=acme&slug=fleet"));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ data: null });
    });
  });

  describe("PUT", () => {
    it("400s without the required fields", async () => {
      const response = await PUT(body("PUT", { site: "acme", slug: "fleet" }));
      expect(response.status).toBe(400);
      expect(saveMock).not.toHaveBeenCalled();
    });

    it("checks the stored audience, not the one being written", async () => {
      // Otherwise a caller locked out of a dashboard could send a config
      // naming a group it holds and let itself back in.
      stored({ allowedGroups: ["GROUP_other"] });
      const response = await PUT(
        body("PUT", {
          site: "acme",
          slug: "fleet",
          config: { allowedGroups: ["GROUP_fleet"] },
        })
      );
      expect(response.status).toBe(403);
      expect(saveMock).not.toHaveBeenCalled();
    });

    it("saves when the caller is in the stored audience", async () => {
      stored({ allowedGroups: ["GROUP_fleet"] });
      const response = await PUT(
        body("PUT", { site: "acme", slug: "fleet", config: { version: 2 } })
      );
      expect(response.status).toBe(200);
      expect(saveMock).toHaveBeenCalledWith(
        expect.anything(),
        "acme",
        "fleet",
        {
          version: 2,
        }
      );
    });
  });

  describe("DELETE", () => {
    it("refuses one the caller cannot reach", async () => {
      stored({ allowedGroups: ["GROUP_other"] });
      const response = await DELETE(
        body("DELETE", { site: "acme", slug: "fleet" })
      );
      expect(response.status).toBe(403);
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it("deletes one the caller can", async () => {
      stored({ allowedGroups: ["GROUP_fleet"] });
      expect(
        (await DELETE(body("DELETE", { site: "acme", slug: "fleet" }))).status
      ).toBe(200);
      expect(deleteMock).toHaveBeenCalledOnce();
    });
  });
});
