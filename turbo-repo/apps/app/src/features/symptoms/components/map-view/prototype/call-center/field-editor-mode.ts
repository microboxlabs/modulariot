"use client";

/**
 * PROTOTYPE — whether the per-field "which selectable is this bound to" gear
 * (`SelectableFieldControl`) shows at all. Off by default so the forms read
 * clean; a toggle in the panel header turns it on for whoever is configuring
 * the selectables rather than filling out a treatment. Same localStorage +
 * custom-event pattern as `call-debug-mode.ts`.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "miot.prototype.field-editor-mode.v1";
const SYNC_EVENT = "miot:field-editor-mode-changed";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function write(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    // storage unavailable — in-memory state still updates for this tab.
  }
}

export function useFieldEditorMode() {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    setEnabledState(read());
    const sync = () => setEnabledState(read());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    write(value);
  }, []);

  return [enabled, setEnabled] as const;
}
