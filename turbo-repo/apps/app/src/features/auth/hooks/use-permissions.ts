"use client";

import { useCallback, useMemo } from "react";
import { getRouteRule } from "../config/route-permissions";
import {
  decideAccess,
  parseAccessSource,
  type AccessRule,
  type AccessSource,
} from "../access/access-control";
import { reportAccessMismatch } from "../access/report-mismatch";
import { useUserGroups } from "@/features/common/providers/client-api.provider";
import { useMyAccess } from "@/features/settings-admin/team/team-api";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";

export type CanAccess = (rule: AccessRule, context?: string) => boolean;

/** The access source from the runtime config; `null` until it has loaded. */
export function useAccessSource(): AccessSource | null {
  const runtimeConfig = useRuntimeConfig();
  return runtimeConfig
    ? parseAccessSource(runtimeConfig.ACCESS_CONTROL_SOURCE)
    : null;
}

/**
 * Decides gates with the configured access source. Every gate stays closed
 * until the source and the data it needs have loaded.
 */
export function usePermissions() {
  const source = useAccessSource();
  const { data: userGroups, isLoading: groupsLoading } = useUserGroups();
  const { access, accessError } = useMyAccess();
  const permissions = useMemo(
    () => access?.permissions ?? (accessError ? [] : null),
    [access, accessError]
  );

  const isLoading =
    source === null ||
    groupsLoading ||
    (source === "permissions" && permissions === null);

  const canAccess = useCallback<CanAccess>(
    (rule, context) => {
      if (source === null) return false;
      const decision = decideAccess(source, rule, {
        groups: userGroups,
        permissions,
      });
      if (decision.mismatch && !groupsLoading) {
        reportAccessMismatch(rule, decision, context);
      }
      return decision.allowed;
    },
    [source, userGroups, permissions, groupsLoading]
  );

  const hasRoutePermission = useCallback(
    (path: string): boolean => canAccess(getRouteRule(path), path),
    [canAccess]
  );

  return {
    canAccess,
    hasRoutePermission,
    isLoading,
    source,
    userGroups,
  };
}
