"use client";

import { useCallback, useRef } from "react";
import type { DashboardStorageSchema } from "../types/dashboard.types";

const MAX_HISTORY = 50;

/**
 * Batch window in ms. Mutations within this window of each other are treated
 * as a single undoable action. This prevents react-grid-layout's automatic
 * `onLayoutChange` (which fires right after add/remove/undo/redo) from
 * creating a separate undo entry or clearing the redo stack.
 */
const BATCH_WINDOW_MS = 500;

/**
 * Snapshot-based undo/redo history for dashboard state.
 *
 * Wraps a `saveData` callback so that every mutation automatically
 * pushes the *previous* state onto the undo stack.
 */
export function useUndoRedo(
  getCurrentConfig: () => DashboardStorageSchema,
  saveData: (data: DashboardStorageSchema) => void
) {
  const undoStackRef = useRef<DashboardStorageSchema[]>([]);
  const redoStackRef = useRef<DashboardStorageSchema[]>([]);
  // Timestamp of the last snapshot push — used for batching normal mutations
  const lastPushTimeRef = useRef(0);
  // Timestamp of the last undo/redo — side-effect mutations within the batch
  // window after an undo/redo are silently ignored (no snapshot, no redo clear).
  const lastUndoRedoTimeRef = useRef(0);

  /** Push current state to undo stack before a mutation */
  const pushSnapshot = useCallback(() => {
    const now = Date.now();

    // If we're within the batch window of an undo/redo, this mutation is a
    // side-effect (e.g. onLayoutChange). Ignore it completely — don't push
    // a snapshot and don't clear the redo stack.
    if (now - lastUndoRedoTimeRef.current <= BATCH_WINDOW_MS) {
      return;
    }

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
      pushSnapshot();
      saveData(data);
    },
    [pushSnapshot, saveData]
  );

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const previous = stack.pop()!;
    redoStackRef.current.push(getCurrentConfig());
    lastUndoRedoTimeRef.current = Date.now();
    saveData(previous);
  }, [getCurrentConfig, saveData]);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    const next = stack.pop()!;
    undoStackRef.current.push(getCurrentConfig());
    lastUndoRedoTimeRef.current = Date.now();
    saveData(next);
  }, [getCurrentConfig, saveData]);

  const canUndo = useCallback(() => undoStackRef.current.length > 0, []);
  const canRedo = useCallback(() => redoStackRef.current.length > 0, []);

  /** Clear all history (e.g. on import) */
  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastPushTimeRef.current = 0;
    lastUndoRedoTimeRef.current = 0;
  }, []);

  return {
    saveDataWithHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}
