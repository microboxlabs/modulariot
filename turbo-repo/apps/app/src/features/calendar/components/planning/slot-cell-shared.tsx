"use client";

import { twMerge } from "tailwind-merge";
import type { ReactNode } from "react";
import type { SlotState } from "./planning-slot-utils";
import type { PlannedService } from "./planning-selection-context";
import { PlannedServiceChip } from "./planned-service-chip";
import type {
  I18nRecord,
  I18nDictionary,
} from "@/features/i18n/i18n.service.types";

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
// Slot Services List
// ============================================================================

interface SlotServicesProps {
  readonly services: PlannedService[];
  readonly reassigningServiceId?: string;
  readonly onContextMenu: (e: React.MouseEvent, ps: PlannedService) => void;
  readonly dict: I18nDictionary | I18nRecord;
  readonly layout?: "row" | "column";
}

export function SlotServices({
  services,
  reassigningServiceId,
  onContextMenu,
  dict,
  layout = "row",
}: SlotServicesProps) {
  if (services.length === 0) return null;

  return (
    <div
      className={twMerge(
        layout === "row"
          ? "absolute inset-1 flex flex-row gap-0.5"
          : "flex flex-col gap-0.5"
      )}
    >
      {services.map((ps) => (
        <PlannedServiceChip
          key={ps.service.id}
          plannedService={ps}
          isBeingReassigned={reassigningServiceId === ps.service.id}
          onContextMenu={onContextMenu}
          className={layout === "row" ? "flex-1" : "w-full"}
          dict={dict}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Slot Cell Content (combines all indicators)
// ============================================================================

interface SlotCellContentProps {
  readonly state: SlotState;
  readonly isPastDay: boolean;
  readonly services: PlannedService[];
  readonly reassigningServiceId?: string;
  readonly onContextMenu: (e: React.MouseEvent, ps: PlannedService) => void;
  readonly dict: I18nDictionary | I18nRecord;
  readonly servicesLayout?: "row" | "column";
  readonly children?: ReactNode;
}

export function SlotCellContent({
  state,
  isPastDay,
  services,
  reassigningServiceId,
  onContextMenu,
  dict,
  servicesLayout = "row",
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

      <SlotServices
        services={services}
        reassigningServiceId={reassigningServiceId}
        onContextMenu={onContextMenu}
        dict={dict}
        layout={servicesLayout}
      />

      {children}
    </>
  );
}
