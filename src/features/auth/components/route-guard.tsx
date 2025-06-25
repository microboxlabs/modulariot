"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "../hooks/use-permissions";

interface RouteGuardProps {
  children: React.ReactNode;
  requiredGroups?: string[];
  blockedGroups?: string[];
  operator?: "OR" | "AND";
  fallbackPath?: string;
  path?: string;
}

export function RouteGuard({
  children,
  requiredGroups = [],
  blockedGroups = [],
  operator = "OR",
  fallbackPath = "/",
  path,
}: RouteGuardProps) {
  const { hasPermission, hasRoutePermission, userGroups, isLoading } =
    usePermissions();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;

    // If path is provided, use hasRoutePermission for comprehensive check
    if (path) {
      const canAccessRoute = hasRoutePermission(path, operator);
      if (!canAccessRoute) {
        router.push(fallbackPath);
        return;
      }
    } else {
      // Fallback to manual checks if no path provided
      // Check if user has any blocked groups
      const hasBlockedGroup = blockedGroups.some((group) =>
        userGroups.includes(group),
      );
      if (hasBlockedGroup) {
        router.push(fallbackPath);
        return;
      }

      // Check if user has required permissions
      if (
        requiredGroups.length > 0 &&
        !hasPermission(requiredGroups, operator)
      ) {
        router.push(fallbackPath);
      }
    }
  }, [
    isLoading,
    hasPermission,
    hasRoutePermission,
    requiredGroups,
    blockedGroups,
    userGroups,
    operator,
    fallbackPath,
    router,
    path,
  ]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // If path is provided, use hasRoutePermission for comprehensive check
  if (path) {
    const canAccessRoute = hasRoutePermission(path, operator);
    return canAccessRoute ? <>{children}</> : null;
  }

  // Fallback to manual checks if no path provided
  // Check blocked groups first
  const hasBlockedGroup = blockedGroups.some((group) =>
    userGroups.includes(group),
  );
  if (hasBlockedGroup) {
    return null;
  }

  // Then check required permissions
  const hasRequiredPermission =
    requiredGroups.length === 0 || hasPermission(requiredGroups, operator);
  return hasRequiredPermission ? <>{children}</> : null;
}
