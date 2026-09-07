/**
 * Window-global pointer position, shared by every orb so their eyes can track
 * the cursor without each one wiring its own listener. `nx`/`ny` are
 * normalised to -1..1 across the viewport (y already flipped for three.js:
 * +1 is up).
 */
export const pointer = { nx: 0, ny: 0, seen: false };

let refCount = 0;
let onMove: ((e: PointerEvent) => void) | null = null;

/** Ref-counted so the last orb to unmount removes the listener. */
export function acquirePointerTracking(): () => void {
  if (typeof window === "undefined") return () => {};
  if (refCount === 0) {
    onMove = (e: PointerEvent) => {
      pointer.nx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ny = -((e.clientY / window.innerHeight) * 2 - 1);
      pointer.seen = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
  }
  refCount += 1;
  return () => {
    refCount -= 1;
    if (refCount === 0 && onMove) {
      window.removeEventListener("pointermove", onMove);
      onMove = null;
    }
  };
}
