"use client";

import { useState, useEffect, useRef } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { getCategories } from "../clasification-form";
import { AlfrescoFileEntry } from "../image.types";
import { isReviewableEntry } from "../reviewable";
import { ReviewStatus } from "../gallery/media-row";
import { downloadImage } from "@/features/geographic-view/utils/download-image";
import { updateBentoCategory, renameBentoFile } from "@/features/common/providers/client-api.provider";
import { toast } from "sonner";

import { findNextUndecided } from "./viewer-utils";
import { useDocBlob } from "./use-doc-blob";
import { MoveToTaskModal } from "./modals/move-to-task-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";
import { UnsentReplyModal } from "./modals/unsent-reply-modal";
import type { ObservationEntry, ObservationType, TimelineEntry } from "./observations/observation.types";
import ViewerToolbar from "./viewer-toolbar";
import MobileHeader from "./mobile-header";
import MediaContentDisplay from "./media-content-display";
import ViewerHeaderBadges from "./viewer-header-badges";
import ViewerMetadataSidebar from "./viewer-metadata-sidebar";

export type MediaViewerItem = {
  type: "image" | "document";
  file: AlfrescoFileEntry;
  refreshKey?: number;
};

export type { ObservationEntry, ObservationType, TimelineEntry };
export type { StateChangeTimelineEntry, LooseObservationTimelineEntry } from "./observations/observation.types";

