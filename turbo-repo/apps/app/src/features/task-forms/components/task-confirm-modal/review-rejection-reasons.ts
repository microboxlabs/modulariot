import type { RejectedItem } from "../task-bento-form/bento-review-context";

/**
 * Rejection codes derived from a per-document review verdict.
 *
 * Moving a service back to the earlier stage used to ask the operator to pick the
 * rejected documents from a list, even though they had just rejected them one by one in
 * the gallery. The list is the same information asked twice, and the two can disagree —
 * so the codes are now read off the verdict instead.
 *
 * The codes themselves still matter downstream: the backend maps them to the document
 * types it reports to the client system, and skips the notification when none survive.
 * Deriving them keeps that payload intact while the modal only shows the summary.
 */
const CONTENT_TYPE_TO_REASON: Readonly<Record<string, string>> = {
  PICKUP_GUIDE_IMAGE: "REJECTED_GUIDE",
  PICKUP_LEFT_IMAGE: "REJECTED_LEFT_SIDE",
  PICKUP_RIGHT_IMAGE: "REJECTED_RIGHT_SIDE",
  PICKUP_FRONT_IMAGE: "REJECTED_FRONT",
  PICKUP_REAR_IMAGE: "REJECTED_BACK",
};

/**
 * The rejection codes for a set of reviewed items, deduplicated and in the order the
 * documents were reviewed.
 *
 * Content types absent from the map — the delivery and load proofs — yield nothing on
 * purpose: the backend excludes them from this rejection anyway, so emitting a code for
 * them would claim a rejection it will not act on. An item whose type never loaded is
 * skipped for the same reason; guessing from the file name would be worse than silence.
 */
export function rejectionReasonsFrom(items: readonly RejectedItem[]): string[] {
  const reasons = new Set<string>();
  for (const item of items) {
    const reason = item.contentType
      ? CONTENT_TYPE_TO_REASON[item.contentType]
      : undefined;
    if (reason) reasons.add(reason);
  }
  return [...reasons];
}
