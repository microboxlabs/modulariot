import { useEffect, useRef } from "react";

export interface DashboardAutosaveOptions {
  /** Anything that changes on every edit; each change restarts the delay. */
  config: unknown;
  dirty: boolean;
  busy: boolean;
  /** A failed save stops autosaving until the host clears it (e.g. by reloading). */
  error: unknown;
  save: () => Promise<boolean>;
  enabled: boolean;
  delayMs?: number;
}

/** Saves a dirty document once edits pause, like the legacy dashboard page. */
export function useDashboardAutosave({
  config,
  dirty,
  busy,
  error,
  save,
  enabled,
  delayMs = 1500,
}: DashboardAutosaveOptions) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const blocked = error !== null && error !== undefined;
  useEffect(() => {
    if (!enabled || !dirty || busy || blocked) return;
    const timer = setTimeout(() => void saveRef.current(), delayMs);
    return () => clearTimeout(timer);
  }, [config, dirty, busy, blocked, enabled, delayMs]);
}
