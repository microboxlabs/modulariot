import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const { useMyAccess } = vi.hoisted(() => ({ useMyAccess: vi.fn() }));

vi.mock("@/features/settings-admin/team/team-api", () => ({ useMyAccess }));

import { usePermissions } from "./use-permissions";
import type { AccessRule } from "../access/access-control";

const kanban: AccessRule = {
  requiredPermissions: ["coordination:kanban.view"],
};

function setup(access: { permissions?: string[]; error?: boolean }) {
  useMyAccess.mockReturnValue({
    access: access.permissions
      ? { permissions: access.permissions }
      : undefined,
    accessError: access.error ? new Error("502") : undefined,
  });
  return renderHook(() => usePermissions()).result.current;
}

describe("usePermissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps gated rules closed while the permissions load", () => {
    const perms = setup({});
    expect(perms.isLoading).toBe(true);
    expect(perms.canAccess(kanban)).toBe(false);
  });

  it("decides with the loaded permissions", () => {
    const perms = setup({ permissions: ["coordination:kanban.view"] });
    expect(perms.isLoading).toBe(false);
    expect(perms.canAccess(kanban)).toBe(true);
  });

  it("denies, without loading, when the permissions read fails", () => {
    const perms = setup({ error: true });
    expect(perms.isLoading).toBe(false);
    expect(perms.canAccess(kanban)).toBe(false);
  });
});
