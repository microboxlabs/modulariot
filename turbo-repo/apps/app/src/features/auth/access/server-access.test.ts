import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, resolveTenantScope, quarkusAuthHeaders, notFound, redirect } =
  vi.hoisted(() => ({
    auth: vi.fn(),
    resolveTenantScope: vi.fn(),
    quarkusAuthHeaders: vi.fn(),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    redirect: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
  }));

vi.mock("@/auth", () => ({ auth }));
vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/app/api/utils/tenant-scope", () => ({ resolveTenantScope }));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({ quarkusAuthHeaders }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  guardPage,
  guardPlatformOwnerPage,
  hasAccess,
  requirePermission,
  requirePlatformOwner,
} from "./server-access";
import { ACCESS_RULES } from "./access-rules";

let userCounter = 0;

function freshSession() {
  userCounter += 1;
  return {
    user: { id: `u-${userCounter}`, email: `ana-${userCounter}@example.com` },
  };
}

function stubPermissions(permissions: string[]) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ permissions }), { status: 200 })
      )
  );
}

describe("server access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MIOT_MODULITH_URL = "http://modulith.test";
    resolveTenantScope.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
    quarkusAuthHeaders.mockResolvedValue({ Authorization: "Bearer t" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decides with the active org's permissions", async () => {
    stubPermissions(["coordination:kanban.view"]);

    await expect(
      hasAccess(freshSession() as never, ACCESS_RULES.kanban)
    ).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "http://modulith.test/api/v1/orgs/acme/me/access",
      expect.anything()
    );
  });

  it("denies without the permission", async () => {
    stubPermissions(["calendar:view"]);

    await expect(
      hasAccess(freshSession() as never, ACCESS_RULES.kanban)
    ).resolves.toBe(false);
  });

  it("denies when the permissions cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 502 }))
    );

    await expect(
      hasAccess(freshSession() as never, ACCESS_RULES.kanban)
    ).resolves.toBe(false);
  });

  it("denies when the organization cannot be resolved", async () => {
    resolveTenantScope.mockResolvedValue({ resolved: false });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      hasAccess(freshSession() as never, ACCESS_RULES.kanban)
    ).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("opens a rule without permissions without asking the modulith", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(hasAccess(freshSession() as never, {})).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requirePermission answers 401 without a session and 403 when closed", async () => {
    auth.mockResolvedValueOnce(null);
    const anonymous = await requirePermission(ACCESS_RULES.adminConsole);
    expect(anonymous.authorized).toBe(false);
    if (!anonymous.authorized) expect(anonymous.response.status).toBe(401);

    auth.mockResolvedValueOnce(freshSession());
    stubPermissions([]);
    const denied = await requirePermission(ACCESS_RULES.adminConsole);
    expect(denied.authorized).toBe(false);
    if (!denied.authorized) expect(denied.response.status).toBe(403);

    auth.mockResolvedValueOnce(freshSession());
    stubPermissions(["admin:console"]);
    const allowed = await requirePermission(ACCESS_RULES.adminConsole);
    expect(allowed.authorized).toBe(true);
  });

  it("guardPage redirects without a session and renders not-found when closed", async () => {
    auth.mockResolvedValueOnce(null);
    await expect(guardPage(ACCESS_RULES.finished, "/finished")).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    auth.mockResolvedValueOnce(freshSession());
    stubPermissions([]);
    await expect(guardPage(ACCESS_RULES.finished, "/finished")).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );

    auth.mockResolvedValueOnce(freshSession());
    stubPermissions(["coordination:finished.view"]);
    await expect(
      guardPage(ACCESS_RULES.finished, "/finished")
    ).resolves.toBeUndefined();
  });

  it("requirePlatformOwner needs a platform owner, not admin:console", async () => {
    const fetchSpy = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ roleCodes: [] }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchSpy);
    auth.mockResolvedValue(freshSession());

    const orgAdmin = await requirePlatformOwner("/api/admin/logs");
    expect(orgAdmin.authorized).toBe(false);
    if (!orgAdmin.authorized) expect(orgAdmin.response.status).toBe(403);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://modulith.test/api/v1/platform/roles/me",
      expect.anything()
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("/me/access"),
      expect.anything()
    );

    fetchSpy.mockImplementation(
      async () =>
        new Response(JSON.stringify({ roleCodes: ["PLATFORM_OWNER"] }), {
          status: 200,
        })
    );
    const owner = await requirePlatformOwner("/api/admin/logs");
    expect(owner.authorized).toBe(true);
  });

  it("requirePlatformOwner denies when the platform roles cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 502 }))
    );
    auth.mockResolvedValue(freshSession());

    const result = await requirePlatformOwner("/api/admin/logs");
    expect(result.authorized).toBe(false);
  });

  it("guardPlatformOwnerPage renders not-found for a non-owner", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ roleCodes: [] }), { status: 200 })
        )
    );
    auth.mockResolvedValueOnce(freshSession());
    await expect(guardPlatformOwnerPage("/admin/console/logs")).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });
});
