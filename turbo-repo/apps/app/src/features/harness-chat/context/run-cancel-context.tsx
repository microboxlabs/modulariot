"use client";

import { useAuiState } from "@assistant-ui/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

interface RunCancelContextValue {
  canceled: boolean;
  markCanceled: () => void;
}

const RunCancelContext = createContext<RunCancelContextValue | null>(null);

/**
 * Tracks "the user explicitly clicked Cancel on the run in flight" —
 * separately from the AG-UI runtime's own message `status`. Relying on
 * `status.reason === "cancelled"` alone is racy: when the composer's Cancel
 * button aborts the run, the runtime dispatches a local RUN_CANCELLED
 * (setting status correctly) *and* the underlying fetch settles a moment
 * later; if that settling doesn't surface as an error on the client (which
 * it often doesn't — our relay just closes the stream quietly on abort,
 * so the fetch "completes" rather than "errors"), the AG-UI client's own
 * finalize-fallback synthesizes a RUN_FINISHED right behind it, silently
 * overwriting "cancelled" back to "complete". This flag sidesteps that
 * race entirely by tracking the click itself, not the runtime's status.
 */
export function RunCancelProvider({ children }: PropsWithChildren) {
  const [canceled, setCanceled] = useState(false);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const wasRunning = useRef(isRunning);

  useEffect(() => {
    // A new run just started — clear any leftover flag from the last one.
    if (isRunning && !wasRunning.current) setCanceled(false);
    wasRunning.current = isRunning;
  }, [isRunning]);

  const value = useMemo<RunCancelContextValue>(
    () => ({ canceled, markCanceled: () => setCanceled(true) }),
    [canceled],
  );

  return <RunCancelContext.Provider value={value}>{children}</RunCancelContext.Provider>;
}

export function useRunCancel(): RunCancelContextValue {
  const ctx = useContext(RunCancelContext);
  if (!ctx) {
    throw new Error("useRunCancel must be used within RunCancelProvider");
  }
  return ctx;
}
