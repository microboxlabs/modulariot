import type { AlfrescoNodePermissions } from "@/features/common/providers/alfresco-api/alfresco-api.types";

export type {
  AlfrescoPermissionEntry,
  AuthoritySuggestion,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";

// Role vocabulary moved to @microboxlabs/miot-dashboard-ui (P1). The
// Alfresco-shaped response types below deliberately stay app-side: they are
// exactly the host coupling the package's capabilities seam (Seam F) hides.
export {
  DASHBOARD_ROLES,
  isDashboardRole,
} from "@microboxlabs/miot-dashboard-ui";
export type { DashboardRole } from "@microboxlabs/miot-dashboard-ui";

export type DashboardPermissionsResponse = {
  nodeId: string;
  permissions: AlfrescoNodePermissions;
};
