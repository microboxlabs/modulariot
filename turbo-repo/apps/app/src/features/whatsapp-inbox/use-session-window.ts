"use client";

import { useEffect, useState } from "react";
import { windowState, type WindowState } from "./session-window";

const TICK_MS = 30_000;

/**
 * Live 24h-session state, recomputed on mount and every 30s. Returns {@code null} until mounted so
 * the server and first client render agree on this time-based value (no hydration mismatch); callers
 * treat {@code null} as "not yet known".
 */
export function useSessionWindow(sessionExpiresAt: string | null): WindowState | null {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  return nowMs === null ? null : windowState(sessionExpiresAt, nowMs);
}
