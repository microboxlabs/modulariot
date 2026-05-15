"use client";

import { Button, Dropdown, DropdownItem, Modal, ModalHeader, ModalBody, Tooltip } from "flowbite-react";
import { useState, useEffect, useRef, type ReactNode } from "react";
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
} from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { getCategories } from "./clasification-form";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { AlfrescoFileEntry } from "./image.types";
import { ReviewStatus } from "./media-row";
import { downloadImage } from "@/features/geographic-view/utils/download-image";
import { renameBentoFile, updateBentoCategory, useSearchTasks } from "@/features/common/providers/client-api.provider";
import type { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { toast } from "sonner";
import { HiPrinter } from "react-icons/hi";

export type MediaViewerItem = {
  type: "image" | "document";
  file: AlfrescoFileEntry;
  refreshKey?: number;
};

type PermitLevel = "read" | "edit";
type PermitEntry = { id: string; displayName: string; level: PermitLevel };

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
  dictionary,
}: {
  items: MediaViewerItem[];
  initialIndex?: number;
  onClose: () => void;
  reviewStatuses?: Map<string, ReviewStatus>;
  draftDecisions?: Map<string, ReviewStatus>;
  onStatusChange?: (id: string, status: ReviewStatus) => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  onRename?: () => void;
  currentTaskServiceCode?: string;
  dictionary: I18nRecord;
}) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, items.length - 1))
  );
  const [docBlobUrls, setDocBlobUrls] = useState<Record<string, string>>({});
  const [loadingDocs, setLoadingDocs] = useState<Set<string>>(new Set());
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsEditingName(false);
    setEditedName(items[currentIndex]?.file?.entry?.name ?? "");
  }, [currentIndex, items]);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.select();
  }, [isEditingName]);
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shareOpen]);

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
    const promise = updateBentoCategory(id, newCategory);
    toast.promise(promise, {
      loading: tr("bento.multimedia.category_change_loading", dictionary),
      success: tr("bento.multimedia.category_change_success", dictionary),
      error: () => {
        setCurrentCategory(prev);
        return tr("bento.multimedia.category_change_error", dictionary);
      },
    });
  };

  // Fetch PDF blob when navigating to a document
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

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(docBlobUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  const categories = getCategories(dictionary);
  const categoryLabel = categories[currentCategory as keyof typeof categories]?.label;
  const status: ReviewStatus = id ? (reviewStatuses?.get(id) ?? "pending") : "pending";

  const handleDecision = (decision: ReviewStatus) => {
    if (!id) return;
    onStatusChange?.(id, decision);

    const updatedDrafts = new Map(draftDecisions ?? new Map());
    updatedDrafts.set(id, decision);

    const findNextUndecided = (): number | null => {
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
    };

    const nextIndex = findNextUndecided();
    if (nextIndex !== null) {
      setCurrentIndex(nextIndex);
    } else {
      onClose();
    }
  };

  const fileUrl = id ? `/app/api/bento/content?nodeId=${id}` : "";
  const fullUrl = id ? `${window.location.origin}${fileUrl}` : "";

  const shareCopyLink = async () => {
    await navigator.clipboard.writeText(fullUrl);
    toast.success(tr("bento.multimedia.viewer_link_copied", dictionary));
    setShareOpen(false);
  };

  const shareByEmail = () => {
    const subject = encodeURIComponent(current.file.entry.name);
    const body = encodeURIComponent(`${current.file.entry.name}\n\n${fullUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    setShareOpen(false);
  };

  const shareOpenTab = () => {
    window.open(fileUrl, "_blank");
    setShareOpen(false);
  };

  const handleDownload = () => {
    if (!id) return;
    const url = `/app/api/bento/content?nodeId=${id}`;
    downloadImage(url, dictionary, current.file.entry.name).catch(() => {});
  };

  const imageUrl =
    current.type === "image"
      ? `/app/api/bento/content?nodeId=${id}${current.refreshKey ? `&r=${current.refreshKey}` : ""}`
      : null;
  const docUrl = current.type === "document" && id ? docBlobUrls[id] : null;
  const isDocLoading =
    current.type === "document" && id ? loadingDocs.has(id) : false;

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        {/* Left: file metadata */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={() => {
                const trimmed = editedName.trim();
                const original = current.file.entry.name;
                if (trimmed && trimmed !== original && id) {
                  const renamePromise = renameBentoFile(id, trimmed);
                  toast.promise(renamePromise, {
                    loading: tr("bento.multimedia.rename_loading", dictionary),
                    success: tr("bento.multimedia.rename_success", dictionary),
                    error: tr("bento.multimedia.rename_error", dictionary),
                  });
                  renamePromise.then(() => onRename?.()).catch(() => {
                    setEditedName(original);
                  });
                } else {
                  setEditedName(original);
                }
                setIsEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") nameInputRef.current?.blur();
                if (e.key === "Escape") {
                  setEditedName(current.file.entry.name);
                  setIsEditingName(false);
                }
              }}
              className="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-blue-500 dark:border-blue-400 outline-none min-w-0 w-48 max-w-full"
            />
          ) : (
            <span
              title={tr("bento.multimedia.viewer_click_rename", dictionary)}
              onClick={() => setIsEditingName(true)}
              className="text-sm font-medium text-gray-900 dark:text-white truncate cursor-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {editedName || current.file.entry.name}
            </span>
          )}
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
            className={`text-xs rounded-full px-2 py-0.5 shrink-0 font-medium ${
              status === "approved"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : status === "rejected"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            }`}
          >
            {tr(`bento.multimedia.status_${status}`, dictionary)}
          </span>
          {id && draftDecisions?.has(id) && (
            <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 font-medium border ${
              draftDecisions.get(id) === "approved"
                ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                : "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            }`}>
              → {tr(draftDecisions.get(id) === "approved" ? "bento.multimedia.draft_will_approve" : "bento.multimedia.draft_will_reject", dictionary)}
            </span>
          )}
        </div>

        {/* Right: actions + counter + nav + approve/close */}
        <div className="flex items-center gap-1 xl:gap-1.5 shrink-0">
          {/* Share popover */}
          <div ref={shareRef} className="relative">
            <Tooltip content={tr("bento.multimedia.viewer_share", dictionary)} placement="bottom">
              <button
                type="button"
                onClick={() => setShareOpen((p) => !p)}
                className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <HiShare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </Tooltip>
            {shareOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={shareCopyLink}
                  className="w-full flex items-center whitespace-nowrap gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <HiLink className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  {tr("bento.multimedia.viewer_copy_link", dictionary)}
                </button>
                <button
                  type="button"
                  onClick={shareByEmail}
                  className="w-full flex items-center whitespace-nowrap gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <HiEnvelope className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  {tr("bento.multimedia.viewer_share_email", dictionary)}
                </button>
                <button
                  type="button"
                  onClick={shareOpenTab}
                  className="w-full flex items-center whitespace-nowrap gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <HiArrowTopRightOnSquare className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  {tr("bento.multimedia.viewer_open_new_tab", dictionary)}
                </button>
              </div>
            )}
          </div>
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
          {(() => {
            const draft = id ? (draftDecisions?.get(id) ?? null) : null;
            return (
              <ReviewSplitButton
                primary={{
                  label: <span className="inline lg:hidden xl:inline">{tr("bento.multimedia.btn_approve", dictionary)}</span>,
                  icon: <HiCheck className="w-4 h-4" />,
                  onClick: () => handleDecision("approved"),
                  isActive: draft === "approved",
                }}
                secondaryActions={[
                  {
                    label: <span className="inline lg:hidden xl:inline">{tr("bento.multimedia.btn_reject", dictionary)}</span>,
                    icon: <HiXMark className="w-4 h-4" />,
                    onClick: () => handleDecision("rejected"),
                    isActive: draft === "rejected",
                  },
                ]}
              />
            );
          })()}

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0 cursor-pointer"
            aria-label={tr("bento.multimedia.viewer_close", dictionary)}
          >
            <HiXMark className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Media area */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 overflow-hidden">
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
          className="shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto flex flex-col"
          style={{ width: "33.333%" }}
        >
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
            </dl>
          </SidebarSection>
          <SidebarSection title={tr("bento.multimedia.sidebar_permits", dictionary)}>
            <PermitsSection dictionary={dictionary} />
          </SidebarSection>
          <SidebarSection title={tr("bento.multimedia.sidebar_observations", dictionary)}>
            <ObservationsSection dictionary={dictionary} />
          </SidebarSection>
        </div>
      </div>
      {/* Move to task modal */}
      <MoveToTaskModal
        show={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        fileName={current.file.entry.name}
        currentTaskServiceCode={currentTaskServiceCode}
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
    </div>
  );
}

