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
  createMemoryCredentialsStore,
  createMemoryDataSourceStore,
  createMemoryScopeAuthority,
  createMemoryTenantAuthority,
} from "./testing";
import type { CredentialInput } from "./seams/credentials";
import type { DataSourceInput } from "./seams/datasources";
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

describe("the memory datasource and credential stores hand back copies", () => {
  // Same rule as the dashboard store in `src/test/fixtures.test.ts`. These are
  // published for integrators and dev servers, and a SQL store hands back rows
  // it decoded. A caller holding a reference into the Map can rewrite state
  // without a write, and the suite would pass against behaviour Postgres
  // cannot reproduce.
  const pgrest: DataSourceInput = {
    name: "PgREST",
    type: "POSTGREST",
    isActive: true,
    target: "https://data.example/rest/v1",
  };

  it("does not let a mutated put() result change the store", async () => {
    const store = createMemoryDataSourceStore();
    const written = await store.put("acme", "ds1", pgrest);

    written.target = "https://attacker.example";

    await expect(store.get("acme", "ds1")).resolves.toMatchObject({
      target: "https://data.example/rest/v1",
    });
  });

  it("does not let a mutated get() result change the store", async () => {
    const store = createMemoryDataSourceStore({ acme: { ds1: pgrest } });
    const got = await store.get("acme", "ds1");

    got!.isActive = false;

    await expect(store.get("acme", "ds1")).resolves.toMatchObject({
      isActive: true,
    });
  });

  it("does not let a mutated list() element change the store", async () => {
    const store = createMemoryDataSourceStore({ acme: { ds1: pgrest } });
    const [listed] = await store.list("acme");

    listed!.name = "renamed";

    await expect(store.list("acme")).resolves.toMatchObject([
      { name: "PgREST" },
    ]);
  });

  it("does not let a mutated credential input rotate the secret", async () => {
    const input: CredentialInput = {
      kind: "BEARER",
      token: "0123456789abcdef",
    };
    const store = createMemoryCredentialsStore();
    await store.putCredential("acme", "pgrest", input);

    input.token = "rotated-without-a-write";

    await expect(store.resolve("acme", "pgrest")).resolves.toMatchObject({
      headers: { Authorization: "Bearer 0123456789abcdef" },
    });
  });

  it("does not let a mutated seed rotate it either", async () => {
    const input: CredentialInput = {
      kind: "BEARER",
      token: "0123456789abcdef",
    };
    const store = createMemoryCredentialsStore({ acme: { pgrest: input } });

    input.token = "rotated-without-a-write";

    await expect(store.resolve("acme", "pgrest")).resolves.toMatchObject({
      headers: { Authorization: "Bearer 0123456789abcdef" },
    });
  });
});
