/**
 * Multi-selection rules, file-manager style: a plain click selects
 * one item, Ctrl/⌘-click adds or removes one, Shift-click selects the range
 * from the last plain or Ctrl/⌘-clicked item.
 */

export type SelectMode = "single" | "toggle" | "range";

export interface ExplorerSelection {
  ids: string[];
  /** Where a Shift-click range starts. */
  anchorId: string | null;
}

export const EMPTY_SELECTION: ExplorerSelection = { ids: [], anchorId: null };

export function selectModeOf(event: {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}): SelectMode {
  if (event.shiftKey) return "range";
  if (event.metaKey || event.ctrlKey) return "toggle";
  return "single";
}

function rangeBetween(order: readonly string[], from: string, to: string) {
  const start = order.indexOf(from);
  const end = order.indexOf(to);
  if (start === -1 || end === -1) return [to];
  return order.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/** The selection after clicking `id`; `order` is the rows as drawn. */
export function nextSelection(
  current: ExplorerSelection,
  id: string,
  mode: SelectMode,
  order: readonly string[]
): ExplorerSelection {
  if (mode === "range") {
    const anchorId = current.anchorId ?? id;
    return { ids: rangeBetween(order, anchorId, id), anchorId };
  }
  if (mode === "toggle") {
    const ids = current.ids.includes(id)
      ? current.ids.filter((selected) => selected !== id)
      : [...current.ids, id];
    return { ids, anchorId: id };
  }
  return { ids: [id], anchorId: id };
}
