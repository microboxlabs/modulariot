"use client";

import { useEffect, useState } from "react";
import {
  useDashboardPermissions,
  type DashboardPermissionsOptions,
  type PermissionAssignment,
} from "@microboxlabs/miot-dashboard-ui/react";

function rolesOf(items: PermissionAssignment[]) {
  return new Map(items.map((a) => [a.authorityId, a.role] as const));
}

/** Reapply local edits to the latest list, rejecting conflicting role changes. */
function rebaseAssignments(
  base: PermissionAssignment[],
  draft: PermissionAssignment[],
  remote: PermissionAssignment[]
) {
  const before = rolesOf(base);
  const local = rolesOf(draft);
  const latest = rolesOf(remote);
  for (const id of new Set([...before.keys(), ...local.keys()])) {
    if (local.get(id) === before.get(id)) continue;
    if (latest.get(id) !== before.get(id) && latest.get(id) !== local.get(id)) {
      return { assignments: draft, conflict: true };
    }
    const role = local.get(id);
    if (role === undefined) latest.delete(id);
    else latest.set(id, role);
  }
  return {
    assignments: [...latest].map(([authorityId, role]) => ({
      authorityId,
      role,
    })),
    conflict: false,
  };
}

/**
 * Who may use the dashboard, as an editor edits it: the new dashboard's
 * setup, and the dashboard's settings.
 */
export interface PermissionsState {
  assignments: readonly PermissionAssignment[];
  onChange: (assignments: PermissionAssignment[]) => void;
  /** Saves the edits; false when they could not be saved. */
  save: () => Promise<boolean>;
  /** Whether the draft differs from what is saved. */
  dirty: boolean;
  busy: boolean;
  canManage: boolean;
  /** Still reading who has access, and whether the caller may change it. */
  loading: boolean;
  error: number | null;
  retry: () => Promise<boolean>;
}

export const NO_PERMISSIONS: PermissionsState = {
  assignments: [],
  onChange: () => undefined,
  save: async () => true,
  dirty: false,
  busy: false,
  canManage: false,
  loading: false,
  error: null,
  retry: async () => false,
};

/** The dashboard's permissions from its server, edited as a draft. */
export function useSetupPermissions(
  options: DashboardPermissionsOptions
): PermissionsState {
  const state = useDashboardPermissions(options);
  const [draft, setDraft] = useState({
    key: state.editorKey,
    base: [] as PermissionAssignment[],
    assignments: [] as PermissionAssignment[],
    initialized: false,
    conflict: false,
  });
  useEffect(() => {
    if (!state.loaded || state.error !== null) return;
    setDraft((current) => {
      const same = current.key === state.editorKey && current.initialized;
      if (same && current.conflict) return current;
      const rebased = same
        ? rebaseAssignments(
            current.base,
            current.assignments,
            state.assignments
          )
        : { assignments: state.assignments, conflict: false };
      return {
        key: state.editorKey,
        base: state.assignments,
        assignments: rebased.assignments,
        initialized: true,
        conflict: rebased.conflict,
      };
    });
  }, [state.assignments, state.editorKey, state.loaded, state.error]);
  const assignments = draft.key === state.editorKey ? draft.assignments : [];
  const dirty =
    draft.key === state.editorKey &&
    JSON.stringify(assignments) !== JSON.stringify(draft.base);
  const conflict = draft.key === state.editorKey && draft.conflict;
  return {
    assignments,
    onChange: (next) =>
      setDraft((current) => ({ ...current, assignments: next })),
    save: async () => {
      if (
        conflict ||
        !state.loaded ||
        !state.editable ||
        state.busy ||
        state.error !== null
      )
        return false;
      if (!dirty) return true;
      // The confirmation refresh is authoritative. Its assignments update the
      // base through the effect, including grants added by other managers.
      return state.save(assignments);
    },
    dirty,
    busy: state.busy,
    canManage: state.loaded && state.editable && !conflict,
    loading: state.busy || (!state.loaded && state.error === null),
    error: state.error ?? (conflict ? 409 : null),
    retry: () => {
      if (conflict)
        setDraft({
          key: state.editorKey,
          base: state.assignments,
          assignments: state.assignments,
          initialized: true,
          conflict: false,
        });
      return state.reload();
    },
  };
}
