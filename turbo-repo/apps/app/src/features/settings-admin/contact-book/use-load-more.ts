"use client";

import { useEffect, useRef } from "react";

/**
 * Infinite scroll: calls `onMore` while `enabled` and the returned sentinel is in view. Each new `onMore` observes
 * again, so a page that leaves the sentinel visible asks for the next one.
 */
export function useLoadMore(onMore: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !enabled || globalThis.IntersectionObserver === undefined)
      return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onMore, enabled]);

  return sentinelRef;
}
