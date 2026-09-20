/**
 * The role and capability vocabulary.
 *
 * A permission assignment names a role; an API answer reports capabilities.
 * Both cross the wire, so both are fixed here — an implementation of either
 * half that invents a fifth role, or a sixth capability, is talking to nobody.
 *
 * What is *not* fixed here is the mapping between them. A host may decide that
 * its Editors cannot share, and the server lets it: `CapabilityPolicy` is a
 * seam, and the default mapping lives with the server that ships it. Only the
 * two vocabularies and the ordering below are contractual.
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

/**
 * Strict ordering, and contractual: a host mapping its own roles onto these
 * is promising that a higher one grants at least what every lower one does.
 * Without that promise `roleAtLeast` means nothing and neither does the
 * highest-wins rule that resolves several assignments to one answer.
 */
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
 * What a caller may do with one dashboard, as the capabilities endpoint
 * reports it.
 *
 * `readOnly` is not simply `!canEdit`: it is what a renderer switches on to
 * decide whether to mount editing affordances at all, and a host may leave
 * editing off while granting `canShare`.
 */
export interface DashboardCapabilities {
  readOnly: boolean;
  canEdit: boolean;
  canShare: boolean;
  canManagePermissions: boolean;
  canDelete: boolean;
}
