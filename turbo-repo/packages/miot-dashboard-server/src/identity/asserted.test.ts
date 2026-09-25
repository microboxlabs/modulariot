import { describe, expect, it, vi } from "vitest";
import { FULL_CAPABILITIES } from "../access/roles";
import type {
  AssertedClaims,
  DashboardIdentity,
  DashboardPrincipal,
  ScopeAuthority,
  TenantAuthority,
} from "../seams/identity";
import {
  createAssertedScopeAuthority,
  createAssertedTenantAuthority,
} from "./asserted";

const CLAIMS: AssertedClaims = {
  tenantId: "acme",
  scopeId: "ops",
  role: "Coordinator",
};

const principal = (asserted?: AssertedClaims): DashboardPrincipal => ({
  userId: "ana@example.test",
  kind: "user",
  capabilities: { ...FULL_CAPABILITIES },
  ...(asserted ? { asserted } : {}),
});

const identity = (
  asserted?: AssertedClaims,
  tenantId = "acme",
): DashboardIdentity => ({ ...principal(asserted), tenantId });

const innerTenants = (answer: boolean) =>
  ({ mayActAs: vi.fn(() => Promise.resolve(answer)) }) satisfies TenantAuthority;

const innerScopes = (answer: "Editor" | null) =>
  ({
    resolveScopeRole: vi.fn(() => Promise.resolve(answer)),
  }) satisfies ScopeAuthority;

describe("createAssertedTenantAuthority", () => {
  it("asks the inner authority when nothing was asserted", async () => {
    const inner = innerTenants(true);
    await expect(
      createAssertedTenantAuthority(inner).mayActAs(principal(), "acme"),
    ).resolves.toBe(true);
    expect(inner.mayActAs).toHaveBeenCalledWith(expect.anything(), "acme");
  });

  it("allows the asserted tenant without asking", async () => {
    const inner = innerTenants(false);
    await expect(
      createAssertedTenantAuthority(inner).mayActAs(
        principal(CLAIMS),
        "acme",
      ),
    ).resolves.toBe(true);
    expect(inner.mayActAs).not.toHaveBeenCalled();
  });

  it("refuses a tenant the assertion did not name, and does not fall back", async () => {
    const inner = innerTenants(true);
    await expect(
      createAssertedTenantAuthority(inner).mayActAs(principal(CLAIMS), "other"),
    ).resolves.toBe(false);
    expect(inner.mayActAs).not.toHaveBeenCalled();
  });
});

describe("createAssertedScopeAuthority", () => {
  it("asks the inner authority when nothing was asserted", async () => {
    const inner = innerScopes("Editor");
    await expect(
      createAssertedScopeAuthority(inner).resolveScopeRole(
        identity(),
        "ops",
      ),
    ).resolves.toBe("Editor");
    expect(inner.resolveScopeRole).toHaveBeenCalledTimes(1);
  });

  it("returns the asserted role without asking", async () => {
    const inner = innerScopes("Editor");
    await expect(
      createAssertedScopeAuthority(inner).resolveScopeRole(
        identity(CLAIMS),
        "ops",
      ),
    ).resolves.toBe("Coordinator");
    expect(inner.resolveScopeRole).not.toHaveBeenCalled();
  });

  it("refuses a scope the assertion did not name", async () => {
    const inner = innerScopes("Editor");
    await expect(
      createAssertedScopeAuthority(inner).resolveScopeRole(
        identity(CLAIMS),
        "finance",
      ),
    ).resolves.toBeNull();
    expect(inner.resolveScopeRole).not.toHaveBeenCalled();
  });

  it("refuses when the bound tenant is not the asserted one", async () => {
    const inner = innerScopes("Editor");
    await expect(
      createAssertedScopeAuthority(inner).resolveScopeRole(
        identity(CLAIMS, "other"),
        "ops",
      ),
    ).resolves.toBeNull();
  });
});
