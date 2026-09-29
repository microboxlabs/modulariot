import { GRID_COLS, DESIGN_WIDTH, MAX_SCALE } from "../types/dashboard.types";

export interface GridSizing {
  /** Column count handed to react-grid-layout this render. */
  cols: number;
  /** Pixel width the grid is rendered at before scaling (cols × column width). */
  designWidth: number;
  /** CSS transform scale applied to the rendered grid. */
  scale: number;
  /** Left margin (px) that centers the grid when scale is clamped / content is narrow. */
  offsetLeft: number;
}

/**
 * Sizing for the dashboard root grid.
 *
 * Renders at `min(content span, columns that fit the screen)` (min `GRID_COLS`)
 * and scales to fill, clamped to `MAX_SCALE`. When content is wider than the
 * screen this yields fewer columns than the content uses, so the caller clamps
 * over-wide widgets to fit rather than shrinking the whole board.
 *
 * Used identically in edit and view mode so the board renders the same
 * regardless of mode — only whether widgets are draggable/resizable differs.
 *
 * Column pixel size stays constant across counts. Nothing here is persisted —
 * widget positions remain stored in absolute column units (min `GRID_COLS`).
 */
export function computeGridSizing({
  containerWidth,
  usedCols,
}: {
  containerWidth: number;
  /** Raw max(x + w) across widgets; floored at GRID_COLS here. */
  usedCols: number;
}): GridSizing {
  const used = Math.max(GRID_COLS, usedCols);

  if (containerWidth <= 0) {
    return {
      cols: used,
      designWidth: (used * DESIGN_WIDTH) / GRID_COLS,
      scale: 1,
      offsetLeft: 0,
    };
  }

  // Integer-friendly to avoid float drift on the floor.
  const fitCols = Math.floor((containerWidth * GRID_COLS) / DESIGN_WIDTH);
  // Render at min(content span, what fits the screen) so content wider than
  // the screen clamps to fit (handled by the caller) instead of shrinking the
  // whole board; content that fits still fills/zooms normally.
  const cols = Math.max(GRID_COLS, Math.min(used, fitCols));
  const designWidth = (cols * DESIGN_WIDTH) / GRID_COLS;
  const scale = Math.min(MAX_SCALE, containerWidth / designWidth);
  const offsetLeft = Math.max(0, (containerWidth - designWidth * scale) / 2);

  return { cols, designWidth, scale, offsetLeft };
}
