/**
 * Settings admin types — Phase 3 (read-only).
 * Mirrors the Quarkus DTOs returned by /api/v1/me/scopes, /orgs/{id}/members
 * and /orgs/{id}/modules.
 */

export interface OrgSummary {
  id: number;
  slug: string;
  displayName: string;
  taxId: string | null;
  isParent: boolean;
}

export interface OrgMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
}
