/**
 * The role and capability vocabulary, and the role ordering.
 *
 * The role-to-capability mapping is not fixed here: a host supplies a
 * `CapabilityPolicy`, and the server ships a default one.
 */

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

/** Strict ordering: a higher role grants at least what every lower one does. */
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

/**
 * What a caller may do with one dashboard. `readOnly` is not `!canEdit`: a
 * host may set it while still granting `canShare`.
 */
export interface DashboardCapabilities {
  readOnly: boolean;
  canEdit: boolean;
  canShare: boolean;
  canManagePermissions: boolean;
  canDelete: boolean;
}
