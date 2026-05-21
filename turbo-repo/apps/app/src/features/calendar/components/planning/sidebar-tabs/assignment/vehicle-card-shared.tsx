"use client";

import { HiCheck, HiExclamation } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

// ============================================================================
// GPS Integrated Badge
// ============================================================================

interface GpsBadgeProps {
  readonly isGpsIntegrado: boolean;
  readonly dict: I18nRecord;
}

export function GpsBadge({ isGpsIntegrado, dict }: GpsBadgeProps) {
  if (!isGpsIntegrado) return null;

  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
        <HiCheck className="w-2.5 h-2.5" />
      </span>
      {tr("pages.planning.sidebar.assignment.gpsIntegrated", dict)}
    </span>
  );
}

// ============================================================================
// Online/Offline Status Indicator
// ============================================================================

interface OnlineStatusProps {
  readonly isOnline: boolean;
  readonly dict: I18nRecord;
}

export function OnlineStatus({ isOnline, dict }: OnlineStatusProps) {
  return (
    <span className="flex items-center gap-1 text-[10px]">
      <span
        className={twMerge(
          "w-2 h-2 rounded-full",
          isOnline ? "bg-green-500" : "bg-gray-400"
        )}
      />
      <span
        className={twMerge(
          "font-medium",
          isOnline
            ? "text-green-600 dark:text-green-400"
            : "text-gray-500 dark:text-gray-400"
        )}
      >
        {isOnline
          ? tr("pages.planning.sidebar.assignment.online", dict)
          : tr("pages.planning.sidebar.assignment.offline", dict)}
      </span>
    </span>
  );
}

// ============================================================================
// Warning Badge (for signal losses, reported problems, etc.)
// ============================================================================

interface WarningBadgeProps {
  readonly count: number;
  readonly labelKey: string;
  readonly dict: I18nRecord;
}

export function WarningBadge({ count, labelKey, dict }: WarningBadgeProps) {
  if (count <= 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        <HiExclamation className="w-3 h-3" />
        {tr(labelKey, dict)} ({count})
      </span>
    </div>
  );
}

// ============================================================================
// GPS Status Column (combines badge + online status)
// ============================================================================

interface GpsStatusColumnProps {
  readonly isGpsIntegrado: boolean;
  readonly isOnline: boolean;
  readonly dict: I18nRecord;
}

export function GpsStatusColumn({
  isGpsIntegrado,
  isOnline,
  dict,
}: GpsStatusColumnProps) {
  if (!isGpsIntegrado) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <GpsBadge isGpsIntegrado={isGpsIntegrado} dict={dict} />
      <OnlineStatus isOnline={isOnline} dict={dict} />
    </div>
  );
}

// ============================================================================
// Vehicle Card Button Wrapper
// ============================================================================

interface VehicleCardButtonProps {
  readonly isHighlighted: boolean;
  readonly isSelected: boolean;
  readonly onClick: () => void;
  readonly onMouseEnter: () => void;
  readonly children: React.ReactNode;
}

export function VehicleCardButton({
  isHighlighted,
  isSelected,
  onClick,
  onMouseEnter,
  children,
}: VehicleCardButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={twMerge(
        "w-full text-left p-3 transition-colors",
        isHighlighted && "bg-blue-50 dark:bg-blue-900/30",
        isSelected && !isHighlighted && "bg-gray-50 dark:bg-gray-700/50"
      )}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Stat Row
// ============================================================================

interface StatRowProps {
  readonly label: string;
  readonly value: string | number;
}

export function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

// ============================================================================
// Vehicle Header (plate + subtitle)
// ============================================================================

interface VehicleHeaderProps {
  readonly plate: string;
  readonly subtitle: string;
  readonly isSelected: boolean;
}

export function VehicleHeader({
  plate,
  subtitle,
  isSelected,
}: VehicleHeaderProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        {isSelected && (
          <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        )}
        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
          {plate}
        </span>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {subtitle}
      </span>
    </div>
  );
}
