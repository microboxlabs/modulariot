"use client";

import { Button, Dropdown, DropdownItem, Modal, ModalHeader, ModalBody, Tooltip } from "flowbite-react";
import { useState, useEffect, useRef } from "react";
import {
  HiChevronDown,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiXMark,
  HiCheck,
  HiArrowDownTray,
  HiShare,
  HiPencilSquare,
  HiArrowsRightLeft,
  HiChevronLeft,
  HiTrash,
} from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MODAL_THEME } from "../modal-theme";
import { getCategories } from "../clasification-form";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { AlfrescoFileEntry } from "../image.types";
import { ReviewStatus } from "../gallery/media-row";
import { downloadImage } from "@/features/geographic-view/utils/download-image";
import { updateBentoCategory, renameBentoFile } from "@/features/common/providers/client-api.provider";
import { toast } from "sonner";

import { findNextUndecided, formatBytes } from "./viewer-utils";
import { STATUS_BADGE_CLASSES, DRAFT_BADGE_CLASSES, DRAFT_BADGE_KEYS } from "./viewer-constants";
import { useDocBlob } from "./use-doc-blob";
import EditableField from "@/features/common/components/editable-field/editable-field";
import SelectorDropdown from "@/features/common/components/custom-dropdown/selector-dropdown";
import { SplitButton } from "@/features/common/components/split-button";
import { SharePopover } from "./header";
import CustomBadge from "@/features/common/components/custom-badge/custom-badge";
import { SidebarSection, MetaRow } from "./sidebar";
import { MoveToTaskModal } from "./modals";
import { ObservationsSection } from "./observations";
import type { ObservationEntry, ObservationType, TimelineEntry } from "./observations";

export type MediaViewerItem = {
  type: "image" | "document";
  file: AlfrescoFileEntry;
  refreshKey?: number;
};

