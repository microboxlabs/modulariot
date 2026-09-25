/**
 * Authorities that read what a trusted proxy asserted, and otherwise ask.
 *
 * Both wrappers delegate to `inner` when the principal carries no assertion,
 * so one configuration serves a server behind a proxy and the same server
 * reached directly.
 *
 * An assertion that does not match the tenant or scope the request named is
 * refused rather than delegated. A proxy that computed one address and
 * forwarded another is broken, and asking the fallback would answer a
 * different question from the one that failed.
 */

import type { DashboardRole } from "../access/roles";
import type {
  DashboardIdentity,
  DashboardPrincipal,
  ScopeAuthority,
  TenantAuthority,
} from "../seams/identity";

export function createAssertedTenantAuthority(
  inner: TenantAuthority,
): TenantAuthority {
  return {
    mayActAs(principal: DashboardPrincipal, tenantId: string) {
      const asserted = principal.asserted;
      if (asserted === undefined) return inner.mayActAs(principal, tenantId);
      return Promise.resolve(asserted.tenantId === tenantId);
    },
  };
}

export function createAssertedScopeAuthority(
  inner: ScopeAuthority,
): ScopeAuthority {
  return {
    resolveScopeRole(
      identity: DashboardIdentity,
      scopeId: string,
    ): Promise<DashboardRole | null> {
      const asserted = identity.asserted;
      if (asserted === undefined) {
        return inner.resolveScopeRole(identity, scopeId);
      }
      // `tenantId` is checked again here. The tenant authority already
      // compared it, but this interface is public and an integrator may wire
      // the two independently.
      if (
        asserted.tenantId !== identity.tenantId ||
        asserted.scopeId !== scopeId
      ) {
        return Promise.resolve(null);
      }
      return Promise.resolve(asserted.role);
    },
  };
}
