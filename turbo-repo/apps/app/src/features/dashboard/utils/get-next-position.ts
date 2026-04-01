import { GRID_COLS, type Widget } from "../types/dashboard.types";

/**
 * Calculate the next available grid position among siblings.
 * Tries to fit in the last row; if no space, starts a new row.
 */
export function getNextPosition(
  siblings: Widget[],
  width: number = 1
): { x: number; y: number } {
  if (siblings.length === 0) {
    return { x: 0, y: 0 };
  }

  let maxBottom = 0;
  for (const widget of siblings) {
    const bottom = widget.layout.y + widget.layout.h;
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  }

  const lastRowY = maxBottom - 1;
  const widgetsInLastRow = siblings.filter(
    (w) => w.layout.y <= lastRowY && w.layout.y + w.layout.h > lastRowY
  );

  let usedColumns = 0;
  for (const w of widgetsInLastRow) {
    usedColumns = Math.max(usedColumns, w.layout.x + w.layout.w);
  }

  if (usedColumns + width <= GRID_COLS) {
    return { x: usedColumns, y: lastRowY };
  }

  return { x: 0, y: maxBottom };
}
