import type {
  AlfrescoNodePermissions,
  AlfrescoPermissionEntry,
  AuthoritySuggestion,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";

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

export type DashboardPermissionsResponse = {
  nodeId: string;
  permissions: AlfrescoNodePermissions;
};

export type { AlfrescoPermissionEntry, AuthoritySuggestion };
