import { AlfrescoFileEntry } from "./image.types";

/**
 * Aspect the backend (ContentReviewableBehavior) applies to content that must be
 * reviewed. Only content whose mintral:contentType is in a server-side allowlist
 * receives it; non-reviewable content has no review status at all.
 */
export const REVIEWABLE_ASPECT = "mintral:reviewableAspect";

/**
 * A content item is reviewable iff the backend tagged it with the reviewable aspect.
 * The allowlist of reviewable content types lives server-side and is intentionally
 * NOT replicated here — the FE only reads the resulting aspect.
 *
 * This is the single place the aspect QName is referenced.
 */
export function isReviewableEntry(entry: AlfrescoFileEntry): boolean {
  return entry.entry.aspectNames?.includes(REVIEWABLE_ASPECT) ?? false;
}
