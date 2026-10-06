import { describe, expect, it } from "vitest";
import {
  NO_CAPABILITIES,
  type DashboardIdentity,
  type DashboardPrincipal,
} from "../seams/identity";
import { createGroupRoleAuthorities, groupPatternProblem } from "./group-roles";

const person = (groups: string[]): DashboardPrincipal => ({
  userId: "ana",
  kind: "user",
  groups,
  capabilities: { ...NO_CAPABILITIES },
});

const inTenant = (groups: string[], tenantId: string): DashboardIdentity => ({
  ...person(groups),
  tenantId,
});

const tenantLevel = createGroupRoleAuthorities({
  pattern: "GROUP_DHB_{tenant}_{role}",
  roleMap: {
    CONSUMER: "Consumer",
    COLLABORATOR: "Contributor",
    EDITOR: "Editor",
    COORDINATOR: "Coordinator",
  },
});

describe("createGroupRoleAuthorities", () => {
  it("lets a person act in a tenant their groups name, and nowhere else", async () => {
    const ana = person(["GROUP_DHB_ACME_EDITOR", "GROUP_OTHER"]);
    expect(await tenantLevel.tenants.mayActAs(ana, "acme")).toBe(true);
    expect(await tenantLevel.tenants.mayActAs(ana, "globex")).toBe(false);
  });

  it("gives the role in every scope of the tenant when the pattern has no scope", async () => {
    const ana = inTenant(["GROUP_DHB_ACME_EDITOR"], "acme");
    expect(await tenantLevel.scopes.resolveScopeRole(ana, "ops")).toBe(
      "Editor",
    );
    expect(await tenantLevel.scopes.resolveScopeRole(ana, "finance")).toBe(
      "Editor",
    );
  });

  it("takes the highest role when several groups match", async () => {
    const ana = inTenant(
      [
        "GROUP_DHB_ACME_CONSUMER",
        "GROUP_DHB_ACME_COORDINATOR",
        "GROUP_DHB_ACME_COLLABORATOR",
      ],
      "acme",
    );
    expect(await tenantLevel.scopes.resolveScopeRole(ana, "ops")).toBe(
      "Coordinator",
    );
  });

  it("matches a tenant id that contains the separator, without confusing it with another", async () => {
    // Filling the tenant in, rather than parsing it out, is what keeps
    // `muni_nunoa` and `muni` apart.
    const ana = person(["GROUP_DHB_MUNI_NUNOA_EDITOR"]);
    expect(await tenantLevel.tenants.mayActAs(ana, "muni_nunoa")).toBe(true);
    expect(await tenantLevel.tenants.mayActAs(ana, "muni")).toBe(false);
    expect(await tenantLevel.tenants.mayActAs(ana, "nunoa")).toBe(false);
  });

  it("compares case-insensitively and ignores surrounding spaces", async () => {
    const ana = inTenant([" group_dhb_acme_editor "], "ACME");
    expect(await tenantLevel.scopes.resolveScopeRole(ana, "ops")).toBe(
      "Editor",
    );
  });

  it("ignores a role the map does not name", async () => {
    const ana = person(["GROUP_DHB_ACME_ADMIN"]);
    expect(await tenantLevel.tenants.mayActAs(ana, "acme")).toBe(false);
  });

  it("treats a tenant id as text, never as a pattern", async () => {
    const ana = person(["GROUP_DHB_ACME_EDITOR"]);
    expect(await tenantLevel.tenants.mayActAs(ana, ".*")).toBe(false);
    expect(await tenantLevel.tenants.mayActAs(ana, "AC.E")).toBe(false);
  });

  it("refuses a person with no groups", async () => {
    const ana = inTenant([], "acme");
    expect(await tenantLevel.tenants.mayActAs(ana, "acme")).toBe(false);
    expect(await tenantLevel.scopes.resolveScopeRole(ana, "ops")).toBeNull();
  });

  it("uses the role names in capitals when no map is given", async () => {
    const defaults = createGroupRoleAuthorities({
      pattern: "DHB-{tenant}-{role}",
    });
    const ana = inTenant(["DHB-acme-CONTRIBUTOR"], "acme");
    expect(await defaults.scopes.resolveScopeRole(ana, "ops")).toBe(
      "Contributor",
    );
  });

  describe("with {scope} in the pattern", () => {
    const scoped = createGroupRoleAuthorities({
      pattern: "DHB_{tenant}_{scope}_{role}",
    });

    it("gives a role only in the scope the group names", async () => {
      const ana = inTenant(["DHB_ACME_OPS_EDITOR"], "acme");
      expect(await scoped.scopes.resolveScopeRole(ana, "ops")).toBe("Editor");
      expect(await scoped.scopes.resolveScopeRole(ana, "finance")).toBeNull();
    });

    it("lets a person into the tenant through a group for any of its scopes", async () => {
      const ana = person(["DHB_ACME_FINANCE_CONSUMER"]);
      expect(await scoped.tenants.mayActAs(ana, "acme")).toBe(true);
      expect(await scoped.tenants.mayActAs(ana, "globex")).toBe(false);
    });
  });
});

describe("groupPatternProblem", () => {
  it.each([
    ["GROUP_{role}", "must contain {tenant} exactly once"],
    ["GROUP_{tenant}", "must contain {role} exactly once"],
    ["{tenant}_{tenant}_{role}", "must contain {tenant} exactly once"],
    ["{tenant}_{scope}_{scope}_{role}", "may contain {scope} at most once"],
    [
      "{tenant}_{site}_{role}",
      "may only use the placeholders {tenant}, {scope} and {role}",
    ],
  ])("refuses %s", (pattern, problem) => {
    expect(groupPatternProblem(pattern)).toBe(problem);
  });

  it("accepts a pattern with or without a scope", () => {
    expect(groupPatternProblem("GROUP_DHB_{tenant}_{role}")).toBeUndefined();
    expect(
      groupPatternProblem("GROUP_DHB_{tenant}_{scope}_{role}"),
    ).toBeUndefined();
  });
});
