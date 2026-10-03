"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { createDashboardClient } from "../client";
import { DashboardApiError } from "../client/error";
import { isDashboardRole } from "@microboxlabs/miot-dashboard-contract/roles";
import type { PermissionAssignment } from "./permission-assignment-editor";

type Client = Pick<
  ReturnType<typeof createDashboardClient>,
  "key" | "capabilities" | "permissions" | "setPermissions"
>;
export interface DashboardPermissionsOptions {
  readonly client: Client;
  readonly slug: string;
  /** Non-secret host generation, replaced on login/logout or identity changes. */
  readonly sessionKey: string;
  readonly readOnly?: boolean;
}
interface Snapshot {
  assignments: PermissionAssignment[];
  editable: boolean;
  busy: boolean;
  loaded: boolean;
  error: number | null;
}
const EMPTY: Snapshot = {
  assignments: [],
  editable: false,
  busy: false,
  loaded: false,
  error: null,
};
const emptySnapshot = () => EMPTY;
const emptySubscribe = () => () => undefined;

function controller({
  client,
  slug,
  sessionKey,
  readOnly,
}: DashboardPermissionsOptions) {
  let state = EMPTY;
  let destroyed = false;
  let active: AbortController | undefined;
  const listeners = new Set<() => void>();
  function publish(patch: Partial<Snapshot>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }
  async function refresh(signal: AbortSignal) {
    const capabilities = await client.capabilities(slug, signal);
    signal.throwIfAborted();
    if (!capabilities.canManagePermissions) return { ...EMPTY, loaded: true };
    const { assignments } = await client.permissions(slug, signal);
    return { ...EMPTY, assignments, loaded: true, editable: !readOnly };
  }
  async function run(work: (signal: AbortSignal) => Promise<Snapshot>) {
    if (destroyed || active || !sessionKey) return false;
    const operation = new AbortController();
    active = operation;
    publish({ busy: true, error: null });
    try {
      const next = await work(operation.signal);
      if (destroyed || operation.signal.aborted) return false;
      publish(next);
      return true;
    } catch (error) {
      if (!destroyed) {
        const status = error instanceof DashboardApiError ? error.status : 502;
        publish({
          error: status,
          ...(status === 401 || status === 403
            ? { assignments: [], editable: false, loaded: false }
            : {}),
        });
      }
      return false;
    } finally {
      if (!destroyed) publish({ busy: false });
      active = undefined;
    }
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    reload: () => run(refresh),
    save(assignments: readonly PermissionAssignment[]) {
      if (!state.editable || !state.loaded || state.busy || readOnly)
        return Promise.resolve(false);
      const ids = new Set(assignments.map((item) => item.authorityId));
      if (
        ids.size !== assignments.length ||
        assignments.some(
          (item) => !item.authorityId.trim() || !isDashboardRole(item.role),
        )
      )
        return Promise.resolve(false);
      const copy = assignments.map(({ authorityId, role }) => ({
        authorityId,
        role,
      }));
      return run(async (signal) => {
        // Recheck access before replacing the complete list; the server enforces writes too.
        const capabilities = await client.capabilities(slug, signal);
        signal.throwIfAborted();
        if (!capabilities.canManagePermissions)
          throw new DashboardApiError(403);
        await client.setPermissions(slug, copy, signal);
        signal.throwIfAborted();
        return refresh(signal);
      });
    },
    destroy() {
      destroyed = true;
      active?.abort();
      listeners.clear();
    },
  };
}

/** Permission state is isolated by client, resource and session; hosts own the draft. */
export function useDashboardPermissions({
  client,
  slug,
  sessionKey,
  readOnly = false,
}: DashboardPermissionsOptions) {
  const key = JSON.stringify([sessionKey, client.key(slug), readOnly]);
  const [mounted, setMounted] = useState<{
    key: string;
    client: Client;
    value: ReturnType<typeof controller>;
  } | null>(null);
  useEffect(() => {
    const value = controller({ client, slug, sessionKey, readOnly });
    setMounted({ key, client, value });
    void value.reload();
    return () => value.destroy();
  }, [client, slug, sessionKey, readOnly, key]);
  const current =
    mounted?.key === key && mounted.client === client ? mounted.value : null;
  const snapshot = useSyncExternalStore(
    current?.subscribe ?? emptySubscribe,
    current?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  );
  return {
    ...snapshot,
    editable: snapshot.editable && !snapshot.busy,
    editorKey: key,
    reload: () => current?.reload() ?? Promise.resolve(false),
    save: (assignments: readonly PermissionAssignment[]) =>
      current?.save(assignments) ?? Promise.resolve(false),
  };
}
