"use client";

import { twMerge } from "tailwind-merge";
import type { ReactNode } from "react";
import type { SlotState } from "./planning-slot-utils";

// ============================================================================
// Time Label Cell
// ============================================================================

interface TimeLabelCellProps {
  readonly label: string;
  readonly minHeight: number;
  readonly isLastSlot: boolean;
}

export function TimeLabelCell({
  label,
  minHeight,
  isLastSlot,
}: TimeLabelCellProps) {
  return (
    <div
      style={{ minHeight: `${minHeight}px` }}
      className={twMerge(
        "flex items-start justify-end pr-2 pt-0.5",
        "border-l border-t border-gray-200 dark:border-gray-700",
        "text-xs text-gray-500 dark:text-gray-400",
        isLastSlot && "border-b rounded-bl-lg"
      )}
    >
      {label}
    </div>
  );
}

// ============================================================================
// Blocked Slot Indicator
// ============================================================================

export function BlockedSlotIndicator() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span className="text-red-500/60 text-lg">⊘</span>
    </div>
  );
}

// ============================================================================
// Time Window Name Badge
// ============================================================================

interface TimeWindowBadgeProps {
  readonly name: string;
  readonly isQuotaFull: boolean;
  readonly badgeColorClass: string;
}

export function TimeWindowBadge({
  name,
  isQuotaFull,
  badgeColorClass,
}: TimeWindowBadgeProps) {
  return (
    <div className="absolute -top-0.5 left-1 right-1 flex items-center justify-center pointer-events-none">
      <span
        className={twMerge(
          "text-[9px] font-semibold px-1.5 py-0.5 rounded-b shadow-sm truncate max-w-full",
          isQuotaFull
            ? "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-800/80"
            : badgeColorClass
        )}
      >
        {name}
      </span>
    </div>
  );
}

// ============================================================================
// Quota Display
// ============================================================================

interface QuotaDisplayProps {
  readonly remaining: number;
  readonly total: number;
  readonly isQuotaFull: boolean;
  readonly badgeColorClass: string;
}

export function QuotaDisplay({
  remaining,
  total,
  isQuotaFull,
  badgeColorClass,
}: QuotaDisplayProps) {
  return (
    <div className="absolute top-0.5 right-0.5">
      <span
        className={twMerge(
          "text-[9px] font-bold px-1 rounded",
          isQuotaFull
            ? "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50"
            : badgeColorClass
        )}
      >
        {remaining}/{total}
      </span>
    </div>
  );
}

// ============================================================================
// Slot Cell Content (combines all indicators)
// ============================================================================

interface SlotCellContentProps {
  readonly state: SlotState;
  readonly isPastDay: boolean;
  readonly children?: ReactNode;
}

export function SlotCellContent({
  state,
  isPastDay,
  children,
}: SlotCellContentProps) {
  const {
    slotBlocked,
    timeWindow,
    isWindowStart,
    remainingQuota,
    isQuotaFull,
    windowColor,
  } = state;

  return (
    <>
      {!isPastDay && slotBlocked && <BlockedSlotIndicator />}

      {!isPastDay && !slotBlocked && isWindowStart && timeWindow?.name && (
        <TimeWindowBadge
          name={timeWindow.name}
          isQuotaFull={isQuotaFull}
          badgeColorClass={windowColor.badge}
        />
      )}

      {!isPastDay && !slotBlocked && isWindowStart && timeWindow && (
        <QuotaDisplay
          remaining={remainingQuota}
          total={timeWindow.quota}
          isQuotaFull={isQuotaFull}
          badgeColorClass={windowColor.badge}
        />
      )}

      {/* Chips intentionally NOT rendered here — they live inside the
          ShiftOverlayLayer rectangles so chip click + context-menu work
          without z-index fights with the overlay. */}

      {children}
    </>
  );
}
