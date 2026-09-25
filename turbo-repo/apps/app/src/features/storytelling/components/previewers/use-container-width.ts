import { useCallback, useEffect, useState } from "react";

/** Tracks an element's own content-box width so a canvas (or anything else
 * sized off its container) can be scaled to exactly fill it —
 * ResizeObserver's contentRect already excludes padding, so this is the
 * true space available to a `w-full` child.
 *
 * Uses a callback ref rather than `useRef` + a `[]`-deps effect: the PDF
 * previewer's rail only enters the DOM once the document has finished
 * loading (a later render, not the first), so a one-shot effect that reads
 * `ref.current` on mount would find it still null and never attach the
 * observer at all — the callback ref fires exactly when the node actually
 * appears (or disappears), whenever that happens to be. */
export function useContainerWidth<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  const ref = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref, width };
}
