import { useSession } from "next-auth/react";

export function usePermissions() {
  const { data: session, status } = useSession();
  const userGroups = session?.user?.groups || [];

  const hasPermission = (
    requiredGroups: string[],
    operator: "OR" | "AND" = "OR",
  ): boolean => {
    if (!requiredGroups.length) return true;

    return operator === "OR"
      ? requiredGroups.some((group) => userGroups.includes(group))
      : requiredGroups.every((group) => userGroups.includes(group));
  };

  return {
    hasPermission,
    isLoading: status === "loading",
    userGroups,
  };
}
