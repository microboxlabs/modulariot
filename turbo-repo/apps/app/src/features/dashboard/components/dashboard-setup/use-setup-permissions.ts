"use client";

import { useEffect, useState } from "react";
import {
  useDashboardPermissions,
  type DashboardPermissionsOptions,
  type PermissionAssignment,
} from "@microboxlabs/miot-dashboard-ui/react";

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
  });
  useEffect(() => {
    if (!state.loaded || state.error !== null) return;
    setDraft((current) => {
      const preserve =
        current.key === state.editorKey &&
        current.initialized &&
        JSON.stringify(current.assignments) !== JSON.stringify(current.base);
      return {
        key: state.editorKey,
        base: state.assignments,
        assignments: preserve ? current.assignments : state.assignments,
        initialized: true,
      };
    });
  }, [state.assignments, state.editorKey, state.loaded, state.error]);
  const assignments = draft.key === state.editorKey ? draft.assignments : [];
  const dirty =
    draft.key === state.editorKey &&
    JSON.stringify(assignments) !== JSON.stringify(draft.base);
  return {
    assignments,
    onChange: (next) =>
      setDraft((current) => ({ ...current, assignments: next })),
    save: async () => {
      if (
        !state.loaded ||
        !state.editable ||
        state.busy ||
        state.error !== null
      )
        return false;
      if (!dirty) return true;
      const saved = await state.save(assignments);
      if (saved)
        setDraft((current) =>
          current.key === state.editorKey
            ? { ...current, base: assignments }
            : current
        );
      return saved;
    },
    dirty,
    busy: state.busy,
    canManage: state.loaded && state.editable,
    loading: state.busy || (!state.loaded && state.error === null),
    error: state.error,
    retry: state.reload,
  };
}
