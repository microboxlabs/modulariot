/**
 * The default role → capabilities mapping. A host that wants different
 * semantics supplies its own `CapabilityPolicy`.
 *
 * Both vocabularies live in the contract and are re-exported here so callers
 * keep one import.
 */

import {
  type DashboardCapabilities,
  type DashboardRole,
  roleAtLeast,
} from "@microboxlabs/miot-dashboard-contract/roles";

export {
  DASHBOARD_ROLES,
  type DashboardCapabilities,
  type DashboardRole,
  highestRole,
  isDashboardRole,
  roleAtLeast,
} from "@microboxlabs/miot-dashboard-contract/roles";

/** Everything allowed. The ceiling a host grants a fully trusted user. */
export const FULL_CAPABILITIES: Readonly<DashboardCapabilities> = Object.freeze(
  {
    readOnly: false,
    canEdit: true,
    canShare: true,
    canManagePermissions: true,
    canDelete: true,
  },
);

export interface RoleCapabilityOptions {
  /**
   * Whether the principal created the dashboard. A Contributor may edit
   * their own dashboards and nobody else's — the same rule most content
   * repositories apply to a contributor role.
   */
  isOwner?: boolean;
}

/**
 * Default mapping from a role to what it may do on one dashboard.
 *
 * - Consumer: view.
 * - Contributor: view; edit only what they created.
 * - Editor: edit and share (sharing grants read access, which an editor is
 *   trusted to do), but neither delete nor change who else has access.
 * - Coordinator: everything.
 *
 * Always returns a fresh object — never a shared constant a caller could
 * mutate.
 */
export function capabilitiesForRole(
  role: DashboardRole,
  options: RoleCapabilityOptions = {},
): DashboardCapabilities {
  const canEdit =
    roleAtLeast(role, "Editor") ||
    (role === "Contributor" && options.isOwner === true);
  return {
    readOnly: !canEdit,
    canEdit,
    canShare: roleAtLeast(role, "Editor"),
    canManagePermissions: role === "Coordinator",
    canDelete: role === "Coordinator",
  };
}

/**
 * The capabilities both sets allow. Used to apply a principal's ceiling
 * (`DashboardIdentity.capabilities`) to what its role would otherwise grant:
 * a ceiling can only narrow, never widen.
 */
export function intersectCapabilities(
  a: Readonly<DashboardCapabilities>,
  b: Readonly<DashboardCapabilities>,
): DashboardCapabilities {
  return {
    readOnly: a.readOnly || b.readOnly,
    canEdit: a.canEdit && b.canEdit,
    canShare: a.canShare && b.canShare,
    canManagePermissions: a.canManagePermissions && b.canManagePermissions,
    canDelete: a.canDelete && b.canDelete,
  };
}