export type { ObservationEntry, ObservationType, TimelineEntry };
export type { StateChangeTimelineEntry, LooseObservationTimelineEntry } from "./observations";

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
    current?.file?.entry?.properties["mintral:contentType"] ?? null
  );
  useEffect(() => {
    setCurrentCategory(items[currentIndex]?.file?.entry?.properties["mintral:contentType"] ?? null);
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

  const handleDecision = (decision: ReviewStatus) => {
    if (!id) return;
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

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-x-2 gap-y-1 px-2 sm:px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">

        {/* Mobile: Row 1 — nav + file name + close */}
        <div className="flex items-center gap-1.5 sm:hidden">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="p-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label={tr("bento.multimedia.viewer_prev", dictionary)}
          >
            <HiOutlineChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
            {currentIndex + 1}/{items.length}
          </span>
          <button
            type="button"
            disabled={currentIndex === items.length - 1}
            onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
            className="p-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label={tr("bento.multimedia.viewer_next", dictionary)}
          >
            <HiOutlineChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="min-w-0 flex-1">
            <EditableField
              taskId=""
              fieldName="name"
              value={current.file.entry.name}
              type="text"
              variant="inline"
              onSave={async (newName) => {
                if (id) await renameBentoFile(id, newName);
                onRename?.();
              }}
              inputClassName="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-blue-500 dark:border-blue-400 outline-none min-w-0 w-full"
              displayClassName="block text-sm font-medium text-gray-900 dark:text-white truncate transition-colors cursor-text hover:text-blue-600 dark:hover:text-blue-400"
            />
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0 cursor-pointer"
            aria-label={tr("bento.multimedia.viewer_close", dictionary)}
          >
            <HiXMark className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Mobile: Row 2 — action icons */}
        <div className="flex items-center gap-1 sm:hidden">
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            aria-label={tr("bento.multimedia.viewer_download", dictionary)}
          >
            <HiArrowDownTray className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            type="button"
            disabled
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 opacity-40 cursor-not-allowed"
            aria-label={tr("bento.multimedia.viewer_share", dictionary)}
          >
            <HiShare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(currentIndex)}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              aria-label={tr("bento.multimedia.viewer_replace", dictionary)}
            >
              <HiPencilSquare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMoveModalOpen(true)}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            aria-label={tr("bento.multimedia.viewer_move", dictionary)}
          >
            <HiArrowsRightLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-colors cursor-pointer group"
              aria-label={tr("bento.multimedia.viewer_delete", dictionary)}
            >
              <HiTrash className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
            </button>
          )}
        </div>

        {/* Mobile: Row 3 — category dropdown full width */}
        <div className="py-1 sm:hidden">
          <SelectorDropdown
            categories={Object.values(categories)}
            baseCategory={currentCategory}
            selectCategory={handleCategoryChange}
            dictionary={dictionary}
          />
        </div>

        {/* Mobile: Row 4 — approve/reject full width */}
        <div className="flex items-center gap-2 sm:hidden">
          {status !== "approved" && (
            <>
              <button
                type="button"
                onClick={() => handleDecision("rejected")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  draftDecision === "rejected"
                    ? "border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <HiXMark className="w-4 h-4" />
                {tr("bento.multimedia.btn_reject", dictionary)}
              </button>
              <button
                type="button"
                onClick={() => handleDecision("approved")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  draftDecision === "approved"
                    ? "bg-blue-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                <HiCheck className="w-4 h-4" />
                {tr("bento.multimedia.btn_approve", dictionary)}
              </button>
            </>
          )}
          {status === "approved" && (
            <Dropdown
              label=""
              theme={{
                floating: {
                  base: "overflow-hidden rounded-lg z-10",
                  style: {
                    auto: "border border-gray-200 dark:border-gray-500 bg-white text-gray-900 dark:bg-gray-700 dark:text-white",
                  },
                },
              }}
              renderTrigger={() => (
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 rounded-lg text-sm font-light cursor-pointer border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 w-full"
                >
                  <span className="text-sm font-light">
                    {tr("bento.multimedia.btn_change_status", dictionary)}
                  </span>
                  <HiChevronDown className="w-4 h-4" />
                </button>
              )}
              className="w-full"
              style={{ width: "100%" }}
            >
              {draftDecision !== null && (
                <DropdownItem onClick={() => handleDecision("approved")}>
                  {tr("bento.multimedia.btn_no_change", dictionary)}
                </DropdownItem>
              )}
              <DropdownItem onClick={() => handleDecision("rejected")}>
                {tr("bento.multimedia.btn_reject", dictionary)}
              </DropdownItem>
              <DropdownItem onClick={() => handleDecision("pending")}>
                {tr("bento.multimedia.btn_back_to_review", dictionary)}
              </DropdownItem>
            </Dropdown>
          )}
        </div>

        {/* Desktop: original single-row layout (hidden on mobile) */}
        <div className="hidden sm:flex items-center gap-1 sm:gap-2 min-w-0 flex-1 basis-auto">
          <EditableField
            taskId=""
            fieldName="name"
            value={current.file.entry.name}
            type="text"
            variant="inline"
            onSave={async (newName) => {
              if (id) await renameBentoFile(id, newName);
              onRename?.();
            }}
            inputClassName="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-blue-500 dark:border-blue-400 outline-none min-w-0 w-48 max-w-full"
            displayClassName="text-sm font-medium text-gray-900 dark:text-white truncate transition-colors cursor-text hover:text-blue-600 dark:hover:text-blue-400"
          />
          <SelectorDropdown
            categories={Object.values(categories)}
            baseCategory={currentCategory}
            selectCategory={handleCategoryChange}
            dictionary={dictionary}
            fitWidth
          />
          {current.file.entry.modifiedAt && (
            <CustomBadge
              text={formatDateString(current.file.entry.modifiedAt)}
              className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 shrink-0 hidden md:inline-flex"
            />
          )}
          {current.file.entry.modifiedByUser?.id && (
            <CustomBadge
              text={current.file.entry.modifiedByUser.id}
              className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 shrink-0 hidden md:inline-flex"
            />
          )}
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
        </div>

        {/* Desktop: Right actions (hidden on mobile) */}
        <div className="hidden sm:flex items-center gap-1 xl:gap-1.5 shrink-0">
          <SharePopover fileUrl={fileUrl} fileName={current.file.entry.name} dictionary={dictionary} />
          <Tooltip content={tr("bento.multimedia.viewer_download", dictionary)} placement="bottom">
            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <HiArrowDownTray className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </Tooltip>
          {onEdit && (
            <div className="inline-flex lg:hidden xl:inline-flex">
              <Tooltip content={tr("bento.multimedia.viewer_replace", dictionary)} placement="bottom">
                <button
                  type="button"
                  onClick={() => onEdit(currentIndex)}
                  className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <HiPencilSquare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </Tooltip>
            </div>
          )}
          <div className="inline-flex lg:hidden xl:inline-flex">
            <Tooltip content={tr("bento.multimedia.viewer_move", dictionary)} placement="bottom">
              <button
                type="button"
                onClick={() => setIsMoveModalOpen(true)}
                className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <HiArrowsRightLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </Tooltip>
          </div>
          {onDelete && (
            <Tooltip content={tr("bento.multimedia.viewer_delete", dictionary)} placement="bottom">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-colors cursor-pointer group"
              >
                <HiTrash className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
              </button>
            </Tooltip>
          )}

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />

          {/* Navigation with counter in the middle */}
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={tr("bento.multimedia.viewer_prev", dictionary)}
          >
            <HiOutlineChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums px-1 min-w-8 xl:min-w-10 text-center">
            {currentIndex + 1}/{items.length}
          </span>
          <button
            type="button"
            disabled={currentIndex === items.length - 1}
            onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
            className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={tr("bento.multimedia.viewer_next", dictionary)}
          >
            <HiOutlineChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Approve / Reject */}
          {status !== "approved" && (
            <SplitButton
              primary={{
                id: "approve",
                label: <span className="hidden lg:hidden xl:inline">{tr("bento.multimedia.btn_approve", dictionary)}</span>,
                icon: <HiCheck className="w-4 h-4" />,
                onClick: () => handleDecision("approved"),
              }}
              secondaryActions={[
                {
                  id: "reject",
                  label: <span className="hidden lg:hidden xl:inline">{tr("bento.multimedia.btn_reject", dictionary)}</span>,
                  icon: <HiXMark className="w-4 h-4" />,
                  onClick: () => handleDecision("rejected"),
                },
              ]}
            />
          )}
          {status === "approved" && (
            <Dropdown
              label=""
              theme={{
                floating: {
                  base: "overflow-hidden rounded-lg z-10",
                  style: {
                    auto: "border border-gray-200 dark:border-gray-500 bg-white text-gray-900 dark:bg-gray-700 dark:text-white",
                  },
                },
              }}
              renderTrigger={() => (
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 rounded-lg text-sm font-light cursor-pointer border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 w-fit"
                >
                  <span className="text-sm font-light whitespace-nowrap">
                    {tr("bento.multimedia.btn_change_status", dictionary)}
                  </span>
                  <HiChevronDown className="w-4 h-4" />
                </button>
              )}
            >
              {draftDecision !== null && (
                <DropdownItem onClick={() => handleDecision("approved")}>
                  {tr("bento.multimedia.btn_no_change", dictionary)}
                </DropdownItem>
              )}
              <DropdownItem onClick={() => handleDecision("rejected")}>
                {tr("bento.multimedia.btn_reject", dictionary)}
              </DropdownItem>
              <DropdownItem onClick={() => handleDecision("pending")}>
                {tr("bento.multimedia.btn_back_to_review", dictionary)}
              </DropdownItem>
            </Dropdown>
          )}

          {/* Close */}
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0 cursor-pointer"
            aria-label={tr("bento.multimedia.viewer_close", dictionary)}
          >
            <HiXMark className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
        {/* Media area */}
        <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 overflow-hidden shrink-0 sm:shrink basis-1/2 sm:basis-auto">
          {current.type === "image" && imageUrl && (
            <img
              src={imageUrl}
              alt={current.file.entry.name}
              className="max-w-full max-h-full object-contain"
            />
          )}
          {current.type === "document" && isDocLoading && (
            <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">{tr("bento.multimedia.viewer_loading_doc", dictionary)}</span>
            </div>
          )}
          {current.type === "document" && !isDocLoading && docUrl && (
            <iframe
              src={docUrl}
              title={current.file.entry.name}
              className="w-full h-full border-0"
            />
          )}
          {current.type === "document" && !isDocLoading && !docUrl && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {tr("bento.multimedia.viewer_load_error", dictionary)}
            </span>
          )}
        </div>

        {/* Metadata sidebar */}
        <div
          className="shrink-0 sm:shrink-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto flex flex-col w-full sm:w-1/3 min-h-0 basis-1/2 sm:basis-auto sm:h-full"
        >
          {showAllObservations ? (
            <div className="flex flex-col h-full">
              <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
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
                  isInDraftReview={!reviewStatuses?.get(id) || reviewStatuses?.get(id) === "pending"}
                  onAdd={(type, description) => { if (id) onAddObservation?.(id, type, description); }}
                  onRemoveDraft={(obsId) => { if (id) onRemoveDraftObservation?.(id, obsId); }}
                  onRemoveCommitted={(obsId) => { if (id) onRemoveCommittedObservation?.(id, obsId); }}
                  onAddReply={(obsId, desc) => { if (id) onAddReply?.(id, obsId, desc); }}
                  onRemoveReply={(obsId, rid) => { if (id) onRemoveReply?.(id, obsId, rid); }}
                  pendingReplyRef={pendingReplyRef}
                  mode="full"
                />
              </div>
            </div>
          ) : (
          <>
          <SidebarSection title={tr("bento.multimedia.sidebar_properties", dictionary)} defaultExpanded>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <MetaRow label={tr("bento.multimedia.sidebar_prop_name", dictionary)} value={current.file.entry.name} />
              {categoryLabel && <MetaRow label={tr("bento.multimedia.sidebar_prop_category", dictionary)} value={categoryLabel} />}
              {current.file.entry.properties["cm:versionLabel"] && (
                <MetaRow label={tr("bento.multimedia.sidebar_prop_version", dictionary)} value={`v${current.file.entry.properties["cm:versionLabel"]}`} />
              )}
              <MetaRow label={tr("bento.multimedia.sidebar_prop_type", dictionary)} value={current.file.entry.content.mimeTypeName ?? current.file.entry.content.mimeType} />
              <MetaRow label={tr("bento.multimedia.sidebar_prop_size", dictionary)} value={formatBytes(current.file.entry.content.sizeInBytes)} />
              {current.file.entry.modifiedAt && (
                <MetaRow label={tr("bento.multimedia.sidebar_prop_modified", dictionary)} value={formatDateString(current.file.entry.modifiedAt)} />
              )}
              {current.file.entry.modifiedByUser?.displayName && (
                <MetaRow label={tr("bento.multimedia.sidebar_prop_modified_by", dictionary)} value={current.file.entry.modifiedByUser.displayName} />
              )}
              {current.file.entry.createdAt && (
                <MetaRow label={tr("bento.multimedia.sidebar_prop_created", dictionary)} value={formatDateString(current.file.entry.createdAt)} />
              )}
              {current.file.entry.createdByUser?.displayName && (
                <MetaRow label={tr("bento.multimedia.sidebar_prop_author", dictionary)} value={current.file.entry.createdByUser.displayName} />
              )}
              {current.file.entry.properties["mintral:reviewStatus"] && current.file.entry.properties["mintral:reviewStatus"] !== "PENDING" && (
                <MetaRow label={tr("bento.multimedia.sidebar_prop_review_status", dictionary)} value={current.file.entry.properties["mintral:reviewStatus"] === "APPROVED" ? tr("bento.multimedia.sidebar_prop_review_approved", dictionary) : tr("bento.multimedia.sidebar_prop_review_rejected", dictionary)} />
              )}
              {current.file.entry.properties["mintral:reviewedBy"] && (
                <MetaRow label={tr("bento.multimedia.sidebar_prop_reviewed_by", dictionary)} value={current.file.entry.properties["mintral:reviewedBy"]} />
              )}
              {current.file.entry.properties["mintral:reviewedAt"] && (
                <MetaRow label={tr("bento.multimedia.sidebar_prop_reviewed_at", dictionary)} value={formatDateString(current.file.entry.properties["mintral:reviewedAt"])} />
              )}
            </dl>
          </SidebarSection>
          <SidebarSection title={tr("bento.multimedia.sidebar_observations", dictionary)} defaultExpanded>
            <ObservationsSection
              key={id ?? currentIndex}
              dictionary={dictionary}
              draftObservations={draftObservations?.get(id ?? "") ?? []}
              committedTimeline={committedTimeline?.get(id ?? "") ?? []}
              isInDraftReview={!reviewStatuses?.get(id) || reviewStatuses?.get(id) === "pending"}
              onAdd={(type, description) => { if (id) onAddObservation?.(id, type, description); }}
              onRemoveDraft={(obsId) => { if (id) onRemoveDraftObservation?.(id, obsId); }}
              onRemoveCommitted={(obsId) => { if (id) onRemoveCommittedObservation?.(id, obsId); }}
              onAddReply={(obsId, desc) => { if (id) onAddReply?.(id, obsId, desc); }}
              onRemoveReply={(obsId, rid) => { if (id) onRemoveReply?.(id, obsId, rid); }}
              pendingReplyRef={pendingReplyRef}
              mode="preview"
              onShowAll={() => setShowAllObservations(true)}
            />
          </SidebarSection>
        </>
        )}
        </div>
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
      <Modal
        dismissible
        show={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        size="md"
        theme={MODAL_THEME}
      >
        <ModalHeader className="border-none">
          <div className="flex flex-col">
            <span className="text-base font-semibold">{tr("bento.multimedia.delete_modal_title", dictionary)}</span>
            <span className="text-sm text-gray-500 mt-1 font-normal">
              {tr("bento.multimedia.delete_modal_desc", dictionary)}
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                {current.file.entry.name}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                color="alternative"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                {tr("bento.multimedia.btn_cancel", dictionary)}
              </Button>
              <Button
                color="blue"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  onDelete?.(currentIndex);
                }}
              >
                {tr("bento.multimedia.btn_delete", dictionary)}
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* Unsent reply modal */}
      <Modal
        dismissible
        show={isUnsentReplyModalOpen}
        onClose={() => setIsUnsentReplyModalOpen(false)}
        size="sm"
        theme={MODAL_THEME}
      >
        <ModalHeader className="border-none">
          <span className="text-base font-semibold">{tr("bento.multimedia.unsent_reply_title", dictionary)}</span>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {tr("bento.multimedia.unsent_reply_desc", dictionary)}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                color="alternative"
                size="sm"
                onClick={() => { setIsUnsentReplyModalOpen(false); pendingReplyRef.current = { text: "", send: () => {} }; onClose(); }}
              >
                {tr("bento.multimedia.unsent_reply_discard", dictionary)}
              </Button>
              <Button
                color="blue"
                size="sm"
                onClick={() => { setIsUnsentReplyModalOpen(false); pendingReplyRef.current.send(); pendingReplyRef.current = { text: "", send: () => {} }; onClose(); }}
              >
                {tr("bento.multimedia.unsent_reply_save", dictionary)}
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
}
