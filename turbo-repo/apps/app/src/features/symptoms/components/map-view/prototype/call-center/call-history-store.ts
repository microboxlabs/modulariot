"use client";

/**
 * PROTOTYPE — real (not mocked) last-call timestamp per contact id.
 * Persisted so the "a quién llamar" list still shows a completed call as
 * recent (green, sorted last) after the flow's own component tree unmounts —
 * e.g. after "Finalizar Tratamiento" navigates away, or a page reload —
 * instead of only lasting for that one in-memory flow instance. Same
 * localStorage + custom-event pattern as `call-roles-store.ts`.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "miot.prototype.call-history.v1";
const SYNC_EVENT = "miot:call-history-changed";

/** ISO date strings on disk — `Date` isn't JSON-serializable as itself. */
type StoredCallHistory = Record<string, string>;

function read(): StoredCallHistory {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredCallHistory;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function write(next: StoredCallHistory): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    // storage unavailable (private mode, quota) — in-memory state still updates.
  }
}

export function useCallHistory() {
  const [history, setHistory] = useState<Record<string, Date>>({});

  const toDates = (stored: StoredCallHistory): Record<string, Date> =>
    Object.fromEntries(
      Object.entries(stored).map(([id, iso]) => [id, new Date(iso)])
    );

  useEffect(() => {
    setHistory(toDates(read()));
    const sync = () => setHistory(toDates(read()));
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const recordCall = useCallback((contactId: string) => {
    const now = new Date();
    const next = { ...read(), [contactId]: now.toISOString() };
    write(next);
    setHistory((prev) => ({ ...prev, [contactId]: now }));
  }, []);

  return { history, recordCall };
}
