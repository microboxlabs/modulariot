/**
 * The seed-backed authorities, on ids that collide with `Object.prototype`.
 *
 * The tenant, scope and user ids all arrive from the request, and the seed is
 * a plain object, so `memberships[tenantId]` finds an inherited member for
 * ids like "constructor" or "toString". Nothing reachable that way is a valid
 * role, so the lookups failed closed before this was guarded — but on what
 * `Object.prototype` happens to hold rather than on a rule.
 */

import { describe, expect, it } from "vitest";
import {
  createMemoryScopeAuthority,
  createMemoryTenantAuthority,
} from "./testing";
import type { DashboardIdentity, DashboardPrincipal } from "./seams/identity";
import { FULL_CAPABILITIES } from "./access/roles";

const memberships = { acme: { ops: { ana: "Editor" as const } } };

const principal = (userId: string): DashboardPrincipal => ({
  userId,
  kind: "user",
  capabilities: FULL_CAPABILITIES,
});

const identity = (userId: string, tenantId: string): DashboardIdentity => ({
  ...principal(userId),
  tenantId,
});

/** Names that resolve to something through the prototype chain. */
const INHERITED = ["constructor", "toString", "__proto__", "valueOf"];

describe("createMemoryScopeAuthority", () => {
  const scopes = createMemoryScopeAuthority(memberships);

  it("resolves a seeded member", async () => {
    await expect(
      scopes.resolveScopeRole(identity("ana", "acme"), "ops"),
    ).resolves.toBe("Editor");
  });

  it.each(INHERITED)("gives no role for the tenant %s", async (tenantId) => {
    await expect(
      scopes.resolveScopeRole(identity("ana", tenantId), "ops"),
    ).resolves.toBeNull();
  });

  it.each(INHERITED)("gives no role for the scope %s", async (scopeId) => {
    // The tenant is real here, so the lookup gets past the first level and
    // the inherited value is what the second would return.
    await expect(
      scopes.resolveScopeRole(identity("ana", "acme"), scopeId),
    ).resolves.toBeNull();
  });

  it.each(INHERITED)("gives no role to the user %s", async (userId) => {
    await expect(
      scopes.resolveScopeRole(identity(userId, "acme"), "ops"),
    ).resolves.toBeNull();
  });

  it("gives no role for a value in the seed that is not a role", async () => {
    const wrong = { acme: { ops: { ana: "Administrator" } } } as never;
    await expect(
      createMemoryScopeAuthority(wrong).resolveScopeRole(
        identity("ana", "acme"),
        "ops",
      ),
    ).resolves.toBeNull();
  });
});

describe("createMemoryTenantAuthority", () => {
  const tenants = createMemoryTenantAuthority(memberships);

  it("entitles a member of one of the tenant's scopes", async () => {
    await expect(tenants.mayActAs(principal("ana"), "acme")).resolves.toBe(
      true,
    );
  });

  it("refuses someone in no scope of it", async () => {
    await expect(tenants.mayActAs(principal("bob"), "acme")).resolves.toBe(
      false,
    );
  });

  it.each(INHERITED)("refuses the tenant %s", async (tenantId) => {
    await expect(tenants.mayActAs(principal("ana"), tenantId)).resolves.toBe(
      false,
    );
  });

  it.each(INHERITED)("refuses the user %s", async (userId) => {
    await expect(tenants.mayActAs(principal(userId), "acme")).resolves.toBe(
      false,
    );
  });
});
