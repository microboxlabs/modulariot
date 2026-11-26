"use client";

/**
 * Where the explorer is and how it shows it, both kept in the URL so a
 * reload, a shared link and the browser's back button all agree: the open
 * folder (`?folder=<id>`) and the list or card view (`?view=cards`). The
 * view is also remembered per browser, for a link that names none.
 */
import { useCallback, useReducer, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

export type ExplorerViewMode = "list" | "cards";

/** The search parameter that holds the open folder. */
/** A reducer that only counts: dispatching it renders the component again. */
function countUp(count: number): number {
  return count + 1;
}

export const FOLDER_PARAM = "folder";
/** The search parameter that holds the view, "list" or "cards". */
export const VIEW_PARAM = "view";

const VIEW_KEY = "miot.dashboards.explorer.view";
const DEFAULT_VIEW: ExplorerViewMode = "list";

let viewCache: ExplorerViewMode | null = null;
const viewListeners = new Set<() => void>();

function readView(): ExplorerViewMode {
  if (viewCache) return viewCache;
  try {
    const stored = globalThis.localStorage?.getItem(VIEW_KEY);
    viewCache = stored === "cards" ? "cards" : DEFAULT_VIEW;
  } catch {
    viewCache = DEFAULT_VIEW;
  }
  return viewCache;
}

function writeView(next: ExplorerViewMode): void {
  viewCache = next;
  try {
    globalThis.localStorage?.setItem(VIEW_KEY, next);
  } catch {
    // Not remembered, but still applied for this visit.
  }
  for (const listener of viewListeners) listener();
}

function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  return () => viewListeners.delete(listener);
}

/** For tests: forget the view the previous test chose. */
export function resetExplorerView(): void {
  viewCache = null;
  try {
    globalThis.localStorage?.removeItem(VIEW_KEY);
  } catch {
    // Nothing stored to forget.
  }
}

function viewOf(value: string | null | undefined): ExplorerViewMode | null {
  return value === "cards" || value === "list" ? value : null;
}

/** Sets or removes one search parameter in place, keeping the others. */
function writeParam(
  name: string,
  value: string | null,
  how: "push" | "replace"
): void {
  const params = new URLSearchParams(globalThis.location.search);
  if (value === null) params.delete(name);
  else params.set(name, value);
  const query = params.toString();
  const url = query ? `?${query}` : globalThis.location.pathname;
  if (how === "push") globalThis.history.pushState(null, "", url);
  else globalThis.history.replaceState(null, "", url);
}

/**
 * The view the URL names, else the one this browser last chose. Switching
 * replaces the URL rather than adding a step: the back button goes to the
 * previous folder, not the previous view.
 */
export function useExplorerViewMode(): [
  ExplorerViewMode,
  (next: ExplorerViewMode) => void,
] {
  const searchParams = useSearchParams();
  const remembered = useSyncExternalStore(
    subscribeView,
    readView,
    () => DEFAULT_VIEW
  );
  const view = viewOf(searchParams?.get(VIEW_PARAM)) ?? remembered;
  // Renders again at once, wherever the URL update lands a moment later.
  const [, rerender] = useReducer(countUp, 0);
  const setView = useCallback((next: ExplorerViewMode) => {
    writeParam(VIEW_PARAM, next, "replace");
    writeView(next);
    rerender();
  }, []);
  return [view, setView];
}

/**
 * The open folder (null for the top level) and a way to open another.
 * Written with `history.pushState`, not the router: the router would fetch
 * and render the page again on the server for every folder, and each folder
 * is a step the back button should undo. Next.js keeps `useSearchParams` in
 * step with the native call.
 */
export function useOpenFolder(): [string | null, (id: string | null) => void] {
  const searchParams = useSearchParams();
  const folderId = searchParams?.get(FOLDER_PARAM) || null;
  // Renders again at once, wherever the URL update lands a moment later.
  const [, rerender] = useReducer(countUp, 0);
  const open = useCallback((id: string | null) => {
    writeParam(FOLDER_PARAM, id, "push");
    rerender();
  }, []);
  return [folderId, open];
}
