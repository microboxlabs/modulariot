import { auth } from "@/auth";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

// Admin groups that can access admin features
export const ADMIN_GROUPS = [
  "GROUP_ALFRESCO_ADMINISTRATORS",
  "GROUP_MINTRAL_SYSTEM_ADMIN",
];

/**
 * Check if the current session has admin access
 */
export async function hasAdminAccess(): Promise<boolean> {
  const session = await auth();

  if (!session?.user) {
    return false;
  }

  try {
    const userGroups = await getGroupsForPerson(session);
    return userGroups.some((group) => ADMIN_GROUPS.includes(group));
  } catch (error) {
    console.error("Error checking admin access:", error);
    return false;
  }
}

/**
 * Check if a specific session has admin access
 */
export async function hasAdminAccessForSession(session: any): Promise<boolean> {
  if (!session?.user) {
    return false;
  }

  try {
    const userGroups = await getGroupsForPerson(session);
    return userGroups.some((group) => ADMIN_GROUPS.includes(group));
  } catch (error) {
    console.error("Error checking admin access:", error);
    return false;
  }
}
