"use client";

import { useEffect, useRef } from "react";

/**
 * Scrolls the returned ref's element into view whenever `active` flips to true.
 *
 * Exists for the search navigator: stepping to the next match moves the
 * calendar to the match's date, but the chip can still land outside the
 * scrolled viewport of a tall day/week grid — so the highlight would be
 * correct and invisible at once.
 *
 * Only fires on the false→true edge, so re-renders while a chip stays focused
 * don't yank the grid back and fight a user who has scrolled away.
 */
export function useScrollIntoViewWhen<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active && !wasActive.current) {
      ref.current?.scrollIntoView({ block: "center", inline: "nearest" });
    }
    wasActive.current = active;
  }, [active]);

  return ref;
}
