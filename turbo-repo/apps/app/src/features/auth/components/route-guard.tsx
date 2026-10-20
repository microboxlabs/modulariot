"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "../hooks/use-permissions";
import { Spinner } from "flowbite-react";

interface RouteGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
  path?: string;
}

/** Shows `children` when the rule registered for `path` is open; redirects otherwise. */
export function RouteGuard({
  children,
  fallbackPath = "/",
  path,
}: Readonly<RouteGuardProps>) {
  const { hasRoutePermission, isRouteLoading } = usePermissions();
  const router = useRouter();

  const isLoading = isRouteLoading(path ?? "/");
  const allowed = hasRoutePermission(path ?? "/");

  React.useEffect(() => {
    if (isLoading || allowed) return;
    router.push(fallbackPath);
  }, [isLoading, allowed, fallbackPath, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        <Spinner />
      </div>
    );
  }

  return allowed ? <>{children}</> : null;
}
