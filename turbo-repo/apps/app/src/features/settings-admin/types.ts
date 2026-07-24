/** Settings DTOs mirrored from the org-scoped Quarkus APIs. */

export interface OrgSummary {
  id: number;
  slug: string;
  displayName: string;
  taxId: string | null;
  role: string;
  isParent: boolean;
}

export interface ActiveOrg extends OrgSummary {
  /** Open set — backend may add modules we don't yet know about. */
  modules: string[];
}

export interface OrgMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

export interface ContentReviewPermission {
  enabled: boolean;
  permissionCode: string;
  roleCode: string;
  assigneeIds: string[];
}

export interface SetContentReviewPermission {
  enabled: boolean;
  assigneeIds: string[];
}

export interface OrganizationRole {
  roleCode: string;
  assigneeIds: string[];
}

export interface SetOrganizationRole {
  assigneeIds: string[];
}
