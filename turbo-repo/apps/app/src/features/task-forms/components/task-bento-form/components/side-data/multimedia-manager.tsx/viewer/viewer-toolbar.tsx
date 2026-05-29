"use client";

import { Dropdown, DropdownItem, Tooltip } from "flowbite-react";
import {
  HiChevronDown,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiXMark,
  HiCheck,
  HiArrowDownTray,
  HiPencilSquare,
  HiArrowsRightLeft,
  HiTrash,
} from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SplitButton } from "@/features/common/components/split-button";
import { SharePopover } from "./header";
import type { ReviewStatus } from "../gallery/media-row";

export default function ViewerToolbar({
  fileUrl,
  fileName,
  currentIndex,
  totalItems,
  status,
  draftDecision,
  onPrev,
  onNext,
  onDownload,
  onEdit,
  onMove,
  onDelete,
  onDecision,
  onClose,
  dictionary,
}: Readonly<{
  fileUrl: string;
  fileName: string;
  currentIndex: number;
  totalItems: number;
  status: ReviewStatus;
  draftDecision: ReviewStatus | null;
  onPrev: () => void;
  onNext: () => void;
  onDownload: () => void;
  onEdit?: () => void;
  onMove: () => void;
  onDelete?: () => void;
  onDecision: (decision: ReviewStatus) => void;
  onClose: () => void;
  dictionary: I18nRecord;
}>) {
  return (
    <div className="hidden sm:flex items-center gap-1 xl:gap-1.5 shrink-0">
      <SharePopover fileUrl={fileUrl} fileName={fileName} dictionary={dictionary} />
      <Tooltip content={tr("bento.multimedia.viewer_download", dictionary)} placement="bottom">
        <button
          type="button"
          onClick={onDownload}
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
              onClick={onEdit}
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
            onClick={onMove}
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
            onClick={onDelete}
            className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-colors cursor-pointer group"
          >
            <HiTrash className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
          </button>
        </Tooltip>
      )}

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />

      {/* Navigation */}
      <button
        type="button"
        disabled={currentIndex === 0}
        onClick={onPrev}
        className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label={tr("bento.multimedia.viewer_prev", dictionary)}
      >
        <HiOutlineChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </button>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums px-1 min-w-8 xl:min-w-10 text-center">
        {currentIndex + 1}/{totalItems}
      </span>
      <button
        type="button"
        disabled={currentIndex === totalItems - 1}
        onClick={onNext}
        className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label={tr("bento.multimedia.viewer_next", dictionary)}
      >
        <HiOutlineChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </button>

      {/* Review actions */}
      {status !== "approved" && (
        <SplitButton
          primary={{
            id: "approve",
            label: <span className="hidden lg:hidden xl:inline">{tr("bento.multimedia.btn_approve", dictionary)}</span>,
            icon: <HiCheck className="w-4 h-4" />,
            onClick: () => onDecision("approved"),
          }}
          secondaryActions={[
            {
              id: "reject",
              label: <span className="hidden lg:hidden xl:inline">{tr("bento.multimedia.btn_reject", dictionary)}</span>,
              icon: <HiXMark className="w-4 h-4" />,
              onClick: () => onDecision("rejected"),
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
  );
}
