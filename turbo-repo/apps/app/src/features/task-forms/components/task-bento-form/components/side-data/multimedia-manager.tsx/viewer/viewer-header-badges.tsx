"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import CustomBadge from "@/features/common/components/custom-badge/custom-badge";
import { STATUS_BADGE_CLASSES, DRAFT_BADGE_CLASSES, DRAFT_BADGE_KEYS } from "./viewer-constants";
import type { ReviewStatus } from "../gallery/media-row";
import { AlfrescoFileEntry } from "../image.types";

const muted = "text-xs text-gray-400 dark:text-gray-500 shrink-0";
const valueBadgeCls = "text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 shrink-0";

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
  const byWord = tr("bento.multimedia.row_by_lower", dictionary);
  const onWord = tr("bento.multimedia.row_on", dictionary);

  const reviewedAt = entry.properties?.["mintral:reviewedAt"];
  const reviewedBy = entry.properties?.["mintral:reviewedBy"];
  const modifiedAt = entry.modifiedAt;
  const modifiedBy = entry.modifiedByUser?.displayName;

  const isReviewRecent =
    status !== "pending" &&
    reviewedAt &&
    reviewedBy &&
    new Date(reviewedAt).getTime() >= new Date(modifiedAt ?? 0).getTime();

  const eventLabel = isReviewRecent
    ? tr(`bento.multimedia.status_${status}`, dictionary)
    : tr("bento.multimedia.sidebar_history_modification", dictionary);
  const eventLabelCls = isReviewRecent
    ? `${STATUS_BADGE_CLASSES[status]} px-1.5 py-0.5 shrink-0`
    : `${valueBadgeCls}`;
  const eventBy = isReviewRecent ? reviewedBy : modifiedBy;
  const reviewedAtFormatted = reviewedAt ? formatDateString(reviewedAt) : null;
  const modifiedAtFormatted = modifiedAt ? formatDateString(modifiedAt) : null;
  const eventAt = isReviewRecent ? reviewedAtFormatted : modifiedAtFormatted;

  return (
    <>
      {/* Last event: approval/rejection or modification */}
      {(eventBy || eventAt) && (
        <span className="hidden md:inline-flex items-center gap-1 shrink-0">
          <CustomBadge text={eventLabel} className={eventLabelCls} />
          {eventBy && (
            <>
              <span className={muted}>{byWord}</span>
              <CustomBadge text={eventBy} className={valueBadgeCls} />
            </>
          )}
          {eventAt && (
            <>
              <span className={muted}>{onWord}</span>
              <CustomBadge text={eventAt} className={valueBadgeCls} />
            </>
          )}
        </span>
      )}

      {/* Status */}
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
