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
import {
  capabilitiesForRole,
  highestRole,
  roleAtLeast,
  type DashboardRole,
} from "./roles";

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
export function authoritiesOf(identity: DashboardIdentity): Set<string> {
  return new Set([identity.userId, ...(identity.groups ?? [])]);
}

/**
 * The least scope standing at which a creator still controls what they made:
 * the standing that may create dashboards at all. Below it — demoted to a
 * reader — the scope's role decides alone, so the organization's permissions
 * keep priority over a creator's.
 */
export const CREATOR_FLOOR: DashboardRole = "Contributor";

/**
 * Whether the principal created an existing item and still holds the scope
 * standing to keep it: such a creator is its Coordinator, on that item only.
 * Someone removed from the organization never gets this far — the host stops
 * them before a scope role is ever asserted.
 */
export function ownsAsCreator(
  identity: DashboardIdentity,
  scopeRole: DashboardRole,
  createdBy: string | undefined,
): boolean {
  return (
    createdBy !== undefined &&
    createdBy === identity.userId &&
    roleAtLeast(scopeRole, CREATOR_FLOOR)
  );
}

/**
 * Default policy: the strongest role among scope membership and any
 * assignment naming the principal or one of its groups. The creator of a
 * dashboard is its Coordinator (see `ownsAsCreator`), so they decide who may
 * use it; a Contributor is otherwise treated as owner of a dashboard it is
 * about to create.
 */
export const roleCapabilityPolicy: CapabilityPolicy = {
  resolve({ identity, scopeRole, assignments, record }) {
    const authorities = authoritiesOf(identity);
    const roles: DashboardRole[] = [scopeRole];
    for (const assignment of assignments) {
      if (authorities.has(assignment.authorityId)) roles.push(assignment.role);
    }
    if (
      record !== null &&
      ownsAsCreator(identity, scopeRole, record.createdBy)
    ) {
      roles.push("Coordinator");
    }
    const role = highestRole(roles) ?? scopeRole;
    // A new document will be owned by its creator. The access control still
    // requires Contributor scope membership for creation; document policy and
    // the identity ceiling may further restrict it.
    const isOwner = record === null || record.createdBy === identity.userId;
    return capabilitiesForRole(role, { isOwner });
  },
};
