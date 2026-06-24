"use client";

import { useState, useEffect, useMemo, useRef, useCallback, type MutableRefObject } from "react";
import type { SpotlightItem } from "./types";

const RECENT_STORAGE_KEY = "spotlight_recent_v2";

function loadRecentIds(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function saveRecentIds(ids: string[]) {
  try { localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids)); }
  catch { /* localStorage unavailable */ }
}

interface UseSpotlightStateOptions {
  /**
   * Full navigate item registry — used only for recent-item lookup.
   * Navigate items are the only kind persisted in recents (harness results
   * are dynamic and can't be resolved from a stored id).
   */
  navigateItems: SpotlightItem[];
  /**
   * Ref kept current by the parent (updated synchronously during render).
   * The keyboard handler reads this so ArrowDown knows the upper bound.
   */
  selectableCountRef: MutableRefObject<number>;
  /** Called with the current selectedIndex when Enter is pressed. */
  onEnterSelect: (index: number) => void;
}

export interface UseSpotlightStateReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  query: string;
  setQuery: (q: string) => void;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  recentItems: SpotlightItem[];
  addRecentItem: (item: SpotlightItem) => void;
}

/**
 * Core state machine for the spotlight overlay.
 *
 * Keyboard wiring: ⌘K/Ctrl+K toggle, Esc close, ↑↓ navigate list, Enter execute.
 * All trigger/badge/section-filter logic from the previous version is removed.
 */
export function useSpotlightState({
  navigateItems,
  selectableCountRef,
  onEnterSelect,
}: UseSpotlightStateOptions): UseSpotlightStateReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const isOpenRef = useRef(isOpen);
  const selectedIndexRef = useRef(selectedIndex);
  const onEnterSelectRef = useRef(onEnterSelect);
  isOpenRef.current = isOpen;
  selectedIndexRef.current = selectedIndex;
  onEnterSelectRef.current = onEnterSelect;

  const open = useCallback(() => {
    setQuery("");
    setSelectedIndex(-1);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(-1);
  }, []);

  useEffect(() => { setRecentIds(loadRecentIds()); }, []);

  const addRecentItem = useCallback((item: SpotlightItem) => {
    setRecentIds((prev) => {
      const next = [item.id, ...prev.filter((id) => id !== item.id)].slice(0, 5);
      saveRecentIds(next);
      return next;
    });
  }, []);

  const recentItems = useMemo(
    () =>
      recentIds
        .map((id) => navigateItems.find((a) => a.id === id))
        .filter(Boolean) as SpotlightItem[],
    [recentIds, navigateItems],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpenRef.current) close(); else open();
        return;
      }
      if (!isOpenRef.current) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((p) => Math.min(p + 1, selectableCountRef.current - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((p) => Math.max(p - 1, -1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onEnterSelectRef.current(selectedIndexRef.current);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // open/close captured via stable callbacks — intentional omission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isOpen, open, close,
    query, setQuery,
    selectedIndex, setSelectedIndex,
    recentItems, addRecentItem,
  };
}
