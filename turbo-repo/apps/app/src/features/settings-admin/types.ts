/**
 * Settings admin types — Phase 3 (read-only).
 * Mirrors the Quarkus DTOs returned by /api/v1/me/scopes, /orgs/{id}/members
 * and /orgs/{id}/modules.
 */

export type ModuleCode = string; // open set — backend may add modules we don't yet know about

export interface OrgSummary {
  id: number;
  slug: string;
  displayName: string;
  taxId: string | null;
  isParent: boolean;
}

export interface ActiveOrg extends OrgSummary {
  role: string;
  modules: ModuleCode[];
}

export interface OrgMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
}
