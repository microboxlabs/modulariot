"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "../hooks/use-permissions";

interface RouteGuardProps {
  children: React.ReactNode;
  requiredGroups: string[];
  operator?: "OR" | "AND";
  fallbackPath?: string;
}

export function RouteGuard({
  children,
  requiredGroups,
  operator = "OR",
  fallbackPath = "/",
}: RouteGuardProps) {
  const { hasPermission, isLoading } = usePermissions();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !hasPermission(requiredGroups, operator)) {
      router.push(fallbackPath);
    }
  }, [
    isLoading,
    hasPermission,
    requiredGroups,
    operator,
    fallbackPath,
    router,
  ]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return hasPermission(requiredGroups, operator) ? <>{children}</> : null;
}
