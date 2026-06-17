"use client";

import { useState, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, Dropdown, DropdownItem, Tooltip } from "flowbite-react";
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
import SplitButton from "@/features/common/components/split-button/split-button";
import { SharePopover } from "./header/share-popover";
import SelectorDropdown from "@/features/common/components/custom-dropdown/selector-dropdown";
import type { ReviewStatus } from "../gallery/media-row";

// Portal tooltip — escapes overflow:hidden and CSS transform ancestors
function PortalTooltip({ content, children }: { content?: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  if (!content) return <>{children}</>;

  return (
    <>
      <div
        ref={ref}
        className="w-full"
        onMouseEnter={() => {
          if (!ref.current) return;
          const r = ref.current.getBoundingClientRect();
          setPos({ top: r.top + r.height / 2, left: r.left - 8 });
        }}
        onMouseLeave={() => setPos(null)}
      >
        {children}
      </div>
      {pos && createPortal(
        <div
          role="tooltip"
          style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translate(-100%, -50%)", zIndex: 9999 }}
          className="relative px-3 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-sm pointer-events-none whitespace-nowrap"
        >
          {content}
          <div className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 translate-x-1/2 rotate-45 bg-gray-900 dark:bg-gray-700" />
        </div>,
        document.body
      )}
    </>
  );
}

export default function ViewerToolbar({
  fileUrl,
  fileName,
  currentIndex,
  totalItems,
  status,
  draftDecision,
  isReviewable,
  onPrev,
  onNext,
  onDownload,
  onEdit,
  onMove,
  onDelete,
  onDecision,
  onClose,
  categories,
  currentCategory,
  onCategoryChange,
  canReject = true,
  dictionary,
}: Readonly<{
  fileUrl: string;
  fileName: string;
  currentIndex: number;
  totalItems: number;
  status: ReviewStatus;
  draftDecision: ReviewStatus | null;
  isReviewable: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDownload: () => void;
  onEdit?: () => void;
  onMove: () => void;
  onDelete?: () => void;
  onDecision: (decision: ReviewStatus) => void;
  onClose: () => void;
  categories: { value: string; label: string }[];
  currentCategory: string | null;
  onCategoryChange: (category: string) => void;
  canReject?: boolean;
  dictionary: I18nRecord;
}>) {
  return (
    <div className="hidden sm:flex items-center gap-1 xl:gap-1.5 shrink-0">
      <SharePopover fileUrl={fileUrl} fileName={fileName} dictionary={dictionary} />

      <Tooltip content={tr("bento.multimedia.viewer_download", dictionary)} placement="bottom">
        <Button color="light" size="sm" onClick={onDownload} className="p-2!">
          <HiArrowDownTray className="w-4 h-4" />
        </Button>
      </Tooltip>

      {onEdit && (
        <div className="inline-flex lg:hidden xl:inline-flex">
          <Tooltip content={tr("bento.multimedia.viewer_replace", dictionary)} placement="bottom">
            <Button color="light" size="sm" onClick={onEdit} className="p-2!">
              <HiPencilSquare className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      )}

      <div className="inline-flex lg:hidden xl:inline-flex">
        <Tooltip content={tr("bento.multimedia.viewer_move", dictionary)} placement="bottom">
          <Button color="light" size="sm" onClick={onMove} className="p-2!">
            <HiArrowsRightLeft className="w-4 h-4" />
          </Button>
        </Tooltip>
      </div>

      {onDelete && (
        <Tooltip content={tr("bento.multimedia.viewer_delete", dictionary)} placement="bottom">
          <Button color="light" size="sm" onClick={onDelete} className="p-2! hover:text-red-500 hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
            <HiTrash className="w-4 h-4" />
          </Button>
        </Tooltip>
      )}

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />

      {/* Navigation */}
      <Button color="light" size="sm" disabled={currentIndex === 0} onClick={onPrev} aria-label={tr("bento.multimedia.viewer_prev", dictionary)} className="p-2!">
        <HiOutlineChevronLeft className="w-4 h-4" />
      </Button>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums px-1 min-w-8 xl:min-w-10 text-center">
        {currentIndex + 1}/{totalItems}
      </span>
      <Button color="light" size="sm" disabled={currentIndex === totalItems - 1} onClick={onNext} aria-label={tr("bento.multimedia.viewer_next", dictionary)} className="p-2!">
        <HiOutlineChevronRight className="w-4 h-4" />
      </Button>

      {/* Category selector — left of review actions */}
      <SelectorDropdown
        categories={categories}
        baseCategory={currentCategory}
        selectCategory={onCategoryChange}
        dictionary={dictionary}
        fitWidth
        triggerClassName="h-7 sm:h-9 !py-0 !px-2 text-xs sm:text-sm"
      />

      {/* Review actions */}
      {isReviewable && status !== "approved" && (
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
          secondaryDisabled={!canReject}
          secondaryTooltip={canReject ? undefined : tr("bento.multimedia.btn_reject_requires_observation", dictionary)}
        />
      )}

      {isReviewable && status === "approved" && (
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
            <Button color="light" size="sm" className="whitespace-nowrap">
              {tr("bento.multimedia.btn_change_status", dictionary)}
              <HiChevronDown className="w-4 h-4 ml-1.5" />
            </Button>
          )}
        >
          {draftDecision !== null && (
            <DropdownItem onClick={() => onDecision("approved")}>
              {tr("bento.multimedia.btn_no_change", dictionary)}
            </DropdownItem>
          )}
          <PortalTooltip content={canReject ? undefined : tr("bento.multimedia.btn_reject_requires_observation", dictionary)}>
            <DropdownItem onClick={canReject ? () => onDecision("rejected") : undefined} disabled={!canReject}>
              {tr("bento.multimedia.btn_reject", dictionary)}
            </DropdownItem>
          </PortalTooltip>
          <DropdownItem onClick={() => onDecision("pending")}>
            {tr("bento.multimedia.btn_back_to_review", dictionary)}
          </DropdownItem>
        </Dropdown>
      )}

      {/* Close */}
      <Tooltip content={tr("bento.multimedia.viewer_close", dictionary)} placement="bottom">
        <Button color="light" size="sm" className="w-9 h-9 p-0" onClick={onClose} aria-label={tr("bento.multimedia.viewer_close", dictionary)}>
          <HiXMark className="w-4 h-4" />
        </Button>
      </Tooltip>
    </div>
  );
}
