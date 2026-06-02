import type { ReviewStatus } from "../gallery/media-row";

export const STATUS_BADGE_CLASSES: Record<ReviewStatus, string> = {
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export const DRAFT_BADGE_CLASSES: Record<string, string> = {
  approved: "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  pending: "border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  rejected: "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
};

export const DRAFT_BADGE_KEYS: Record<string, string> = {
  approved: "bento.multimedia.draft_will_approve",
  pending: "bento.multimedia.draft_will_review",
  rejected: "bento.multimedia.draft_will_reject",
};
