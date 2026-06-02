"use client";

import { Dropdown, DropdownItem } from "flowbite-react";
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
  HiTrash,
} from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import EditableField from "@/features/common/components/editable-field/editable-field";
import SelectorDropdown from "@/features/common/components/custom-dropdown/selector-dropdown";
import type { ReviewStatus } from "../gallery/media-row";

export default function MobileHeader({
  fileName,
  currentIndex,
  totalItems,
  status,
  draftDecision,
  isReviewable,
  categories,
  currentCategory,
  onCategoryChange,
  onPrev,
  onNext,
  onDownload,
  onEdit,
  onMove,
  onDelete,
  onDecision,
  onClose,
  onRename,
  dictionary,
}: Readonly<{
  fileName: string;
  currentIndex: number;
  totalItems: number;
  status: ReviewStatus;
  draftDecision: ReviewStatus | null;
  isReviewable: boolean;
  categories: { value: string; label: string }[];
  currentCategory: string | null;
  onCategoryChange: (category: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onDownload: () => void;
  onEdit?: () => void;
  onMove: () => void;
  onDelete?: () => void;
  onDecision: (decision: ReviewStatus) => void;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  dictionary: I18nRecord;
}>) {
  return (
    <>
      {/* Row 1 — nav + file name + close */}
      <div className="flex items-center gap-1.5 sm:hidden">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={onPrev}
          className="p-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          aria-label={tr("bento.multimedia.viewer_prev", dictionary)}
        >
          <HiOutlineChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
          {currentIndex + 1}/{totalItems}
        </span>
        <button
          type="button"
          disabled={currentIndex === totalItems - 1}
          onClick={onNext}
          className="p-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          aria-label={tr("bento.multimedia.viewer_next", dictionary)}
        >
          <HiOutlineChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="min-w-0 flex-1">
          <EditableField
            taskId=""
            fieldName="name"
            value={fileName}
            type="text"
            variant="inline"
            onSave={onRename}
            inputClassName="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-blue-500 dark:border-blue-400 outline-none min-w-0 w-full"
            displayClassName="block text-sm font-medium text-gray-900 dark:text-white truncate transition-colors cursor-text hover:text-blue-600 dark:hover:text-blue-400"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0 cursor-pointer"
          aria-label={tr("bento.multimedia.viewer_close", dictionary)}
        >
          <HiXMark className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Row 2 — action icons */}
      <div className="flex items-center gap-1 sm:hidden">
        <button
          type="button"
          onClick={onDownload}
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
            onClick={onEdit}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            aria-label={tr("bento.multimedia.viewer_replace", dictionary)}
          >
            <HiPencilSquare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        )}
        <button
          type="button"
          onClick={onMove}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          aria-label={tr("bento.multimedia.viewer_move", dictionary)}
        >
          <HiArrowsRightLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-colors cursor-pointer group"
            aria-label={tr("bento.multimedia.viewer_delete", dictionary)}
          >
            <HiTrash className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
          </button>
        )}
      </div>

      {/* Row 3 — category dropdown full width */}
      <div className="py-1 sm:hidden">
        <SelectorDropdown
          categories={categories}
          baseCategory={currentCategory}
          selectCategory={onCategoryChange}
          dictionary={dictionary}
        />
      </div>

      {/* Row 4 — approve/reject full width (only for reviewable content) */}
      {isReviewable && (
      <div className="flex items-center gap-2 sm:hidden">
        {status !== "approved" && (
          <>
            <button
              type="button"
              onClick={() => onDecision("rejected")}
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
              onClick={() => onDecision("approved")}
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
              <DropdownItem onClick={() => onDecision("approved")}>
                {tr("bento.multimedia.btn_no_change", dictionary)}
              </DropdownItem>
            )}
            <DropdownItem onClick={() => onDecision("rejected")}>
              {tr("bento.multimedia.btn_reject", dictionary)}
            </DropdownItem>
            <DropdownItem onClick={() => onDecision("pending")}>
              {tr("bento.multimedia.btn_back_to_review", dictionary)}
            </DropdownItem>
          </Dropdown>
        )}
      </div>
      )}
    </>
  );
}
