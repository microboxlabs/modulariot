import { useEffect, useRef } from "react";

/**
 * Calls `callback` every `intervalMs` milliseconds.
 * Pauses automatically when the browser tab is hidden and resumes when visible.
 * Does nothing when `intervalMs` is 0 or negative.
 */
export function usePollingInterval(
  callback: () => void,
  intervalMs: number,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (intervalMs <= 0) return;

    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (id === null) {
        id = setInterval(() => callbackRef.current(), intervalMs);
      }
    };

    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        // Fire immediately on return, then resume interval
        callbackRef.current();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);
}
