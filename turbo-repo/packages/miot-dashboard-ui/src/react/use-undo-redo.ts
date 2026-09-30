"use client";

import { useCallback, useRef } from "react";
import type { DashboardStorageSchema } from "@microboxlabs/miot-dashboard-contract/document";

const MAX_HISTORY = 50;

/** Group consecutive edits, but start a new history branch after undo/redo. */
const BATCH_WINDOW_MS = 500;

/**
 * Snapshot-based undo/redo history for dashboard state.
 *
 * Wraps a `saveData` callback so that every mutation automatically
 * pushes the *previous* state onto the undo stack.
 */
export function useUndoRedo(
  getCurrentConfig: () => DashboardStorageSchema,
  saveData: (data: DashboardStorageSchema) => void,
  readOnly = false,
) {
  const undoStackRef = useRef<DashboardStorageSchema[]>([]);
  const redoStackRef = useRef<DashboardStorageSchema[]>([]);
  // Timestamp of the last snapshot push — used for batching normal mutations
  const lastPushTimeRef = useRef(Number.NEGATIVE_INFINITY);
  /** Push current state to undo stack before a mutation */
  const pushSnapshot = useCallback(() => {
    const now = Date.now();

    if (now - lastPushTimeRef.current > BATCH_WINDOW_MS) {
      // Outside batch window → new undo entry
      const current = getCurrentConfig();
      const stack = undoStackRef.current;
      stack.push(current);
      if (stack.length > MAX_HISTORY) {
        stack.shift();
      }
      lastPushTimeRef.current = now;
    }
    // Inside batch window of a previous user mutation → skip push; the
    // snapshot already on the stack is the correct "before" state.

    if (redoStackRef.current.length > 0) {
      redoStackRef.current = [];
    }
  }, [getCurrentConfig]);

  /** Wrapped saveData that records history */
  const saveDataWithHistory = useCallback(
    (data: DashboardStorageSchema) => {
      if (readOnly) return;
      pushSnapshot();
      saveData(data);
    },
    [pushSnapshot, saveData, readOnly],
  );

  const undo = useCallback(() => {
    if (readOnly) return;
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const previous = stack.pop()!;
    redoStackRef.current.push(getCurrentConfig());
    lastPushTimeRef.current = Number.NEGATIVE_INFINITY;
    saveData(previous);
  }, [getCurrentConfig, saveData, readOnly]);

  const redo = useCallback(() => {
    if (readOnly) return;
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    const next = stack.pop()!;
    undoStackRef.current.push(getCurrentConfig());
    lastPushTimeRef.current = Number.NEGATIVE_INFINITY;
    saveData(next);
  }, [getCurrentConfig, saveData, readOnly]);

  const canUndo = useCallback(
    () => !readOnly && undoStackRef.current.length > 0,
    [readOnly],
  );
  const canRedo = useCallback(
    () => !readOnly && redoStackRef.current.length > 0,
    [readOnly],
  );

  /** Clear all history (e.g. on import) */
  const clearHistory = useCallback(() => {
    if (readOnly) return;
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastPushTimeRef.current = Number.NEGATIVE_INFINITY;
  }, [readOnly]);

  return {
    saveDataWithHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}
