import type { MediaViewerItem } from "./media-inline-viewer";
import type { ReviewStatus } from "../gallery/media-row";

/** Find the next undecided file index, wrapping around from the end. */
export function findNextUndecided(
  items: MediaViewerItem[],
  currentIndex: number,
  updatedDrafts: Map<string, ReviewStatus>,
  reviewStatuses?: Map<string, ReviewStatus>,
): number | null {
  for (let i = currentIndex + 1; i < items.length; i++) {
    const itemId = items[i]?.file?.entry?.id;
    if (!itemId) continue;
    if (updatedDrafts.has(itemId)) continue;
    if ((reviewStatuses?.get(itemId) ?? "pending") === "approved") continue;
    return i;
  }
  for (let i = 0; i < currentIndex; i++) {
    const itemId = items[i]?.file?.entry?.id;
    if (!itemId) continue;
    if (updatedDrafts.has(itemId)) continue;
    if ((reviewStatuses?.get(itemId) ?? "pending") === "approved") continue;
    return i;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
