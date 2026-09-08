/**
 * Role vocabulary and the default role → capabilities mapping.
 *
 * Roles are what hosts store (a permission assignment names a role);
 * capabilities are what the UI package consumes (Seam F). This module is the
 * one place the two vocabularies meet, so a host that wants different
 * semantics overrides the `CapabilityPolicy` rather than patching call sites.
 *
 * The vocabulary is shared verbatim with `@microboxlabs/miot-dashboard-ui`
 * (`types/roles.ts`) and the wire contract's `PermissionAssignments`.
 */

import type { DashboardCapabilities } from "../seams/identity";

export const DASHBOARD_ROLES = [
  "Consumer",
  "Contributor",
  "Editor",
  "Coordinator",
] as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export function isDashboardRole(value: unknown): value is DashboardRole {
  return (
    typeof value === "string" &&
    (DASHBOARD_ROLES as readonly string[]).includes(value)
  );
}

/** Strict ordering; a higher role has every capability of the ones below it. */
const RANK: Readonly<Record<DashboardRole, number>> = Object.freeze({
  Consumer: 0,
  Contributor: 1,
  Editor: 2,
  Coordinator: 3,
});

/** True when `role` grants at least what `floor` does. */
export function roleAtLeast(
  role: DashboardRole,
  floor: DashboardRole,
): boolean {
  return RANK[role] >= RANK[floor];
}

/** The strongest role in the list, or null for an empty list. */
export function highestRole(
  roles: Iterable<DashboardRole>,
): DashboardRole | null {
  let best: DashboardRole | null = null;
  for (const role of roles) {
    if (best === null || RANK[role] > RANK[best]) best = role;
  }
  return best;
}

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
