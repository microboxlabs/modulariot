import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { resolveTenantScope } = vi.hoisted(() => ({
  resolveTenantScope: vi.fn(),
}));

vi.mock("@/app/api/utils/tenant-scope", () => ({ resolveTenantScope }));

import { requireOrganizationOwner } from "./organization-owner";

const resolvedScope = (role: string) => ({
  resolved: true,
  session: { user: { id: "user-1" } },
  scope: {
    activeOrg: {},
    effectiveTaxIds: [],
    availableOrgs: [{ slug: "mintral", role }],
  },
});

describe("requireOrganizationOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an organization owner", async () => {
    resolveTenantScope.mockResolvedValue(resolvedScope("OWNER"));

    await expect(requireOrganizationOwner("mintral")).resolves.toBeNull();
  });

  it.each(["MEMBER", "SITE_MANAGER", "GROUP_ADMIN"])(
    "rejects non-owner role %s",
    async (role) => {
      resolveTenantScope.mockResolvedValue(resolvedScope(role));

      const response = await requireOrganizationOwner("mintral");

      expect(response?.status).toBe(403);
    }
  );

  it("rejects access to an organization outside the caller scope", async () => {
    resolveTenantScope.mockResolvedValue(resolvedScope("OWNER"));

    const response = await requireOrganizationOwner("another-org");

    expect(response?.status).toBe(403);
  });

  it("preserves tenant-scope authentication failures", async () => {
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    resolveTenantScope.mockResolvedValue({ resolved: false, response });

    await expect(requireOrganizationOwner("mintral")).resolves.toBe(response);
  });
});
