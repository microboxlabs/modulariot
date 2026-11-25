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
}

export const NO_PERMISSIONS: PermissionsState = {
  assignments: [],
  onChange: () => undefined,
  save: async () => true,
  dirty: false,
  busy: false,
  canManage: false,
  loading: false,
};

/** The dashboard's permissions from its server, edited as a draft. */
export function useSetupPermissions(
  options: DashboardPermissionsOptions
): PermissionsState {
  const state = useDashboardPermissions(options);
  const [draft, setDraft] = useState<PermissionAssignment[]>([]);
  useEffect(() => {
    setDraft(state.assignments);
  }, [state.assignments, state.editorKey]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.assignments);
  return {
    assignments: draft,
    onChange: setDraft,
    save: async () => (dirty ? state.save(draft) : true),
    dirty,
    busy: state.busy,
    canManage: state.loaded && state.editable,
    loading: !state.loaded && state.error === null,
  };
}
