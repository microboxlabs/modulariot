"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Stabilize a snapshot into a JSON string for comparison.
 * Returns an empty string for undefined/null to handle initial states gracefully.
 */
function toStableJson(value: unknown): string {
  if (value === undefined || value === null) return "";
  return JSON.stringify(value);
}

/**
 * Compares the current form state against the baseline captured when
 * `isOpen` last transitioned to `true`. Returns `true` when they differ.
 *
 * Pass a plain object with all form fields — no `useMemo` needed.
 * The hook serializes via `JSON.stringify` every render, which is
 * negligible for a settings panel.
 *
 * Uses a two-phase settling strategy so that state-reset `useEffect`s
 * in the dashlet can flush before the baseline is captured.
 *
 * Usage:
 * ```ts
 * const isDirty = useSettingsDirty(isOpen, { title, value, color });
 * ```
 */
export function useSettingsDirty(
  isOpen: boolean,
  currentSnapshot: unknown
): boolean {
  const currentJson = toStableJson(currentSnapshot);

  const baselineRef = useRef(currentJson);
  const wasOpenRef = useRef(isOpen);
  const [settling, setSettling] = useState(false);

  // Detect the render where isOpen just flipped to true (effects not yet run)
  const opening = isOpen && !wasOpenRef.current;

  // Phase 1: when the drawer opens, enter settling mode.
  useEffect(() => {
    if (isOpen) {
      setSettling(true);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Phase 2: on the NEXT render (after state-resets have flushed),
  // capture the baseline and exit settling mode.
  useEffect(() => {
    if (settling) {
      baselineRef.current = currentJson;
      setSettling(false);
    }
  }, [settling, currentJson]);

  return isOpen && !settling && !opening && baselineRef.current !== currentJson;
}