// ─── Sidebar primitives ──────────────────────────────────────────────────────

function SidebarSection({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
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
        <div className="px-3 pb-3 pt-1">{children}</div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className="text-xs text-gray-700 dark:text-gray-200 wrap-break-word">{value}</dd>
    </div>
  );
}

// ─── Permits section ─────────────────────────────────────────────────────────

function PermitsSection({ dictionary }: { dictionary: I18nRecord }) {
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
                    title="Add user"
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

type ObservationType =
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

const OBSERVATION_LABELS: Record<ObservationType, string> = {
  value_not_visible: "Value not visible",
  bad_lighting: "Bad lighting",
  poor_image_quality: "Poor image quality",
  wrong_document: "Wrong document",
  incorrect_data: "Incorrect data",
  document_incomplete: "Document incomplete",
  document_expired: "Document expired",
  missing_signature: "Missing signature",
  illegible_text: "Illegible text",
  document_damaged: "Document damaged",
  wrong_format: "Wrong format",
  other: "Other",
};

type ObservationEntry = {
  id: string;
  type: ObservationType;
  description: string;
  createdAt: Date;
};

const MOCK_OBSERVATIONS: ObservationEntry[] = [];

function ObservationsSection({ dictionary }: { dictionary: I18nRecord }) {
  const [observations, setObservations] = useState<ObservationEntry[]>(MOCK_OBSERVATIONS);
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<ObservationType>("value_not_visible");
  const [newDescription, setNewDescription] = useState("");

  const handleAdd = () => {
    if (!newDescription.trim()) return;
    setObservations((prev) => [
      ...prev,
      { id: `obs-${Date.now()}`, type: newType, description: newDescription.trim(), createdAt: new Date() },
    ]);
    setNewDescription("");
    setNewType("value_not_visible");
    setIsAdding(false);
  };

  const handleRemove = (id: string) => {
    setObservations((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Observation list card */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{tr("bento.multimedia.sidebar_observations", dictionary)}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{observations.length}</span>
        </div>
        <div className="flex flex-col max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60">
          {observations.length > 0 ? (
            observations.map((obs) => (
              <div key={obs.id} className="flex items-start gap-2 px-3 py-2.5 hover:bg-white dark:hover:bg-gray-800/60 transition-colors group/obs">
                <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    {tr(`bento.multimedia.obs_${obs.type}`, dictionary)}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 wrap-break-word">{obs.description}</p>
                  <span className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">
                    {formatDateString(obs.createdAt.toISOString())}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(obs.id)}
                  className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0 opacity-0 group-hover/obs:opacity-100"
                >
                  <HiXMark className="w-3 h-3" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-3">{tr("bento.multimedia.sidebar_obs_empty", dictionary)}</p>
          )}
        </div>
      </div>

      {/* New observation form */}
      {isAdding ? (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10 p-3">
          {/* Type select */}
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as ObservationType)}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 cursor-pointer"
          >
            {(Object.keys(OBSERVATION_LABELS) as ObservationType[]).map((key) => (
              <option key={key} value={key}>{tr(`bento.multimedia.obs_${key}`, dictionary)}</option>
            ))}
          </select>

          {/* Description textarea */}
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder={tr("bento.multimedia.sidebar_obs_placeholder", dictionary)}
            rows={3}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 resize-none"
          />

          {/* Actions */}
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
          className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 border border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 rounded-lg py-2 transition-colors cursor-pointer"
        >
          {tr("bento.multimedia.sidebar_obs_add", dictionary)}
        </button>
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
}: {
  categories: { value: string; label: string }[];
  currentTag: string | null;
  onCategoryChange: (category: string) => void;
  dictionary: I18nRecord;
}) {
  const current = categories.find((c) => c.value === currentTag) ?? null;

  return (
    <Dropdown
      theme={{
        floating: {
          base: "z-50 w-52 rounded-lg overflow-hidden",
          style: {
            auto: "border border-gray-200 dark:border-gray-500 bg-white text-gray-900 dark:bg-gray-700 dark:text-white shadow-lg",
          },
          item: {
            base: "flex items-center gap-2 px-3 py-2 text-xs cursor-pointer w-full text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-600",
            container: "w-full",
          },
        },
      }}
      renderTrigger={() => (
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer shrink-0"
        >
          <span>{current?.label ?? tr("bento.multimedia.select_document_type", dictionary)}</span>
          <HiChevronDown className="w-3 h-3" />
        </button>
      )}
      label=""
    >
      {categories.map((cat) => (
        <DropdownItem
          key={cat.value}
          onClick={() => onCategoryChange(cat.value)}
          className={cat.value === currentTag ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : ""}
          icon={cat.value === currentTag ? () => <HiCheck className="w-3 h-3 shrink-0" /> : undefined}
        >
          {cat.label}
        </DropdownItem>
      ))}
    </Dropdown>
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
}: {
  primary: ReviewAction;
  secondaryActions: ReviewAction[];
}) {
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
    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 transition-colors cursor-pointer h-full";

  return (
    <div className="flex items-stretch ml-1 h-9">
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
        className={`flex items-center h-full gap-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer ${
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
  currentTaskServiceCode,
  dictionary,
}: {
  show: boolean;
  onClose: () => void;
  fileName: string;
  currentTaskServiceCode?: string;
  dictionary: I18nRecord;
}) {
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
    if (!selectedTask) return;
    toast.success(`"${fileName}" ${tr("bento.multimedia.move_success", dictionary)} ${selectedTask.name}`);
    onClose();
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
