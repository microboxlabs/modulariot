import { useEffect } from "react";

export function useOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler, enabled]);
}
