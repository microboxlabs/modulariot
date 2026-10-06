/**
 * Tenant entitlement and scope roles read from the caller's own groups.
 *
 * For a host whose identity provider already names the tenant and the role in
 * a group, such as `GROUP_DHB_ACME_EDITOR`, there is nothing to look up: the
 * credential answers both questions. A pattern says where the tenant, the
 * optional scope and the role sit in the group name.
 *
 * The request names the tenant and the scope, so the pattern is filled in with
 * those values and then matched, rather than parsed. Parsing would be
 * ambiguous as soon as a tenant id contains the separator (`muni_nunoa` in
 * `GROUP_DHB_MUNI_NUNOA_EDITOR`); filling in is not.
 */

import {
  DASHBOARD_ROLES,
  type DashboardRole,
  highestRole,
} from "../access/roles";
import type {
  DashboardIdentity,
  DashboardPrincipal,
  ScopeAuthority,
  TenantAuthority,
} from "../seams/identity";

export interface GroupRoleOptions {
  /**
   * The group name with `{tenant}` and `{role}`, and optionally `{scope}`,
   * such as `GROUP_DHB_{tenant}_{role}`. Without `{scope}` a role applies in
   * every scope of the tenant.
   */
  pattern: string;
  /** The `{role}` part of a group name mapped onto this package's roles. */
  roleMap?: Record<string, DashboardRole>;
}

export interface GroupRoleAuthorities {
  tenants: TenantAuthority;
  scopes: ScopeAuthority;
}

/** `CONSUMER`, `CONTRIBUTOR`, `EDITOR`, `COORDINATOR`. */
export const DEFAULT_GROUP_ROLE_MAP: Readonly<Record<string, DashboardRole>> =
  Object.freeze(
    Object.fromEntries(
      DASHBOARD_ROLES.map((role) => [role.toUpperCase(), role]),
    ),
  );

const PLACEHOLDER = /\{(tenant|scope|role)\}/g;

/** Why a pattern cannot be used, or `undefined` when it can. */
export function groupPatternProblem(pattern: string): string | undefined {
  const names = [...pattern.matchAll(PLACEHOLDER)].map((match) => match[1]);
  for (const required of ["tenant", "role"]) {
    const count = names.filter((name) => name === required).length;
    if (count !== 1) return `must contain {${required}} exactly once`;
  }
  if (names.filter((name) => name === "scope").length > 1) {
    return "may contain {scope} at most once";
  }
  if (/\{(?!tenant\}|scope\}|role\})[^}]*\}/.test(pattern)) {
    return "may only use the placeholders {tenant}, {scope} and {role}";
  }
  return undefined;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createGroupRoleAuthorities(
  options: GroupRoleOptions,
): GroupRoleAuthorities {
  const problem = groupPatternProblem(options.pattern);
  if (problem !== undefined) {
    throw new Error(`The group pattern "${options.pattern}" ${problem}`);
  }

  // Keys compare case-insensitively, like the rest of the group name.
  const roles = new Map<string, DashboardRole>(
    Object.entries(options.roleMap ?? DEFAULT_GROUP_ROLE_MAP).map(
      ([key, role]) => [key.toUpperCase(), role],
    ),
  );
  const roleAlternatives = [...roles.keys()].map(escapeRegExp).join("|");
  const hasScope = options.pattern.includes("{scope}");

  // Group names are matched case-insensitively: identity providers tend to
  // upper-case them while tenant ids are lower case.
  const matcher = (tenantId: string, scopeId: string | undefined): RegExp => {
    const source = options.pattern
      .split(PLACEHOLDER)
      .map((part, index) => {
        if (index % 2 === 0) return escapeRegExp(part);
        if (part === "tenant") return escapeRegExp(tenantId);
        if (part === "scope") {
          return scopeId === undefined ? ".+" : escapeRegExp(scopeId);
        }
        return `(${roleAlternatives})`;
      })
      .join("");
    return new RegExp(`^${source}$`, "i");
  };

  const rolesIn = (
    principal: DashboardPrincipal,
    tenantId: string,
    scopeId: string | undefined,
  ): DashboardRole[] => {
    const expression = matcher(tenantId, scopeId);
    const found: DashboardRole[] = [];
    for (const group of principal.groups ?? []) {
      const match = expression.exec(group.trim());
      const key = match?.[1];
      const role = key === undefined ? undefined : roles.get(key.toUpperCase());
      if (role !== undefined) found.push(role);
    }
    return found;
  };

  return {
    tenants: {
      mayActAs(principal, tenantId) {
        return Promise.resolve(
          rolesIn(principal, tenantId, undefined).length > 0,
        );
      },
    },
    scopes: {
      resolveScopeRole(identity: DashboardIdentity, scopeId: string) {
        const found = rolesIn(
          identity,
          identity.tenantId,
          hasScope ? scopeId : undefined,
        );
        return Promise.resolve(highestRole(found));
      },
    },
  };
}
