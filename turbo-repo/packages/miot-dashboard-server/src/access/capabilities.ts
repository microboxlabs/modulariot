/**
 * Capability policy — how role assignments become one dashboard's
 * capabilities for one principal.
 *
 * This is a seam with a default, not a fixed rule: the default policy folds
 * scope membership and per-dashboard assignments into an effective role and
 * maps it through `capabilitiesForRole`. A host whose permission model
 * cannot be expressed that way (one that answers "may this user update this
 * node?" directly, say) supplies its own policy and the access control uses
 * it unchanged.
 *
 * Whatever the policy returns is still intersected with the principal's
 * ceiling by the access control — a policy can never grant past
 * `DashboardIdentity.capabilities`.
 */

import type {
  DashboardCapabilities,
  DashboardIdentity,
} from "../seams/identity";
import type {
  DashboardRecord,
  PermissionAssignment,
  ServerDashboardRef,
} from "../seams/store";
import { capabilitiesForRole, highestRole, type DashboardRole } from "./roles";

export interface CapabilityContext {
  identity: DashboardIdentity;
  ref: ServerDashboardRef;
  /** The principal's standing in the scope, from `ScopeAuthority`. */
  scopeRole: DashboardRole;
  /** From `ServerDashboardStore.getPermissions`; empty when the dashboard does not exist yet. */
  assignments: readonly PermissionAssignment[];
  /** Null when the dashboard does not exist yet (a first save). */
  record: DashboardRecord | null;
}

export interface CapabilityPolicy {
  /**
   * Return `null` to deny the principal any access to this dashboard, even
   * though they are a member of its scope. The access control turns that into
   * a 403 before any operation runs.
   */
  resolve(
    context: CapabilityContext,
  ): DashboardCapabilities | null | Promise<DashboardCapabilities | null>;
}

/** Authority ids the principal can be matched against: their own id plus every group. */
function authoritiesOf(identity: DashboardIdentity): Set<string> {
  return new Set([identity.userId, ...(identity.groups ?? [])]);
}

/**
 * Default policy: the strongest role among scope membership and any
 * assignment naming the principal or one of its groups. A Contributor is
 * additionally treated as owner of dashboards it created.
 */
export const roleCapabilityPolicy: CapabilityPolicy = {
  resolve({ identity, scopeRole, assignments, record }) {
    const authorities = authoritiesOf(identity);
    const roles: DashboardRole[] = [scopeRole];
    for (const assignment of assignments) {
      if (authorities.has(assignment.authorityId)) roles.push(assignment.role);
    }
    const role = highestRole(roles) ?? scopeRole;
    const isOwner =
      record?.createdBy !== undefined && record.createdBy === identity.userId;
    return capabilitiesForRole(role, { isOwner });
  },
};
