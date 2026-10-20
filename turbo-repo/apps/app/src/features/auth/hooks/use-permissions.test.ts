import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const { useRuntimeConfig, useUserGroups, useMyAccess, reportAccessMismatch } =
  vi.hoisted(() => ({
    useRuntimeConfig: vi.fn(),
    useUserGroups: vi.fn(),
    useMyAccess: vi.fn(),
    reportAccessMismatch: vi.fn(),
  }));

vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig,
}));
vi.mock("@/features/common/providers/client-api.provider", () => ({
  useUserGroups,
}));
vi.mock("@/features/settings-admin/team/team-api", () => ({ useMyAccess }));
vi.mock("../access/report-mismatch", () => ({ reportAccessMismatch }));

import { usePermissions } from "./use-permissions";
import type { AccessRule } from "../access/access-control";

const KANBAN = "GROUP_MINTRAL_KANBAN_ACCESS";
const mapped: AccessRule = {
  requiredGroups: [KANBAN],
  requiredPermissions: ["coordination:kanban.view"],
};
const groupOnly: AccessRule = { requiredGroups: [KANBAN] };

function setup(options: {
  source: string;
  groups?: string[];
  groupsLoading?: boolean;
  permissions?: string[];
  accessError?: boolean;
}) {
  useRuntimeConfig.mockReturnValue({ ACCESS_CONTROL_SOURCE: options.source });
  useUserGroups.mockReturnValue({
    data: options.groups ?? [],
    isLoading: options.groupsLoading ?? false,
  });
  useMyAccess.mockReturnValue({
    access: options.permissions
      ? { permissions: options.permissions }
      : undefined,
    accessError: options.accessError ? new Error("502") : undefined,
  });
  return renderHook(() => usePermissions()).result.current;
}

describe("usePermissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permissions mode decides mapped gates without waiting for groups", () => {
    const perms = setup({
      source: "permissions",
      groupsLoading: true,
      permissions: ["coordination:kanban.view"],
    });
    expect(perms.isRuleLoading(mapped)).toBe(false);
    expect(perms.canAccess(mapped)).toBe(true);
  });

  it("permissions mode keeps group-only gates loading until groups arrive", () => {
    const perms = setup({
      source: "permissions",
      groupsLoading: true,
      permissions: [],
    });
    expect(perms.isRuleLoading(groupOnly)).toBe(true);
    expect(perms.canAccess(groupOnly)).toBe(false);
  });

  it("permissions mode waits for the permissions on mapped gates", () => {
    const perms = setup({ source: "permissions", groups: [KANBAN] });
    expect(perms.isRuleLoading(mapped)).toBe(true);
    expect(perms.canAccess(mapped)).toBe(false);
  });

  it("permissions mode denies, without loading, when the permissions read fails", () => {
    const perms = setup({
      source: "permissions",
      groups: [KANBAN],
      accessError: true,
    });
    expect(perms.isRuleLoading(mapped)).toBe(false);
    expect(perms.canAccess(mapped)).toBe(false);
  });

  it("shadow mode reports no mismatch when the permissions read fails", () => {
    const perms = setup({
      source: "shadow",
      groups: [KANBAN],
      accessError: true,
    });
    expect(perms.canAccess(mapped, "/shipping")).toBe(true);
    expect(reportAccessMismatch).not.toHaveBeenCalled();
  });

  it("shadow mode reports a mismatch when the permissions disagree", () => {
    const perms = setup({ source: "shadow", groups: [KANBAN], permissions: [] });
    expect(perms.canAccess(mapped, "/shipping")).toBe(true);
    expect(reportAccessMismatch).toHaveBeenCalledWith(
      mapped,
      expect.objectContaining({ byGroups: true, byPermissions: false }),
      "/shipping"
    );
  });

  it("keeps every gate closed until the runtime config loads", () => {
    useRuntimeConfig.mockReturnValue(null);
    useUserGroups.mockReturnValue({ data: [KANBAN], isLoading: false });
    useMyAccess.mockReturnValue({ access: { permissions: [] } });
    const perms = renderHook(() => usePermissions()).result.current;
    expect(perms.isRuleLoading({})).toBe(true);
    expect(perms.canAccess({})).toBe(false);
  });
});
