"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Infinite-scroll paging for a client-side list: starts with `step` items
 * and adds `step` more each time the returned sentinel scrolls into view.
 * Without IntersectionObserver (old browsers, jsdom) everything is shown.
 */
export function useIncrementalCount(total: number, step = 10) {
  const [count, setCount] = useState(step);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const supported = globalThis.IntersectionObserver !== undefined;
  const hasMore = supported && count < total;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setCount((c) => c + step);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, step, count]);

  return { visible: supported ? Math.min(count, total) : total, hasMore, sentinelRef };
}
