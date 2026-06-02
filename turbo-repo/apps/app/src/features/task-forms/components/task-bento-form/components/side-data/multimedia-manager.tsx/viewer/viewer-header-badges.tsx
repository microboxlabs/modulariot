"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import CustomBadge from "@/features/common/components/custom-badge/custom-badge";
import { STATUS_BADGE_CLASSES, DRAFT_BADGE_CLASSES, DRAFT_BADGE_KEYS } from "./viewer-constants";
import type { ReviewStatus } from "../gallery/media-row";
import { AlfrescoFileEntry } from "../image.types";

/**
 * Desktop header metadata badges for the inline viewer: modified date/user plus the
 * review status (or a neutral "not subject to review" chip for non-reviewable content).
 */
export default function ViewerHeaderBadges({
  entry,
  status,
  draftDecision,
  isReviewable,
  dictionary,
}: Readonly<{
  entry: AlfrescoFileEntry["entry"];
  status: ReviewStatus;
  draftDecision: ReviewStatus | null;
  isReviewable: boolean;
  dictionary: I18nRecord;
}>) {
  return (
    <>
      {entry.modifiedAt && (
        <CustomBadge
          text={formatDateString(entry.modifiedAt)}
          className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 shrink-0 hidden md:inline-flex"
        />
      )}
      {entry.modifiedByUser?.id && (
        <CustomBadge
          text={entry.modifiedByUser.id}
          className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 shrink-0 hidden md:inline-flex"
        />
      )}
      {isReviewable ? (
        <>
          <CustomBadge
            text={tr(`bento.multimedia.status_${status}`, dictionary)}
            className={`px-2 py-0.5 shrink-0 hidden sm:inline-flex ${STATUS_BADGE_CLASSES[status]}`}
          />
          {draftDecision !== null && (
            <CustomBadge
              text={`→ ${tr(DRAFT_BADGE_KEYS[draftDecision] ?? DRAFT_BADGE_KEYS.rejected, dictionary)}`}
              className={`px-2 py-0.5 shrink-0 border hidden sm:inline-flex ${
                DRAFT_BADGE_CLASSES[draftDecision] ?? DRAFT_BADGE_CLASSES.rejected
              }`}
            />
          )}
        </>
      ) : (
        <CustomBadge
          text={tr("bento.multimedia.not_reviewable", dictionary)}
          className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 shrink-0 hidden sm:inline-flex"
        />
      )}
    </>
  );
}
