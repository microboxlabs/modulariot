import { auth } from "@/auth";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type { Session } from "next-auth";

const ALFRESCO_ADMIN_GROUP = "GROUP_ALFRESCO_ADMINISTRATORS";

// Admin groups that can access admin features
export const ADMIN_GROUPS = [
  ALFRESCO_ADMIN_GROUP,
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

/** Check whether the current user belongs to Alfresco's administrator group. */
export async function hasAlfrescoAdminAccess(): Promise<boolean> {
  const session = await auth();

  return hasAlfrescoAdminAccessForSession(session);
}

/** Check whether a session belongs to Alfresco's administrator group. */
export async function hasAlfrescoAdminAccessForSession(
  session: Session | null
): Promise<boolean> {
  if (!session?.user) {
    return false;
  }

  try {
    const userGroups = await getGroupsForPerson(session);
    return userGroups.includes(ALFRESCO_ADMIN_GROUP);
  } catch (error) {
    console.error("Error checking Alfresco administrator access:", error);
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
