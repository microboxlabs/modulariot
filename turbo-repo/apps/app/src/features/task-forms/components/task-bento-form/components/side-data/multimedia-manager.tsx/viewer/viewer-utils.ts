import type { MediaViewerItem } from "./media-inline-viewer";
import type { ReviewStatus } from "../gallery/media-row";

/**
 * Find the next file still awaiting a decision, wrapping around from the end.
 *
 * <p>Undecided means <b>pending</b> — rejecting is a decision just as much as
 * approving. Treating only "approved" as decided made every rejected file a
 * permanent stop on the carousel: it was re-offered as if untouched, and once
 * every file was decided the search still found the rejected ones, so this never
 * returned null and the viewer never closed.
 */
export function findNextUndecided(
  items: MediaViewerItem[],
  currentIndex: number,
  updatedDrafts: Map<string, ReviewStatus>,
  reviewStatuses?: Map<string, ReviewStatus>,
): number | null {
  const isPending = (itemId: string) =>
    !updatedDrafts.has(itemId) && (reviewStatuses?.get(itemId) ?? "pending") === "pending";

  for (let i = currentIndex + 1; i < items.length; i++) {
    const itemId = items[i]?.file?.entry?.id;
    if (itemId && isPending(itemId)) return i;
  }
  for (let i = 0; i < currentIndex; i++) {
    const itemId = items[i]?.file?.entry?.id;
    if (itemId && isPending(itemId)) return i;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
