import type {
  DashboardCapabilities,
  DashboardRole,
} from "@microboxlabs/miot-dashboard-ui";
import {
  FULL_CAPABILITIES,
  READ_ONLY_CAPABILITIES,
} from "@microboxlabs/miot-dashboard-ui";

/**
 * Seam F implementation: map the app's Alfresco-backed dashboard roles onto
 * the package's capability contract. Embed hosts will build capabilities from
 * token claims instead — same contract, no role model required.
 */
export function capabilitiesForRole(
  role: DashboardRole | null | undefined
): DashboardCapabilities {
  switch (role) {
    case "Coordinator":
      return FULL_CAPABILITIES;
    case "Editor":
    case "Contributor":
      return {
        readOnly: false,
        canEdit: true,
        canShare: true,
        canManagePermissions: false,
        canDelete: false,
      };
    case "Consumer":
      return { ...READ_ONLY_CAPABILITIES, canShare: true };
    default:
      return READ_ONLY_CAPABILITIES;
  }
}
