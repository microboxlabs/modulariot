import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  auth,
  getGroupsForPerson,
  resolveTenantScope,
  quarkusAuthHeaders,
  warn,
} = vi.hoisted(() => ({
  auth: vi.fn(),
  getGroupsForPerson: vi.fn(),
  resolveTenantScope: vi.fn(),
  quarkusAuthHeaders: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock(
  "@/features/common/providers/alfresco-api/alfresco-api.provider",
  () => ({
    getGroupsForPerson,
  })
);
vi.mock("@/app/api/utils/tenant-scope", () => ({ resolveTenantScope }));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({ quarkusAuthHeaders }));
vi.mock("@/lib/logger", () => ({
  logger: { warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { hasAccess, requirePermission } from "./server-access";
import { ACCESS_RULES } from "./access-rules";

const session = { user: { id: "u-1", email: "ana@example.com" } };
let userCounter = 0;

function freshSession() {
  userCounter += 1;
  return { user: { id: `u-${userCounter}`, email: "ana@example.com" } };
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
    delete process.env.ACCESS_CONTROL_SOURCE;
    vi.unstubAllGlobals();
  });

  it("groups mode asks Alfresco and never the modulith", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    getGroupsForPerson.mockResolvedValue(["GROUP_MINTRAL_KANBAN_ACCESS"]);

    await expect(
      hasAccess(freshSession() as never, ACCESS_RULES.kanban)
    ).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("permissions mode decides with the active org's permissions", async () => {
    process.env.ACCESS_CONTROL_SOURCE = "permissions";
    stubPermissions(["coordination:kanban.view"]);

    await expect(
      hasAccess(freshSession() as never, ACCESS_RULES.kanban)
    ).resolves.toBe(true);
    expect(getGroupsForPerson).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "http://modulith.test/api/v1/orgs/acme/me/access",
      expect.anything()
    );
  });

  it("permissions mode denies when the permissions cannot be loaded", async () => {
    process.env.ACCESS_CONTROL_SOURCE = "permissions";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 502 }))
    );

    await expect(
      hasAccess(freshSession() as never, ACCESS_RULES.kanban)
    ).resolves.toBe(false);
  });

  it("shadow mode decides with groups and logs the mismatch", async () => {
    process.env.ACCESS_CONTROL_SOURCE = "shadow";
    getGroupsForPerson.mockResolvedValue(["GROUP_MINTRAL_KANBAN_ACCESS"]);
    stubPermissions([]);

    await expect(
      hasAccess(freshSession() as never, ACCESS_RULES.kanban, "/shipping")
    ).resolves.toBe(true);
    expect(warn).toHaveBeenCalledWith(
      {
        userEmail: "ana@example.com",
        org: "acme",
        key: "coordination:kanban.view",
        context: "/shipping",
        byGroups: true,
        byPermissions: false,
      },
      "Access mismatch between groups and permissions"
    );
  });

  it("requirePermission answers 401 without a session and 403 when closed", async () => {
    auth.mockResolvedValueOnce(null);
    const anonymous = await requirePermission(ACCESS_RULES.adminConsole);
    expect(anonymous.authorized).toBe(false);
    if (!anonymous.authorized) expect(anonymous.response.status).toBe(401);

    auth.mockResolvedValueOnce(session);
    getGroupsForPerson.mockResolvedValue([]);
    const denied = await requirePermission(ACCESS_RULES.adminConsole);
    expect(denied.authorized).toBe(false);
    if (!denied.authorized) expect(denied.response.status).toBe(403);
  });
});
