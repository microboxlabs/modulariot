"use client";

/**
 * The explorer's client-only state: which folders are open, and the items
 * being named before they exist on the server (temporary folders and
 * drafts). Module level so the desktop and mobile panels share it and it
 * survives switching sections. Folders and dashboards themselves come from
 * the server (see use-explorer-server.ts) and are merged in by the panel.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { ExplorerLayout } from "./explorer-tree.types";
import { EMPTY_LAYOUT } from "./explorer-tree";

let layout: ExplorerLayout = EMPTY_LAYOUT;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ExplorerLayout {
  return layout;
}

function setLayout(next: ExplorerLayout): void {
  if (next === layout) return;
  layout = next;
  for (const listener of listeners) listener();
}

/** The current state, for a handler that runs after a synchronous update. */
export function readExplorerLayout(): ExplorerLayout {
  return layout;
}

/** Test helper: back to an empty layout. */
export function resetExplorerLayout(): void {
  setLayout(EMPTY_LAYOUT);
}

export function useExplorerLayout(): readonly [
  ExplorerLayout,
  (update: (current: ExplorerLayout) => ExplorerLayout) => void,
] {
  useEffect(() => () => setLayout({ ...layout, folders: {}, drafts: {} }), []);
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const update = useCallback(
    (fn: (current: ExplorerLayout) => ExplorerLayout) => setLayout(fn(layout)),
    []
  );
  return [current, update] as const;
}
