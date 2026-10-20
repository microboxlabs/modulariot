"use client";

import { useCallback, useMemo } from "react";
import { getRouteRule } from "../config/route-permissions";
import {
  decideAccess,
  needsGroups,
  needsPermissions,
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
 * Decides gates with the configured access source. A gate stays closed until
 * the source and the data that rule needs have loaded. A failed permissions
 * read denies in `permissions` mode and counts as unknown in `shadow` mode.
 */
export function usePermissions() {
  const source = useAccessSource();
  const { data: userGroups, isLoading: groupsLoading } = useUserGroups();
  const { access, accessError } = useMyAccess();
  const permissionsLoading = !access && !accessError;
  const permissions = useMemo(() => {
    if (access) return access.permissions;
    return accessError && source === "permissions" ? [] : null;
  }, [access, accessError, source]);

  const isRuleLoading = useCallback(
    (rule: AccessRule): boolean => {
      if (source === null) return true;
      if (needsGroups(source, rule) && groupsLoading) return true;
      return (
        source === "permissions" &&
        needsPermissions(source, rule) &&
        permissionsLoading
      );
    },
    [source, groupsLoading, permissionsLoading]
  );

  const canAccess = useCallback<CanAccess>(
    (rule, context) => {
      if (source === null || isRuleLoading(rule)) return false;
      const decision = decideAccess(source, rule, {
        groups: userGroups,
        permissions,
      });
      if (decision.mismatch) reportAccessMismatch(rule, decision, context);
      return decision.allowed;
    },
    [source, isRuleLoading, userGroups, permissions]
  );

  const hasRoutePermission = useCallback(
    (path: string): boolean => canAccess(getRouteRule(path), path),
    [canAccess]
  );

  const isRouteLoading = useCallback(
    (path: string): boolean => isRuleLoading(getRouteRule(path)),
    [isRuleLoading]
  );

  return {
    canAccess,
    hasRoutePermission,
    isRuleLoading,
    isRouteLoading,
    source,
    userGroups,
  };
}
