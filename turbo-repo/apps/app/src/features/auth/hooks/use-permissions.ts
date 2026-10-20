"use client";

import { useCallback, useMemo } from "react";
import { getRouteRule } from "../config/route-permissions";
import { decideAccess, type AccessRule } from "../access/access-control";
import { useMyAccess } from "@/features/settings-admin/team/team-api";

export type CanAccess = (rule: AccessRule) => boolean;

/**
 * Decides gates with the caller's IAM permissions in the active organization.
 * Gated rules stay closed while the permissions load and when they cannot be
 * loaded.
 */
export function usePermissions() {
  const { access, accessError } = useMyAccess();
  const permissions = useMemo(
    () => access?.permissions ?? (accessError ? [] : null),
    [access, accessError]
  );

  const canAccess = useCallback<CanAccess>(
    (rule) => decideAccess(rule, permissions),
    [permissions]
  );

  const hasRoutePermission = useCallback(
    (path: string): boolean => canAccess(getRouteRule(path)),
    [canAccess]
  );

  return {
    canAccess,
    hasRoutePermission,
    isLoading: permissions === null,
  };
}
