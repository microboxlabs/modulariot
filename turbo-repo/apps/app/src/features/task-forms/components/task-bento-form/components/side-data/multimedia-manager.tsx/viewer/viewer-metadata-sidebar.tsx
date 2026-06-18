"use client";

import type { RefObject } from "react";
import { HiChevronLeft } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SidebarSection } from "./sidebar/sidebar-section";
import { PropertiesGrid } from "./sidebar/properties-grid";
import { HistoryGrid } from "./sidebar/history-grid";
import { ObservationsSection } from "./observations/observations-section";
import type { ObservationEntry, ObservationType, TimelineEntry } from "./observations/observation.types";
import type { ReviewStatus } from "../gallery/media-row";
import { AlfrescoFileEntry } from "../image.types";

/**
 * Metadata sidebar for the inline viewer. Always shows the properties section; the
 * observations/review section (and its full-screen view) are only rendered for
 * reviewable content.
 */
export default function ViewerMetadataSidebar({
  id,
  currentIndex,
  entry,
  categoryLabel,
  currentCategory,
  isReviewable,
  showAllObservations,
  setShowAllObservations,
  reviewStatuses,
  draftObservations,
  committedTimeline,
  onAddObservation,
  onRemoveDraftObservation,
  onRemoveCommittedObservation,
  onAddReply,
  onRemoveReply,
  onRename,
  pendingReplyRef,
  dictionary,
}: Readonly<{
  id: string | undefined;
  currentIndex: number;
  entry: AlfrescoFileEntry["entry"];
  categoryLabel: string | undefined;
  currentCategory: string | null;
  isReviewable: boolean;
  showAllObservations: boolean;
  setShowAllObservations: (value: boolean) => void;
  reviewStatuses?: Map<string, ReviewStatus>;
  draftObservations?: Map<string, ObservationEntry[]>;
  committedTimeline?: Map<string, TimelineEntry[]>;
  onAddObservation?: (fileId: string, types: ObservationType[], description: string) => void;
  onRemoveDraftObservation?: (fileId: string, obsId: string) => void;
  onRemoveCommittedObservation?: (fileId: string, obsId: string) => void;
  onAddReply?: (fileId: string, obsId: string, description: string) => void;
  onRemoveReply?: (fileId: string, obsId: string, replyId: string) => void;
  onRename?: (newName: string) => Promise<void>;
  pendingReplyRef: RefObject<{ text: string; send: () => void }>;
  dictionary: I18nRecord;
}>) {
  const reviewStatus = entry.properties?.["mintral:reviewStatus"];
  let reviewStatusLabel: string | null = null;
  if (reviewStatus && reviewStatus !== "PENDING") {
    reviewStatusLabel = reviewStatus === "APPROVED"
      ? tr("bento.multimedia.sidebar_prop_review_approved", dictionary)
      : tr("bento.multimedia.sidebar_prop_review_rejected", dictionary);
  }

  return (
    <div
      className="shrink-0 sm:shrink-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto flex flex-col w-full sm:w-1/3 min-h-0 basis-1/2 sm:basis-auto sm:h-full"
    >
      {showAllObservations && isReviewable ? (
        <div className="flex flex-col h-full">
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setShowAllObservations(false)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <HiChevronLeft className="w-3.5 h-3.5" />
              {tr("bento.multimedia.sidebar_obs_back", dictionary)}
            </button>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-auto">
              {tr("bento.multimedia.sidebar_observations", dictionary)}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ObservationsSection
              key={id ?? currentIndex}
              dictionary={dictionary}
              draftObservations={draftObservations?.get(id ?? "") ?? []}
              committedTimeline={committedTimeline?.get(id ?? "") ?? []}
              isInDraftReview={!reviewStatuses?.get(id ?? "") || reviewStatuses?.get(id ?? "") === "pending"}
              onAdd={(types, description) => { if (id) onAddObservation?.(id, types, description); }}
              onRemoveDraft={(obsId) => { if (id) onRemoveDraftObservation?.(id, obsId); }}
              onRemoveCommitted={(obsId) => { if (id) onRemoveCommittedObservation?.(id, obsId); }}
              onAddReply={(obsId, desc) => { if (id) onAddReply?.(id, obsId, desc); }}
              onRemoveReply={(obsId, rid) => { if (id) onRemoveReply?.(id, obsId, rid); }}
              pendingReplyRef={pendingReplyRef}
              mode="full"
              category={currentCategory}
            />
          </div>
        </div>
      ) : (
        <>
          <SidebarSection title={tr("bento.multimedia.sidebar_properties", dictionary)} defaultExpanded>
            <PropertiesGrid
              entry={entry}
              categoryLabel={categoryLabel}
              onRename={onRename}
              dictionary={dictionary}
            />
          </SidebarSection>
          <SidebarSection title={tr("bento.multimedia.sidebar_history", dictionary)} defaultExpanded>
            <HistoryGrid
              entry={entry}
              reviewStatusLabel={reviewStatusLabel}
              dictionary={dictionary}
            />
          </SidebarSection>
          {isReviewable && (
            <SidebarSection title={tr("bento.multimedia.sidebar_observations", dictionary)} defaultExpanded>
              <ObservationsSection
                key={id ?? currentIndex}
                dictionary={dictionary}
                draftObservations={draftObservations?.get(id ?? "") ?? []}
                committedTimeline={committedTimeline?.get(id ?? "") ?? []}
                isInDraftReview={!reviewStatuses?.get(id ?? "") || reviewStatuses?.get(id ?? "") === "pending"}
                onAdd={(types, description) => { if (id) onAddObservation?.(id, types, description); }}
                onRemoveDraft={(obsId) => { if (id) onRemoveDraftObservation?.(id, obsId); }}
                onRemoveCommitted={(obsId) => { if (id) onRemoveCommittedObservation?.(id, obsId); }}
                onAddReply={(obsId, desc) => { if (id) onAddReply?.(id, obsId, desc); }}
                onRemoveReply={(obsId, rid) => { if (id) onRemoveReply?.(id, obsId, rid); }}
                pendingReplyRef={pendingReplyRef}
                mode="preview"
                onShowAll={() => setShowAllObservations(true)}
                category={currentCategory}
              />
            </SidebarSection>
          )}
        </>
      )}
    </div>
  );
}
