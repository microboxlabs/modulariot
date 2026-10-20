"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { usePermissions } from "../hooks/use-permissions";
import { Spinner } from "flowbite-react";

interface RouteGuardProps {
  children: React.ReactNode;
  path?: string;
}

/** Shows `children` when the rule registered for `path` is open; sends to the no-access page otherwise. */
export function RouteGuard({ children, path }: Readonly<RouteGuardProps>) {
  const { hasRoutePermission, isLoading } = usePermissions();
  const router = useRouter();
  const { lang } = useParams<{ lang: string }>();

  const allowed = hasRoutePermission(path ?? "/");

  React.useEffect(() => {
    if (isLoading || allowed) return;
    router.push(`/${lang}/no-access?from=${encodeURIComponent(path ?? "/")}`);
  }, [isLoading, allowed, lang, path, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        <Spinner />
      </div>
    );
  }

  return allowed ? <>{children}</> : null;
}