export default function MediaInlineViewer({
  items,
  initialIndex = 0,
  onClose,
  reviewStatuses,
  draftDecisions,
  onStatusChange,
  onEdit,
  onDelete,
  onRename,
  currentTaskServiceCode,
  draftObservations,
  committedTimeline,
  onAddObservation,
  onRemoveDraftObservation,
  onRemoveCommittedObservation,
  onAddReply,
  onRemoveReply,
  onCategoryChanged,
  dictionary,
}: Readonly<{
  items: MediaViewerItem[];
  initialIndex?: number;
  onClose: () => void;
  reviewStatuses?: Map<string, ReviewStatus>;
  draftDecisions?: Map<string, ReviewStatus>;
  onStatusChange?: (id: string, status: ReviewStatus) => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  onRename?: () => void;
  onCategoryChanged?: () => void;
  currentTaskServiceCode?: string;
  draftObservations?: Map<string, ObservationEntry[]>;
  committedTimeline?: Map<string, TimelineEntry[]>;
  onAddObservation?: (fileId: string, type: ObservationType, description: string) => void;
  onRemoveDraftObservation?: (fileId: string, obsId: string) => void;
  onRemoveCommittedObservation?: (fileId: string, obsId: string) => void;
  onAddReply?: (fileId: string, obsId: string, description: string) => void;
  onRemoveReply?: (fileId: string, obsId: string, replyId: string) => void;
  dictionary: I18nRecord;
}>) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, items.length - 1))
  );
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [showAllObservations, setShowAllObservations] = useState(false);
  const [isUnsentReplyModalOpen, setIsUnsentReplyModalOpen] = useState(false);
  const pendingReplyRef = useRef<{ text: string; send: () => void }>({ text: "", send: () => {} });

  const handleClose = () => {
    if (pendingReplyRef.current.text.trim()) {
      setIsUnsentReplyModalOpen(true);
    } else {
      onClose();
    }
  };

  const handleFileMoved = () => {
    setIsMoveModalOpen(false);
    if (items.length <= 1) {
      onRename?.();
      onClose();
      return;
    }
    if (currentIndex >= items.length - 1) {
      setCurrentIndex(currentIndex - 1);
    }
    onRename?.();
  };

  useEffect(() => {
    setCurrentIndex(Math.max(0, Math.min(initialIndex, items.length - 1)));
  }, [initialIndex, items.length]);

  const current = items[currentIndex];
  const id = current?.file?.entry?.id;

  const [currentCategory, setCurrentCategory] = useState<string | null>(
    current?.file?.entry?.properties?.["mintral:contentType"] ?? null
  );

  const isCurrentReviewable = current?.file?.entry?.aspectNames?.includes("mintral:reviewableAspect") ?? false;
  useEffect(() => {
    setCurrentCategory(items[currentIndex]?.file?.entry?.properties?.["mintral:contentType"] ?? null);
  }, [currentIndex, items]);

  const handleCategoryChange = (newCategory: string) => {
    if (!id) return;
    const prev = currentCategory;
    setCurrentCategory(newCategory);
    const promise = updateBentoCategory(id, newCategory).then((res) => {
      onCategoryChanged?.();
      return res;
    });
    toast.promise(promise, {
      loading: tr("bento.multimedia.category_change_loading", dictionary),
      success: tr("bento.multimedia.category_change_success", dictionary),
      error: () => {
        setCurrentCategory(prev);
        return tr("bento.multimedia.category_change_error", dictionary);
      },
    });
  };

  const { docUrl, isDocLoading } = useDocBlob(current, id);

  if (!current) return null;

  const categories = getCategories(dictionary);
  const categoryLabel = categories[currentCategory as keyof typeof categories]?.label;
  const status: ReviewStatus = id ? (reviewStatuses?.get(id) ?? "pending") : "pending";
  // Non-reviewable content (no mintral:reviewableAspect) exposes no review controls.
  const isReviewable = isReviewableEntry(current.file);

  const handleDecision = (decision: ReviewStatus) => {
    if (!id || !isCurrentReviewable) return;
    onStatusChange?.(id, decision);

    if (status === "approved" || status === "rejected") return;

    const updatedDrafts = new Map(draftDecisions ?? new Map());
    updatedDrafts.set(id, decision);

    const nextIndex = findNextUndecided(items, currentIndex, updatedDrafts, reviewStatuses);
    if (nextIndex === null) {
      onClose();
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const fileUrl = id ? `/app/api/bento/content?nodeId=${id}` : "";

  const handleDownload = () => {
    if (!id) return;
    downloadImage(fileUrl, dictionary, current.file.entry.name).catch(() => {});
  };

  const refreshSuffix = current.refreshKey ? `&r=${current.refreshKey}` : "";
  const imageUrl =
    current.type === "image" ? `/app/api/bento/content?nodeId=${id}${refreshSuffix}` : null;
  const draftDecision = id ? (draftDecisions?.get(id) ?? null) : null;
  const handleEditClick = onEdit ? () => onEdit(currentIndex) : undefined;
  const handleDeleteClick = onDelete ? () => setIsDeleteConfirmOpen(true) : undefined;

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-x-2 gap-y-1 px-2 sm:px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">

        <MobileHeader
          fileName={current.file.entry.name}
          currentIndex={currentIndex}
          totalItems={items.length}
          status={status}
          draftDecision={draftDecision}
          isReviewable={isReviewable}
          categories={Object.values(categories)}
          currentCategory={currentCategory}
          onCategoryChange={handleCategoryChange}
          onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
          onDownload={handleDownload}
          onMove={() => setIsMoveModalOpen(true)}
          onDelete={handleDeleteClick}
          onDecision={handleDecision}
          onClose={handleClose}
          onRename={async (newName) => {
            if (id) await renameBentoFile(id, newName);
            onRename?.();
          }}
          dictionary={dictionary}
        />

        {/* Desktop: original single-row layout (hidden on mobile) */}
        <div className="hidden sm:flex items-center gap-1 sm:gap-2 min-w-0 flex-1 basis-auto">
          <ViewerHeaderBadges
            entry={current.file.entry}
            status={status}
            draftDecision={draftDecision}
            isReviewable={isReviewable}
            dictionary={dictionary}
          />
        </div>

        {/* Desktop: Right actions (hidden on mobile) */}
        <ViewerToolbar
          fileUrl={fileUrl}
          fileName={current.file.entry.name}
          currentIndex={currentIndex}
          totalItems={items.length}
          status={status}
          draftDecision={draftDecision}
          isReviewable={isReviewable}
          onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
          onDownload={handleDownload}
          onEdit={handleEditClick}
          onMove={() => setIsMoveModalOpen(true)}
          onDelete={handleDeleteClick}
          onDecision={handleDecision}
          onClose={handleClose}
          categories={Object.values(categories)}
          currentCategory={currentCategory}
          onCategoryChange={handleCategoryChange}
          dictionary={dictionary}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
        {/* Media area */}
        <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 overflow-hidden shrink-0 sm:shrink basis-1/2 sm:basis-auto">
          <MediaContentDisplay
            type={current.type}
            fileName={current.file.entry.name}
            imageUrl={imageUrl}
            docUrl={docUrl}
            isDocLoading={isDocLoading}
            dictionary={dictionary}
          />
        </div>

        {/* Metadata sidebar */}
        <ViewerMetadataSidebar
          id={id}
          currentIndex={currentIndex}
          entry={current.file.entry}
          categoryLabel={categoryLabel}
          currentCategory={currentCategory}
          isReviewable={isReviewable}
          showAllObservations={showAllObservations}
          setShowAllObservations={setShowAllObservations}
          reviewStatuses={reviewStatuses}
          draftObservations={draftObservations}
          committedTimeline={committedTimeline}
          onAddObservation={onAddObservation}
          onRemoveDraftObservation={onRemoveDraftObservation}
          onRemoveCommittedObservation={onRemoveCommittedObservation}
          onAddReply={onAddReply}
          onRemoveReply={onRemoveReply}
          onRename={id ? async (newName) => { await renameBentoFile(id, newName); onRename?.(); } : undefined}
          pendingReplyRef={pendingReplyRef}
          dictionary={dictionary}
        />
      </div>

      {/* Move to task modal */}
      <MoveToTaskModal
        show={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        fileName={current.file.entry.name}
        nodeId={id}
        currentTaskServiceCode={currentTaskServiceCode}
        onMoved={handleFileMoved}
        dictionary={dictionary}
      />

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        show={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => {
          setIsDeleteConfirmOpen(false);
          onDelete?.(currentIndex);
        }}
        fileName={current.file.entry.name}
        dictionary={dictionary}
      />

      {/* Unsent reply modal */}
      <UnsentReplyModal
        show={isUnsentReplyModalOpen}
        onClose={() => setIsUnsentReplyModalOpen(false)}
        onDiscard={() => { setIsUnsentReplyModalOpen(false); pendingReplyRef.current = { text: "", send: () => {} }; onClose(); }}
        onSave={() => { setIsUnsentReplyModalOpen(false); pendingReplyRef.current.send(); pendingReplyRef.current = { text: "", send: () => {} }; onClose(); }}
        dictionary={dictionary}
      />
    </div>
  );
}
