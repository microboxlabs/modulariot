"use client";

import React, { useEffect } from "react";
import { useAuth } from "../context/auth-context";
import { useRouter } from "next/navigation";

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
  const { hasPermission, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
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
    return <div>Loading...</div>; // Replace this, ask Rodrigo
  }

  return hasPermission(requiredGroups, operator) ? <>{children}</> : null;
}
