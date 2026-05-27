"use client";

import { Button, Dropdown, DropdownItem, Modal, ModalHeader, ModalBody, Tooltip } from "flowbite-react";
import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import {
  HiChevronDown,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiXMark,
  HiCheck,
  HiArrowDownTray,
  HiShare,
  HiPencilSquare,
  HiMagnifyingGlass,
  HiLink,
  HiEnvelope,
  HiArrowTopRightOnSquare,
  HiTrash,
  HiArrowsRightLeft,
  HiChevronLeft,
} from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { getCategories } from "./clasification-form";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { AlfrescoFileEntry } from "./image.types";
import { ReviewStatus } from "./media-row";
import { downloadImage } from "@/features/geographic-view/utils/download-image";
import { renameBentoFile, updateBentoCategory, moveBentoFile, useSearchTasks } from "@/features/common/providers/client-api.provider";
import type { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { toast } from "sonner";

export type MediaViewerItem = {
  type: "image" | "document";
  file: AlfrescoFileEntry;
  refreshKey?: number;
};

type PermitLevel = "read" | "edit";
type PermitEntry = { id: string; displayName: string; level: PermitLevel };

/** Find the next undecided file index, wrapping around from the end. */
function findNextUndecided(
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

// ─── Complexity-reduction helpers ─────────────────────────────────────────────

const STATUS_BADGE_CLASSES: Record<ReviewStatus, string> = {
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const DRAFT_BADGE_CLASSES: Record<string, string> = {
  approved: "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  pending: "border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  rejected: "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
};

const DRAFT_BADGE_KEYS: Record<string, string> = {
  approved: "bento.multimedia.draft_will_approve",
  pending: "bento.multimedia.draft_will_review",
  rejected: "bento.multimedia.draft_will_reject",
};

function useDocBlob(current: MediaViewerItem | undefined, id: string | undefined) {
  const [docBlobUrls, setDocBlobUrls] = useState<Record<string, string>>({});
  const [loadingDocs, setLoadingDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!current || current.type !== "document" || !id) return;
    if (docBlobUrls[id] || loadingDocs.has(id)) return;

    setLoadingDocs((prev) => new Set(prev).add(id));
    fetch(`/app/api/bento/content?nodeId=${id}`)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setDocBlobUrls((prev) => ({ ...prev, [id]: url }));
      })
      .catch(() => {})
      .finally(() => {
        setLoadingDocs((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  }, [current, id, docBlobUrls, loadingDocs]);

  useEffect(() => {
    return () => {
      Object.values(docBlobUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const docUrl = current?.type === "document" && id ? docBlobUrls[id] : null;
  const isDocLoading = current?.type === "document" && id ? loadingDocs.has(id) : false;

  return { docUrl, isDocLoading };
}

function EditableFileName({
  currentName,
  nodeId,
  onRenamed,
  dictionary,
  inputClassName,
  spanClassName,
}: Readonly<{
  currentName: string;
  nodeId: string | undefined;
  onRenamed?: () => void;
  dictionary: I18nRecord;
  inputClassName: string;
  spanClassName: string;
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsEditing(false);
    setEditedName(currentName);
  }, [currentName]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const handleBlur = () => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== currentName && nodeId) {
      const renamePromise = renameBentoFile(nodeId, trimmed);
      toast.promise(renamePromise, {
        loading: tr("bento.multimedia.rename_loading", dictionary),
        success: tr("bento.multimedia.rename_success", dictionary),
        error: tr("bento.multimedia.rename_error", dictionary),
      });
      renamePromise.then(() => onRenamed?.()).catch(() => {
        setEditedName(currentName);
      });
    } else {
      setEditedName(currentName);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") inputRef.current?.blur();
    if (e.key === "Escape") {
      setEditedName(currentName);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editedName}
        onChange={(e) => setEditedName(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={inputClassName}
      />
    );
  }

  return (
    <span
      title={tr("bento.multimedia.viewer_click_rename", dictionary)}
      onClick={() => setIsEditing(true)}
      className={spanClassName}
    >
      {editedName || currentName}
    </span>
  );
}

function SharePopover({
  fileUrl,
  fileName,
  dictionary,
}: Readonly<{
  fileUrl: string;
  fileName: string;
  dictionary: I18nRecord;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const fullUrl = `${globalThis.location.origin}${fileUrl}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(fullUrl);
    toast.success(tr("bento.multimedia.viewer_link_copied", dictionary));
    setIsOpen(false);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(fileName);
    const body = encodeURIComponent(`${fileName}\n\n${fullUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    setIsOpen(false);
  };

  const handleOpenTab = () => {
    window.open(fileUrl, "_blank");
    setIsOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <Tooltip content={tr("bento.multimedia.viewer_share", dictionary)} placement="bottom">
        <button
          type="button"
          onClick={() => setIsOpen((p) => !p)}
          className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <HiShare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </Tooltip>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center whitespace-nowrap gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <HiLink className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            {tr("bento.multimedia.viewer_copy_link", dictionary)}
          </button>
          <button
            type="button"
            onClick={handleEmail}
            className="w-full flex items-center whitespace-nowrap gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <HiEnvelope className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            {tr("bento.multimedia.viewer_share_email", dictionary)}
          </button>
          <button
            type="button"
            onClick={handleOpenTab}
            className="w-full flex items-center whitespace-nowrap gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <HiArrowTopRightOnSquare className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            {tr("bento.multimedia.viewer_open_new_tab", dictionary)}
          </button>
        </div>
      )}
    </div>
  );
}

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

    // If the file is already approved/rejected (committed), don't auto-advance
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

  const imageUrl =
    current.type === "image"
      ? `/app/api/bento/content?nodeId=${id}${current.refreshKey ? `&r=${current.refreshKey}` : ""}`
      : null;
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
            <EditableFileName
              currentName={current.file.entry.name}
              nodeId={id}
              onRenamed={onRename}
              dictionary={dictionary}
              inputClassName="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-blue-500 dark:border-blue-400 outline-none min-w-0 w-full"
              spanClassName="block text-sm font-medium text-gray-900 dark:text-white truncate transition-colors cursor-text hover:text-blue-600 dark:hover:text-blue-400"
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
          <CategoryDropdown
            categories={Object.values(categories)}
            currentTag={currentCategory}
            onCategoryChange={handleCategoryChange}
            dictionary={dictionary}
            fullWidth
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
              label={tr("bento.multimedia.btn_change_status", dictionary)}
              size="xs"
              color="light"
              className="w-full"
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
          <EditableFileName
            currentName={current.file.entry.name}
            nodeId={id}
            onRenamed={onRename}
            dictionary={dictionary}
            inputClassName="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-blue-500 dark:border-blue-400 outline-none min-w-0 w-48 max-w-full"
            spanClassName="text-sm font-medium text-gray-900 dark:text-white truncate transition-colors cursor-text hover:text-blue-600 dark:hover:text-blue-400"
          />
          <CategoryDropdown
            categories={Object.values(categories)}
            currentTag={currentCategory}
            onCategoryChange={handleCategoryChange}
            dictionary={dictionary}
          />
          {current.file.entry.modifiedAt && (
            <span className="text-xs text-gray-500 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 shrink-0 hidden md:inline-block">
              {formatDateString(current.file.entry.modifiedAt)}
            </span>
          )}
          {current.file.entry.modifiedByUser?.id && (
            <span className="text-xs text-gray-500 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 shrink-0 hidden md:inline-block">
              {current.file.entry.modifiedByUser.id}
            </span>
          )}
          <span
            className={`text-xs rounded-full px-2 py-0.5 shrink-0 font-medium hidden sm:inline-block ${STATUS_BADGE_CLASSES[status]}`}
          >
            {tr(`bento.multimedia.status_${status}`, dictionary)}
          </span>
          {draftDecision !== null && (
            <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 font-medium border hidden sm:inline-block ${
              DRAFT_BADGE_CLASSES[draftDecision] ?? DRAFT_BADGE_CLASSES.rejected
            }`}>
              → {tr(DRAFT_BADGE_KEYS[draftDecision] ?? DRAFT_BADGE_KEYS.rejected, dictionary)}
            </span>
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
            <ReviewSplitButton
              primary={{
                label: <span className="hidden lg:hidden xl:inline">{tr("bento.multimedia.btn_approve", dictionary)}</span>,
                icon: <HiCheck className="w-4 h-4" />,
                onClick: () => handleDecision("approved"),
                isActive: draftDecision === "approved",
              }}
              secondaryActions={[
                {
                  label: <span className="hidden lg:hidden xl:inline">{tr("bento.multimedia.btn_reject", dictionary)}</span>,
                  icon: <HiXMark className="w-4 h-4" />,
                  onClick: () => handleDecision("rejected"),
                  isActive: draftDecision === "rejected",
                },
              ]}
            />
          )}
          {status === "approved" && (
            <Dropdown
              label={tr("bento.multimedia.btn_change_status", dictionary)}
              size="xs"
              color="light"
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
          {current.type === "document" &&
            (isDocLoading ? (
              <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">{tr("bento.multimedia.viewer_loading_doc", dictionary)}</span>
              </div>
            ) : docUrl ? (
              <iframe
                src={docUrl}
                title={current.file.entry.name}
                className="w-full h-full border-0"
              />
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {tr("bento.multimedia.viewer_load_error", dictionary)}
              </span>
            ))}
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
          {/* TODO: Enable permits section when ready
          <SidebarSection title={tr("bento.multimedia.sidebar_permits", dictionary)}>
            <PermitsSection dictionary={dictionary} />
          </SidebarSection>
          */}
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
        theme={{
          content: {
            base: "relative w-full p-4 md:h-auto",
            inner: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
          },
          header: {
            base: "flex items-center justify-between rounded-t border-b p-4 pb-0 dark:border-gray-600",
            title: "text-base font-semibold text-gray-900 dark:text-white",
            close: { base: "hidden" },
          },
          body: {
            base: "flex-1 overflow-auto pt-4 px-4 pb-4",
          },
        }}
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
        theme={{
          content: {
            base: "relative w-full p-4 md:h-auto",
            inner: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
          },
          header: {
            base: "flex items-center justify-between rounded-t border-b p-4 pb-0 dark:border-gray-600",
            title: "text-base font-semibold text-gray-900 dark:text-white",
            close: { base: "hidden" },
          },
          body: {
            base: "flex-1 overflow-auto pt-4 px-4 pb-4",
          },
        }}
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

// ─── Sidebar primitives ──────────────────────────────────────────────────────

function SidebarSection({
  title,
  defaultExpanded = false,
  children,
}: Readonly<{
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}>) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {title}
        </span>
        <HiChevronDown
          className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200 shrink-0 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-3 pb-3 pt-2">{children}</div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className="text-xs text-gray-700 dark:text-gray-200 wrap-break-word">{value}</dd>
    </div>
  );
}

// ─── Permits section ─────────────────────────────────────────────────────────

function PermitsSection({ dictionary }: Readonly<{ dictionary: I18nRecord }>) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; displayName: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [permits, setPermits] = useState<Map<string, PermitEntry>>(new Map());
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (search.length < 3) {
      setResults([]);
      return;
    }
    searchRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/app/api/alfresco/people/search?term=${encodeURIComponent(search)}`);
        const json = await res.json();
        setResults((json.data ?? []).slice(0, 10));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  const addPermit = (user: { id: string; displayName: string }, level: PermitLevel) => {
    setPermits((prev) => new Map(prev).set(user.id, { ...user, level }));
    setSearch("");
    setResults([]);
  };

  const removePermit = (userId: string) => {
    setPermits((prev) => { const next = new Map(prev); next.delete(userId); return next; });
  };

  const changeLevel = (userId: string, level: PermitLevel) => {
    setPermits((prev) => {
      const next = new Map(prev);
      const entry = next.get(userId);
      if (entry) next.set(userId, { ...entry, level });
      return next;
    });
  };

  const assignedList = Array.from(permits.values());

  return (
    <div className="flex flex-col gap-2">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr("bento.multimedia.sidebar_permits_search", dictionary)}
          className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 pr-7 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500"
        />
        {isSearching ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <HiMagnifyingGlass className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        )}
      </div>

      {search.length > 0 && search.length < 3 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{tr("bento.multimedia.sidebar_permits_min_chars", dictionary)}</p>
      )}

      {/* Search results dropdown */}
      {results.length > 0 && (
        <div className="flex flex-col max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700">
          {results.map((user) => {
            const isAdded = permits.has(user.id);
            return (
              <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{user.displayName}</span>
                {isAdded ? (
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{tr("bento.multimedia.sidebar_permits_added", dictionary)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => addPermit(user, "read")}
                    className="text-sm font-medium text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer shrink-0 leading-none px-1"
                    title={tr("bento.multimedia.sidebar_permits_add_user", dictionary)}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assigned users card */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {tr("bento.multimedia.sidebar_permits_assigned", dictionary)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            {assignedList.length}
          </span>
        </div>

        {/* User list */}
        <div className="flex flex-col max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60">
          {assignedList.length > 0 ? (
            assignedList.map(({ id: uid, displayName, level }) => (
              <div key={uid} className="flex items-center gap-2 px-3 py-2 hover:bg-white dark:hover:bg-gray-800/60 transition-colors">
                {/* Avatar */}
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {displayName.charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{displayName}</span>

                {/* Permission dropdown */}
                <Dropdown
                  label={level === "edit" ? tr("bento.multimedia.sidebar_permits_lvl_edit", dictionary) : tr("bento.multimedia.sidebar_permits_lvl_read", dictionary)}
                  size="xs"
                  color="light"
                  className="shrink-0"
                >
                  <DropdownItem onClick={() => changeLevel(uid, "read")}>{tr("bento.multimedia.sidebar_permits_lvl_read", dictionary)}</DropdownItem>
                  <DropdownItem onClick={() => changeLevel(uid, "edit")}>{tr("bento.multimedia.sidebar_permits_lvl_edit", dictionary)}</DropdownItem>
                </Dropdown>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removePermit(uid)}
                  className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0"
                >
                  <HiXMark className="w-3 h-3" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-3">
              {tr("bento.multimedia.sidebar_permits_none", dictionary)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Observations section ────────────────────────────────────────────────────

export type ObservationType =
  | "value_not_visible"
  | "bad_lighting"
  | "poor_image_quality"
  | "wrong_document"
  | "incorrect_data"
  | "document_incomplete"
  | "document_expired"
  | "missing_signature"
  | "illegible_text"
  | "document_damaged"
  | "wrong_format"
  | "other";

const OBSERVATION_TYPE_KEYS: ObservationType[] = [
  "value_not_visible",
  "bad_lighting",
  "poor_image_quality",
  "wrong_document",
  "incorrect_data",
  "document_incomplete",
  "document_expired",
  "missing_signature",
  "illegible_text",
  "document_damaged",
  "wrong_format",
  "other",
];

export type ReplyEntry = {
  id: string;
  description: string;
  createdAt: Date;
  createdBy?: string;
};

export type ObservationEntry = {
  id: string;
  type: ObservationType;
  description: string;
  createdAt: Date;
  createdBy?: string;
  replies?: ReplyEntry[];
};

export type StateChangeTimelineEntry = {
  kind: "state_change";
  id: string;
  status: "approved" | "rejected" | "pending";
  committedAt: Date;
  committedBy?: string;
  observations: ObservationEntry[];
};

export type LooseObservationTimelineEntry = {
  kind: "observation";
  id: string;
  type: ObservationType;
  description: string;
  createdAt: Date;
  createdBy?: string;
  replies?: ReplyEntry[];
};

export type TimelineEntry = StateChangeTimelineEntry | LooseObservationTimelineEntry;


function relativeTime(date: Date, dictionary: I18nRecord): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return tr("bento.multimedia.obs_just_now", dictionary);
  if (mins < 60) return `${mins}${tr("bento.multimedia.obs_time_m", dictionary)}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${tr("bento.multimedia.obs_time_h", dictionary)}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}${tr("bento.multimedia.obs_time_d", dictionary)}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}${tr("bento.multimedia.obs_time_mo", dictionary)}`;
  return `${Math.floor(months / 12)}${tr("bento.multimedia.obs_time_y", dictionary)}`;
}

function ObservationCard({
  obs,
  dictionary,
  onDelete,
  onAddReply,
  onRemoveReply,
  pendingReplyRef,
}: Readonly<{
  obs: ObservationEntry;
  dictionary: I18nRecord;
  onDelete?: () => void;
  onAddReply?: (description: string) => void;
  onRemoveReply?: (replyId: string) => void;
  pendingReplyRef?: React.RefObject<{ text: string; send: () => void }>;
}>) {
  const [repliesOpen, setRepliesOpen] = useState(true);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const replyCount = (obs.replies ?? []).length;

  useEffect(() => {
    if (!pendingReplyRef || !isReplying) return;
    pendingReplyRef.current = {
      text: replyText,
      send: () => { if (replyText.trim()) { onAddReply?.(replyText.trim()); } },
    };
    return () => { pendingReplyRef.current = { text: "", send: () => {} }; };
  }, [replyText, isReplying, pendingReplyRef, onAddReply]);

  const handleReply = () => {
    if (!replyText.trim()) return;
    onAddReply?.(replyText.trim());
    setReplyText("");
    setIsReplying(false);
  };

  return (
    <div className="flex flex-col gap-1 group/card">

      {/* Header: label · name · time · delete */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 shrink-0">
          {tr(`bento.multimedia.obs_${obs.type}`, dictionary)}
        </span>
        {obs.createdBy && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{obs.createdBy}</span>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{relativeTime(obs.createdAt, dictionary)}</span>
        {onDelete && (
          <button
            type="button"
            onClick={() => setIsDeleteConfirmOpen(true)}
            title={tr("bento.multimedia.obs_delete", dictionary)}
            className="ml-auto p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0 opacity-100"
          >
            <HiTrash className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 dark:text-gray-300 wrap-break-word leading-relaxed">
        {obs.description}
      </p>

      {/* Delete confirmation modal */}
      <Modal
        dismissible
        show={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        size="sm"
        theme={{
          content: {
            base: "relative w-full p-4 md:h-auto",
            inner: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
          },
          header: {
            base: "flex items-center justify-between rounded-t border-b p-4 pb-0 dark:border-gray-600",
            title: "text-base font-semibold text-gray-900 dark:text-white",
            close: { base: "hidden" },
          },
          body: {
            base: "flex-1 overflow-auto pt-4 px-4 pb-4",
          },
        }}
      >
        <ModalHeader className="border-none">
          <span className="text-base font-semibold">{tr("bento.multimedia.obs_delete", dictionary)}</span>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {tr("bento.multimedia.obs_delete_confirm", dictionary)}
            </p>
            <div className="flex justify-end">
              <Button
                color="red"
                size="sm"
                onClick={() => { setIsDeleteConfirmOpen(false); onDelete?.(); }}
              >
                {tr("bento.multimedia.obs_delete", dictionary)}
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* Actions row: replies toggle · reply */}
      {(replyCount > 0 || onAddReply) && (
        <div className="flex items-center gap-2">
          {replyCount > 0 && (
            <button
              type="button"
              onClick={() => setRepliesOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
            >
              <HiChevronDown className={`w-3 h-3 transition-transform duration-150 ${repliesOpen ? "" : "-rotate-90"}`} />
              {replyCount} {replyCount === 1 ? tr("bento.multimedia.obs_reply_one", dictionary) : tr("bento.multimedia.obs_replies_many", dictionary)}
            </button>
          )}
          {onAddReply && (
            <button
              type="button"
              onClick={() => { setIsReplying((v) => !v); if (!isReplying) setRepliesOpen(true); }}
              className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              {tr("bento.multimedia.obs_reply", dictionary)}
            </button>
          )}
        </div>
      )}

      {/* Replies list */}
      {repliesOpen && replyCount > 0 && (
        <div className="flex flex-col gap-2 mt-0.5 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
          {(obs.replies ?? []).map((reply) => (
            <div key={reply.id} className="flex items-center gap-1.5 group/reply rounded px-1.5 py-1 -mx-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <p className="text-xs text-gray-600 dark:text-gray-300 wrap-break-word leading-relaxed">
                  {reply.description}
                </p>
                <div className="flex items-center gap-1.5">
                  {reply.createdBy && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">{reply.createdBy}</span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">{relativeTime(reply.createdAt, dictionary)}</span>
                </div>
              </div>
              {onRemoveReply && (
                <button
                  type="button"
                  onClick={() => onRemoveReply(reply.id)}
                  className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0 opacity-100"
                >
                  <HiTrash className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply form — below the replies list */}
      {isReplying && (
        <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={tr("bento.multimedia.obs_reply_placeholder", dictionary)}
            rows={2}
            autoFocus
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
          />
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={() => { setIsReplying(false); setReplyText(""); }}
              className="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
              {tr("bento.multimedia.sidebar_obs_cancel", dictionary)}
            </button>
            <button type="button" onClick={handleReply} disabled={!replyText.trim()}
              className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
              {tr("bento.multimedia.obs_reply_send", dictionary)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const STATE_CHANGE_STYLES = {
  approved: {
    border: "border-green-200 dark:border-green-800",
    header: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    label: "text-green-700 dark:text-green-300",
    key: "bento.multimedia.sidebar_obs_state_approved",
  },
  pending: {
    border: "border-amber-200 dark:border-amber-800",
    header: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    label: "text-amber-700 dark:text-amber-300",
    key: "bento.multimedia.sidebar_obs_state_pending",
  },
  rejected: {
    border: "border-red-200 dark:border-red-800",
    header: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    label: "text-red-700 dark:text-red-300",
    key: "bento.multimedia.sidebar_obs_state_rejected",
  },
} as const;

function StateChangeEntry({
  entry,
  dictionary,
  onRemoveCommitted,
  onAddReply,
  onRemoveReply,
  pendingReplyRef,
}: {
  entry: StateChangeTimelineEntry;
  dictionary: I18nRecord;
  onRemoveCommitted?: (id: string) => void;
  onAddReply?: (obsId: string, description: string) => void;
  onRemoveReply?: (obsId: string, replyId: string) => void;
  pendingReplyRef?: React.RefObject<{ text: string; send: () => void }>;
}) {
  const style = STATE_CHANGE_STYLES[entry.status];
  return (
    <div className={`shrink-0 rounded-lg border overflow-hidden ${style.border}`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${style.header}`}>
        <span className={`text-xs font-semibold ${style.label}`}>
          {tr(style.key, dictionary)}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {formatDateString(entry.committedAt.toISOString())}
        </span>
        {entry.committedBy && (
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-24" title={entry.committedBy}>
            · {entry.committedBy}
          </span>
        )}
      </div>
      {entry.observations.length > 0 ? (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {entry.observations.map((obs) => (
            <div key={obs.id} className="px-3 py-2.5">
              <ObservationCard
                obs={obs}
                dictionary={dictionary}
                onDelete={onRemoveCommitted ? () => onRemoveCommitted(obs.id) : undefined}
                onAddReply={onAddReply ? (desc) => onAddReply(obs.id, desc) : undefined}
                onRemoveReply={onRemoveReply ? (rid) => onRemoveReply(obs.id, rid) : undefined}
                pendingReplyRef={pendingReplyRef}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2.5 italic">
          {tr("bento.multimedia.sidebar_obs_none_in_container", dictionary)}
        </p>
      )}
    </div>
  );
}

function LooseObservationEntry({
  entry,
  dictionary,
  onRemoveCommitted,
  onAddReply,
  onRemoveReply,
  pendingReplyRef,
}: {
  entry: LooseObservationTimelineEntry;
  dictionary: I18nRecord;
  onRemoveCommitted?: (id: string) => void;
  onAddReply?: (obsId: string, description: string) => void;
  onRemoveReply?: (obsId: string, replyId: string) => void;
  pendingReplyRef?: React.RefObject<{ text: string; send: () => void }>;
}) {
  return (
    <div className="shrink-0 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
      <ObservationCard
        obs={{ id: entry.id, type: entry.type, description: entry.description, createdAt: entry.createdAt, createdBy: entry.createdBy, replies: entry.replies }}
        dictionary={dictionary}
        onDelete={onRemoveCommitted ? () => onRemoveCommitted(entry.id) : undefined}
        onAddReply={onAddReply ? (desc) => onAddReply(entry.id, desc) : undefined}
        onRemoveReply={onRemoveReply ? (rid) => onRemoveReply(entry.id, rid) : undefined}
        pendingReplyRef={pendingReplyRef}
      />
    </div>
  );
}

function ObservationsSection({
  dictionary,
  draftObservations,
  committedTimeline,
  isInDraftReview,
  onAdd,
  onRemoveDraft,
  onRemoveCommitted,
  onAddReply,
  onRemoveReply,
  pendingReplyRef,
  mode = "full",
  onShowAll,
}: Readonly<{
  dictionary: I18nRecord;
  draftObservations: ObservationEntry[];
  committedTimeline: TimelineEntry[];
  isInDraftReview: boolean;
  onAdd: (type: ObservationType, description: string) => void;
  onRemoveDraft: (id: string) => void;
  onRemoveCommitted?: (id: string) => void;
  onAddReply?: (obsId: string, description: string) => void;
  onRemoveReply?: (obsId: string, replyId: string) => void;
  pendingReplyRef?: React.RefObject<{ text: string; send: () => void }>;
  mode?: "preview" | "full";
  onShowAll?: () => void;
}>) {
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<ObservationType>("value_not_visible");
  const [newDescription, setNewDescription] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingReplyRef || !isAdding) return;
    pendingReplyRef.current = {
      text: newDescription,
      send: () => { if (newDescription.trim()) { onAdd(newType, newDescription.trim()); } },
    };
    return () => { pendingReplyRef.current = { text: "", send: () => {} }; };
  }, [newDescription, isAdding, pendingReplyRef, onAdd, newType]);

  const handleAdd = () => {
    if (!newDescription.trim()) return;
    onAdd(newType, newDescription.trim());
    setNewDescription("");
    setNewType("value_not_visible");
    setIsAdding(false);
  };

  const allEntries = useMemo(() => [...committedTimeline].reverse(), [committedTimeline]);
  const hasContent = allEntries.length > 0 || draftObservations.length > 0;

  // Preview mode: show last 3 entries
  const PREVIEW_LIMIT = 3;
  const isPreview = mode === "preview";
  const displayEntries = isPreview ? allEntries.slice(0, PREVIEW_LIMIT) : allEntries.slice(0, visibleCount);
  const hasMore = isPreview ? allEntries.length > PREVIEW_LIMIT : visibleCount < allEntries.length;

  // Infinite scroll for full mode
  useEffect(() => {
    if (isPreview || !scrollSentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && visibleCount < allEntries.length) {
          setVisibleCount((prev) => Math.min(prev + 10, allEntries.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(scrollSentinelRef.current);
    return () => observer.disconnect();
  }, [isPreview, visibleCount, allEntries.length]);

  const renderEntry = (entry: TimelineEntry) => {
    if (entry.kind === "state_change") {
      return (
        <StateChangeEntry
          key={entry.id}
          entry={entry}
          dictionary={dictionary}
          onRemoveCommitted={onRemoveCommitted}
          onAddReply={onAddReply}
          onRemoveReply={onRemoveReply}
          pendingReplyRef={pendingReplyRef}
        />
      );
    }
    return (
      <LooseObservationEntry
        key={entry.id}
        entry={entry}
        dictionary={dictionary}
        onRemoveCommitted={onRemoveCommitted}
        onAddReply={onAddReply}
        onRemoveReply={onRemoveReply}
        pendingReplyRef={pendingReplyRef}
      />
    );
  };

  const showEmpty = !hasContent && !isAdding;

  return (
    <div className="flex flex-col gap-2">

      {/* New observation form — fixed at top */}
      {isAdding ? (
        <div className="flex-shrink-0 flex flex-col gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10 p-3">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as ObservationType)}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 cursor-pointer"
          >
            {OBSERVATION_TYPE_KEYS.map((key) => (
              <option key={key} value={key}>{tr(`bento.multimedia.obs_${key}`, dictionary)}</option>
            ))}
          </select>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder={tr("bento.multimedia.sidebar_obs_placeholder", dictionary)}
            rows={3}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setNewDescription(""); }}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              {tr("bento.multimedia.sidebar_obs_cancel", dictionary)}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newDescription.trim()}
              className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {tr("bento.multimedia.sidebar_obs_add_btn", dictionary)}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex-shrink-0 w-full text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 border border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 rounded-lg py-2 transition-colors cursor-pointer"
        >
          {tr("bento.multimedia.sidebar_obs_add", dictionary)}
        </button>
      )}

      {/* Timeline entries */}
      {hasContent && (
        <div className="flex flex-col gap-2">
          {displayEntries.map(renderEntry)}

          {/* Draft observations visible while in review */}
          {isInDraftReview && draftObservations.map((obs) => (
            <div key={obs.id} className="shrink-0 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30">
              <ObservationCard
                obs={obs}
                dictionary={dictionary}
                onDelete={() => onRemoveDraft(obs.id)}
                onAddReply={onAddReply ? (desc) => onAddReply(obs.id, desc) : undefined}
                onRemoveReply={onRemoveReply ? (rid) => onRemoveReply(obs.id, rid) : undefined}
                pendingReplyRef={pendingReplyRef}
              />
            </div>
          ))}

          {/* Preview: "Show all" button */}
          {isPreview && hasMore && (
            <button
              type="button"
              onClick={() => onShowAll?.()}
              className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium py-2 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
            >
              {tr("bento.multimedia.sidebar_obs_show_all", dictionary)} ({allEntries.length})
            </button>
          )}

          {/* Full mode: infinite scroll sentinel */}
          {!isPreview && hasMore && (
            <div ref={scrollSentinelRef} className="flex justify-center py-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {showEmpty && (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-1 py-1">{tr("bento.multimedia.sidebar_obs_empty", dictionary)}</p>
      )}
    </div>
  );
}

// ─── Category dropdown ────────────────────────────────────────────────────────

function CategoryDropdown({
  categories,
  currentTag,
  onCategoryChange,
  dictionary,
  fullWidth = false,
}: Readonly<{
  categories: { value: string; label: string }[];
  currentTag: string | null;
  onCategoryChange: (category: string) => void;
  dictionary: I18nRecord;
  fullWidth?: boolean;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = categories.find((c) => c.value === currentTag) ?? null;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div ref={ref} className={`relative ${fullWidth ? "w-full" : "shrink min-w-0 sm:shrink-0"}`}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold rounded-lg border px-2 sm:px-3 py-1 sm:py-1.5 transition-all duration-150 cursor-pointer ${fullWidth ? "w-full" : "max-w-full"} ${
          current
            ? "text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            : "text-gray-500 dark:text-gray-400 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
        }`}
      >
        <span className="truncate flex-1 text-left">
          {current?.label ?? tr("bento.multimedia.select_document_type", dictionary)}
        </span>
        <HiChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-max rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl overflow-hidden">
          <div className="p-1 flex flex-col gap-0.5">
            {categories.map((cat) => {
              const isSelected = cat.value === currentTag;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => { onCategoryChange(cat.value); setIsOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="flex-1">{cat.label}</span>
                  {isSelected && <HiCheck className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Review split button ──────────────────────────────────────────────────────

type ReviewAction = {
  label: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
};

function ReviewSplitButton({
  primary,
  secondaryActions,
}: Readonly<{
  primary: ReviewAction;
  secondaryActions: ReviewAction[];
}>) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const baseSecondary =
    "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 transition-colors cursor-pointer h-full";

  return (
    <div className="flex items-stretch ml-1 h-7 sm:h-9">
      {secondaryActions.length === 1 && (
        <Button
          color="alternative"
          onClick={secondaryActions[0].onClick}
          className={`${baseSecondary} rounded-lg rounded-r-none `}
        >
          {secondaryActions[0].icon}
          {secondaryActions[0].label}
        </Button>
      )}
      {secondaryActions.length > 1 && (
        <div ref={dropdownRef} className="relative">
          <Button
            type="button"
            onClick={() => setDropdownOpen((p) => !p)}
            className={`${baseSecondary} rounded-lg rounded-r-none px-2.5 hover:bg-gray-50 dark:hover:bg-gray-700`}
          >
            <HiChevronDown
              className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
          {dropdownOpen && (
            <div className="absolute top-full mt-1 left-0 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
              {secondaryActions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    action.onClick();
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        color="blue"
        type="button"
        onClick={primary.onClick}
        className={`flex items-center h-full gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer ${
          secondaryActions.length > 0 ? "rounded-lg rounded-l-none" : "rounded-lg"
        } `}
      >
        {primary.icon}
        {primary.label}
      </Button>
    </div>
  );
}

// ─── Move to task modal ───────────────────────────────────────────────────────

function MoveToTaskModal({
  show,
  onClose,
  fileName,
  nodeId,
  currentTaskServiceCode,
  onMoved,
  dictionary,
}: Readonly<{
  show: boolean;
  onClose: () => void;
  fileName: string;
  nodeId?: string;
  currentTaskServiceCode?: string;
  onMoved?: () => void;
  dictionary: I18nRecord;
}>) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<KanbanBoardTask | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      setSearch("");
      setDebouncedSearch("");
      setSelectedTask(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useSearchTasks(debouncedSearch.length >= 2 ? debouncedSearch : null);

  const tasks: KanbanBoardTask[] = data
    ? Object.values(data.data).flatMap((board) => board.tasks)
    : [];

  const handleMove = () => {
    if (!selectedTask || !nodeId) return;
    const movePromise = moveBentoFile(nodeId, selectedTask.id).then((res) => {
      onMoved?.();
      onClose();
      return res;
    });
    toast.promise(movePromise, {
      loading: tr("bento.multimedia.move_loading", dictionary),
      success: `"${fileName}" ${tr("bento.multimedia.move_success", dictionary)} ${selectedTask.name}`,
      error: tr("bento.multimedia.move_error", dictionary),
    });
  };

  return (
    <Modal
      dismissible
      show={show}
      onClose={onClose}
      size="lg"
      theme={{
        content: {
          base: "relative w-full p-4 md:h-auto",
          inner: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
        },
        header: {
          base: "flex items-center justify-between rounded-t border-b pt-5 px-5 pb-0 dark:border-gray-600",
          title: "text-base font-semibold text-gray-900 dark:text-white",
          close: { base: "hidden" },
        },
        body: {
          base: "flex-1 overflow-auto px-5 pb-5",
        },
      }}
    >
      <ModalHeader className="border-none">
        <div className="flex flex-col">
          <span className="text-base font-semibold">{tr("bento.multimedia.move_modal_title", dictionary)}</span>
          <span className="text-sm text-gray-500 mt-1 font-normal">
            {tr("bento.multimedia.move_modal_desc", dictionary)}
          </span>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-3">
          {/* Search input */}
          <div className="relative">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr("bento.multimedia.move_search_placeholder", dictionary)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Results list */}
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {debouncedSearch.length < 2 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                {tr("bento.multimedia.move_search_hint", dictionary)}
              </p>
            ) : !isLoading && tasks.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                {tr("bento.multimedia.move_no_results", dictionary)}
              </p>
            ) : (
              tasks.map((task) => {
                const isCurrent = !!currentTaskServiceCode && (
                  task.mintral_serviceCode === currentTaskServiceCode ||
                  task.name === currentTaskServiceCode ||
                  task.name.startsWith(currentTaskServiceCode + "-") ||
                  task.name.startsWith(currentTaskServiceCode + " ")
                );
                const isSelected = selectedTask?.id === task.id;
                return (
                  <button
                    key={task.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => !isCurrent && setSelectedTask(isSelected ? null : task)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                      isCurrent
                        ? "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 opacity-50 cursor-not-allowed"
                        : isSelected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-pointer"
                          : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {task.name}
                    </span>
                    {isCurrent
                      ? <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 whitespace-nowrap">{tr("bento.multimedia.move_file_here", dictionary)}</span>
                      : isSelected && <HiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    }
                  </button>
                );
              })
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button color="alternative" onClick={onClose}>
              {tr("bento.multimedia.btn_cancel", dictionary)}
            </Button>
            <Button color="blue" disabled={!selectedTask} onClick={handleMove}>
              {tr("bento.multimedia.btn_move", dictionary)}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
