import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { resolveTenantScope, hasAlfrescoAdminAccessForSession } = vi.hoisted(
  () => ({
    resolveTenantScope: vi.fn(),
    hasAlfrescoAdminAccessForSession: vi.fn(),
  })
);

vi.mock("@/app/api/utils/tenant-scope", () => ({ resolveTenantScope }));
vi.mock("@/features/auth/utils/admin-access", () => ({
  hasAlfrescoAdminAccessForSession,
}));

import { requireOrganizationSettingsAdmin } from "./organization-settings-admin";

const resolvedScope = (role: string) => ({
  resolved: true,
  session: { user: { id: "user-1" } },
  scope: {
    activeOrg: {},
    effectiveTaxIds: [],
    availableOrgs: [{ slug: "mintral", role }],
  },
});

describe("requireOrganizationSettingsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasAlfrescoAdminAccessForSession.mockResolvedValue(false);
  });

  it.each(["SITE_MANAGER", "GROUP_ADMIN"])(
    "allows organization role %s",
    async (role) => {
      resolveTenantScope.mockResolvedValue(resolvedScope(role));

      await expect(
        requireOrganizationSettingsAdmin("mintral")
      ).resolves.toBeNull();
      expect(hasAlfrescoAdminAccessForSession).not.toHaveBeenCalled();
    }
  );

  it("allows an Alfresco administrator without an organization admin role", async () => {
    const scope = resolvedScope("SITE_CONSUMER");
    resolveTenantScope.mockResolvedValue(scope);
    hasAlfrescoAdminAccessForSession.mockResolvedValue(true);

    await expect(
      requireOrganizationSettingsAdmin("mintral")
    ).resolves.toBeNull();
    expect(hasAlfrescoAdminAccessForSession).toHaveBeenCalledWith(scope.session);
  });

  it("rejects a regular organization member", async () => {
    resolveTenantScope.mockResolvedValue(resolvedScope("SITE_CONSUMER"));

    const response = await requireOrganizationSettingsAdmin("mintral");

    expect(response?.status).toBe(403);
  });

  it("preserves tenant-scope authentication failures", async () => {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    resolveTenantScope.mockResolvedValue({ resolved: false, response });

    await expect(
      requireOrganizationSettingsAdmin("mintral")
    ).resolves.toBe(response);
  });
});
