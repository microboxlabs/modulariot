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
  const used = [...pattern.matchAll(/\{([^{}]*)\}/g)].map((match) => match[1]);
  if (used.some((name) => !KNOWN_PLACEHOLDERS.has(name ?? ""))) {
    return "may only use the placeholders {tenant}, {scope} and {role}";
  }
  const parts = pattern.split(PLACEHOLDER);
  const scope = parts.indexOf("scope");
  if (scope !== -1 && (parts[scope - 1] === "" || parts[scope + 1] === "")) {
    return "must separate {scope} from the other placeholders with text";
  }
  return undefined;
}

const KNOWN_PLACEHOLDERS = new Set(["tenant", "scope", "role"]);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * The characters next to `{scope}`, which a scope id may not contain.
 *
 * Without this rule `DHB_{tenant}_{scope}_{role}` is ambiguous whenever ids
 * contain `_`: `DHB_ACME_X_OPS_EDITOR` reads as tenant `acme_x`, scope `ops`
 * and as tenant `acme`, scope `x_ops`. Keeping the separator out of scope ids
 * leaves only the first reading.
 */
function scopeSeparators(parts: string[]): string {
  const scope = parts.indexOf("scope");
  if (scope === -1) return "";
  const before = parts[scope - 1] ?? "";
  const after = parts[scope + 1] ?? "";
  return [...new Set([before.slice(-1), after.slice(0, 1)])]
    .filter((character) => character !== "")
    .join("");
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
  const parts = options.pattern.split(PLACEHOLDER);
  const hasScope = parts.includes("scope");
  const separators = scopeSeparators(parts);
  const anyScope = separators === "" ? ".+" : `[^${escapeRegExp(separators)}]+`;
  const isScopeId = (scopeId: string): boolean =>
    ![...separators].some((character) => scopeId.includes(character));

  // Group names are matched case-insensitively: identity providers tend to
  // upper-case them while tenant ids are lower case.
  const matcher = (tenantId: string, scopeId: string | undefined): RegExp => {
    const source = parts
      .map((part, index) => {
        if (index % 2 === 0) return escapeRegExp(part);
        if (part === "tenant") return escapeRegExp(tenantId);
        if (part === "scope") {
          return scopeId === undefined ? anyScope : escapeRegExp(scopeId);
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
        if (hasScope && !isScopeId(scopeId)) return Promise.resolve(null);
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
