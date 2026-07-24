/**
 * Dashboard role vocabulary.
 *
 * Moved from apps/app `features/dashboard/types/permissions.types.ts` in P1.
 * Only the host-agnostic role names live here — the Alfresco-shaped
 * permissions response types stay app-side (they are exactly the coupling
 * Seam F exists to hide; see adapters/capabilities).
 */

export const DASHBOARD_ROLES = [
  "Consumer",
  "Contributor",
  "Editor",
  "Coordinator",
] as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export function isDashboardRole(value: string): value is DashboardRole {
  return (DASHBOARD_ROLES as readonly string[]).includes(value);
}
