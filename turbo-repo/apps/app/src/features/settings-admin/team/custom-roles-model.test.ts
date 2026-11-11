import { describe, expect, it } from "vitest";
import {
  canGivePermission,
  canManageCustomRoles,
  catalogModules,
  customRoleRequest,
  customRolesOf,
  effectivePermissions,
  holderCounts,
  matrixColumns,
  rolesByModule,
  selectedRoles,
  toggleCustomRole,
  withCustomRoles,
} from "./team-model";
import type {
  AccessCatalog,
  CatalogPermission,
  CustomRole,
} from "./team.types";

const permission = (
  key: string,
  over: Partial<CatalogPermission> = {}
): CatalogPermission => ({
  key,
  module: key.split(":")[0],
  label: { es: key },
  explicitOnly: false,
  ownerOnly: false,
  ...over,
});

const catalog: AccessCatalog = {
  baseRoles: ["OWNER", "ADMIN", "MEMBER"],
  permissions: [
    permission("org:read"),
    permission("members:read"),
    permission("coordination:kanban.view"),
    permission("coordination:geographic.view"),
    permission("audit:read"),
  ],
  roles: [
    {
      key: "REVIEWER",
      module: "coordination",
      label: { es: "Revisor" },
      permissions: ["coordination:kanban.view"],
    },
  ],
};

const role = (key: string, permissions: string[]): CustomRole => ({
  id: key,
  key,
  label: { es: key },
  description: {},
  permissions,
  holders: { members: 0, teams: 0, serviceAccounts: 0, clients: 0 },
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: null,
  updatedAt: "2026-01-01T00:00:00Z",
  updatedBy: null,
});

const merged = withCustomRoles(catalog, [
  role("custom:mapa", ["coordination:geographic.view"]),
  role("custom:auditor", ["audit:read"]),
]);

describe("custom roles in the catalog", () => {
  it("adds them after the module roles, marked as custom", () => {
    expect(merged.roles.map((r) => r.key)).toEqual([
      "REVIEWER",
      "custom:mapa",
      "custom:auditor",
    ]);
    expect(customRolesOf(merged).map((r) => r.key)).toEqual([
      "custom:mapa",
      "custom:auditor",
    ]);
    expect(withCustomRoles(catalog, [])).toBe(catalog);
    // Merging again replaces them instead of repeating them.
    expect(
      withCustomRoles(merged, [role("custom:mapa", [])]).roles.map((r) => r.key)
    ).toEqual(["REVIEWER", "custom:mapa"]);
  });

  it("does not turn them into a module to pick one role from", () => {
    expect(catalogModules(merged).map((m) => m.key)).toEqual(["coordination"]);
  });

  it("lets a member hold several next to one role per module", () => {
    const selection = rolesByModule(
      ["REVIEWER", "custom:mapa", "custom:auditor"],
      merged.roles
    );
    expect(selection).toEqual({
      coordination: "REVIEWER",
      "custom:mapa": "custom:mapa",
      "custom:auditor": "custom:auditor",
    });
    const without = toggleCustomRole(selection, "custom:mapa", false);
    expect(selectedRoles(without).sort()).toEqual([
      "REVIEWER",
      "custom:auditor",
    ]);
    expect(selectedRoles(toggleCustomRole({}, "custom:mapa", true))).toEqual([
      "custom:mapa",
    ]);
  });

  it("counts their permissions as effective", () => {
    const effective = effectivePermissions("MEMBER", ["custom:mapa"], merged);
    expect([...effective].sort()).toEqual([
      "coordination:geographic.view",
      "members:read",
      "org:read",
    ]);
  });

  it("marks their columns in the roles matrix", () => {
    const columns = matrixColumns(merged, "es", {
      OWNER: "O",
      ADMIN: "A",
      MEMBER: "M",
    });
    expect(columns.filter((c) => c.custom).map((c) => c.key)).toEqual([
      "custom:mapa",
      "custom:auditor",
    ]);
  });
});

describe("managing custom roles", () => {
  it("is for owners and admins only", () => {
    expect(canManageCustomRoles({ baseRole: "OWNER" })).toBe(true);
    expect(canManageCustomRoles({ baseRole: "ADMIN" })).toBe(true);
    expect(canManageCustomRoles({ baseRole: "MEMBER" })).toBe(false);
    expect(canManageCustomRoles({ baseRole: null })).toBe(false);
    expect(canManageCustomRoles(undefined)).toBe(false);
  });

  it("lets a caller give only what they hold, explicit-only permissions, or what the role has", () => {
    const can = (key: string) => key === "audit:read";
    expect(canGivePermission(permission("audit:read"), can, false)).toBe(true);
    expect(canGivePermission(permission("owners:manage"), can, false)).toBe(
      false
    );
    expect(canGivePermission(permission("owners:manage"), can, true)).toBe(
      true
    );
    expect(
      canGivePermission(
        permission("coordination:stage.escalation", { explicitOnly: true }),
        can,
        false
      )
    ).toBe(true);
  });

  it("builds the request from the form", () => {
    expect(
      customRoleRequest({
        nameEs: " Supervisor ",
        nameEn: "",
        descriptionEs: " Ve el mapa. ",
        descriptionEn: " ",
        permissions: new Set(["b:view", "a:view"]),
      })
    ).toEqual({
      label: { es: "Supervisor", en: "Supervisor" },
      description: { es: "Ve el mapa." },
      permissions: ["a:view", "b:view"],
    });
  });

  it("counts who loses a role, M2M clients with the service accounts", () => {
    expect(
      holderCounts({ members: 3, teams: 2, serviceAccounts: 1, clients: 1 })
    ).toEqual({ members: "3", teams: "2", serviceAccounts: "2" });
    expect(holderCounts(undefined)).toEqual({
      members: "0",
      teams: "0",
      serviceAccounts: "0",
    });
  });
});
