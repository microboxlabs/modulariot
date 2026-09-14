"use client";

/**
 * PROTOTYPE — which Selectable backs which form field.
 *
 * A form field (e.g. "who_to_call") is identified by a stable `fieldKey`.
 * This maps each field key to the id of the Selectable currently assigned to
 * it, so a form's picker can be re-pointed at a different (or newly created)
 * list without touching the form's own code. Same persistence pattern as
 * `store.ts`: one localStorage key, synced via a custom event + `storage`.
 *
 * When a field has no explicit binding yet, it falls back to a Selectable
 * whose id equals the field key — that's how the seeded defaults in
 * `store.ts` (ids like "who_to_call") show up pre-wired without the user
 * having to pick anything.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "miot.prototype.selectable-field-bindings.v1";
const SYNC_EVENT = "miot:selectable-field-bindings-changed";

type Bindings = Record<string, string>;

function read(): Bindings {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Bindings;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(next: Bindings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    // storage unavailable — in-memory state still updates for this tab.
  }
}

/** Returns the selectable id bound to `fieldKey` (falls back to `fieldKey`
 *  itself) and a setter that persists a new binding. */
export function useFieldSelectableBinding(
  fieldKey: string
): readonly [string, (selectableId: string) => void] {
  const [bindings, setBindings] = useState<Bindings>({});

  useEffect(() => {
    setBindings(read());
    const sync = () => setBindings(read());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setBoundId = useCallback(
    (selectableId: string) => {
      const next = { ...read(), [fieldKey]: selectableId };
      setBindings(next);
      write(next);
    },
    [fieldKey]
  );

  return [bindings[fieldKey] ?? fieldKey, setBoundId] as const;
}
