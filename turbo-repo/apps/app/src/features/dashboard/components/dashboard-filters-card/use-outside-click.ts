import { useEffect } from "react";

export function useOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean,
  extraRef?: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (extraRef?.current?.contains(target)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler, enabled, extraRef]);
}
