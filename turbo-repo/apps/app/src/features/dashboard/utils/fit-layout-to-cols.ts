import { verticalCompactor, type Layout } from "react-grid-layout";

/**
 * Fit a grid layout into `cols` columns for responsive VIEW-mode rendering.
 *
 * Widgets wider than `cols` have their width capped and their x repositioned to
 * stay in bounds; the result is vertically compacted (the same algorithm the
 * grid itself uses) to remove any overlaps the clamping introduced. This is
 * display-only — it must never be persisted, so the stored (wide-screen)
 * arrangement is preserved.
 */
export function fitLayoutToCols(layout: Layout, cols: number): Layout {
  const clamped = layout.map((item) => {
    const w = Math.min(item.w, cols);
    const x = Math.max(0, Math.min(item.x, cols - w));
    return { ...item, x, w };
  });
  return verticalCompactor.compact(clamped, cols);
}
