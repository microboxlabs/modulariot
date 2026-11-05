"use client";

import type React from "react";
import { usePermissions } from "../hooks/use-permissions";
import type { AccessRule } from "../access/access-control";

interface AccessAllowedProps {
  rule: AccessRule;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Renders `children` when the gate is open, `fallback` otherwise (and while loading). */
export function AccessAllowed({
  rule,
  children,
  fallback = null,
}: Readonly<AccessAllowedProps>) {
  const { canAccess } = usePermissions();
  return <>{canAccess(rule) ? children : fallback}</>;
}
