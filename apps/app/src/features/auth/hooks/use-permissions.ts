//import { useSession } from "next-auth/react";
import { hasRouteAccess } from "../config/route-permissions";
import { useUserGroups } from "@/features/common/providers/client-api.provider";

export function usePermissions() {
  //const { data: status } = useSession();
  const { data: userGroups, isLoading } = useUserGroups();

  const hasPermission = (
    requiredGroups: string[],
    operator: "OR" | "AND" = "OR"
  ): boolean => {
    if (!requiredGroups.length) return true;

    return operator === "OR"
      ? requiredGroups.some((group) => userGroups.includes(group))
      : requiredGroups.every((group) => userGroups.includes(group));
  };

  const hasRoutePermission = (
    path: string,
    operator: "OR" | "AND" = "OR"
  ): boolean => {
    return hasRouteAccess(userGroups, path, operator);
  };

  return {
    hasPermission,
    hasRoutePermission,
    isLoading,
    userGroups,
  };
}
