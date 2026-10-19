"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  OrgMember,
  OrganizationPermission,
  SetOrganizationPermission,
} from "../types";

function sortedIds(ids: Iterable<string>): string[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

/**
 * Local edit state for an organization permission card: the enabled flag, the
 * assignee set, member search and the save call (full list replaces).
 */
export function usePermissionAssignmentForm(
  permission: OrganizationPermission | undefined,
  members: OrgMember[],
  save: (value: SetOrganizationPermission) => Promise<unknown>
) {
  const [enabled, setEnabled] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!permission) return;
    setEnabled(permission.enabled);
    setAssigneeIds(new Set(permission.assigneeIds));
  }, [permission]);

  const toggleAssignee = (personId: string) => {
    setAssigneeIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaveError(false);
    try {
      await save({ enabled, assigneeIds: sortedIds(assigneeIds) });
    } catch {
      setSaveError(true);
    }
  };

  const memberIds = new Set(members.map((member) => member.id));
  const unavailableAssigneeIds = sortedIds(
    [...assigneeIds].filter((personId) => !memberIds.has(personId))
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleMembers = useMemo(
    () =>
      members.filter((member) => {
        if (!normalizedQuery) return true;
        return [member.displayName, member.email].some((value) =>
          value?.toLocaleLowerCase().includes(normalizedQuery)
        );
      }),
    [members, normalizedQuery]
  );
  const hasChanges =
    permission != null &&
    (enabled !== permission.enabled ||
      assigneeIds.size !== permission.assigneeIds.length ||
      permission.assigneeIds.some((personId) => !assigneeIds.has(personId)));

  return {
    enabled,
    setEnabled,
    assigneeIds,
    toggleAssignee,
    query,
    setQuery,
    visibleMembers,
    unavailableAssigneeIds,
    hasChanges,
    saveError,
    handleSave,
  };
}
