import { twMerge } from "tailwind-merge";
import {
  TIME_WINDOW_COLORS,
  TimeWindowUtils,
  type TimeWindow,
} from "./planning-selection-context";

export const BLOCKED_STRIPE_CLASS =
  "[background:repeating-linear-gradient(45deg,rgb(254,242,242),rgb(254,242,242)_4px,rgba(239,68,68,0.2)_4px,rgba(239,68,68,0.2)_8px)] dark:[background:repeating-linear-gradient(45deg,rgb(55,48,48),rgb(55,48,48)_4px,rgba(239,68,68,0.3)_4px,rgba(239,68,68,0.3)_8px)]";

/**
 * Neutral-grey diagonal hatch for empty shift rectangles whose time window has reached its booking
 * capacity for the day (a "spare" slot — the grid has more slots than the window can hold). Distinct
 * from {@link BLOCKED_STRIPE_CLASS} (red = blocked/closed): grey reads as "this time exists but the
 * window's quota is used up — not assignable".
 */
export const SPARE_SLOT_STRIPE_CLASS =
  "[background:repeating-linear-gradient(45deg,rgb(243,244,246),rgb(243,244,246)_4px,rgba(156,163,175,0.3)_4px,rgba(156,163,175,0.3)_8px)] dark:[background:repeating-linear-gradient(45deg,rgb(31,41,55),rgb(31,41,55)_4px,rgba(107,114,128,0.35)_4px,rgba(107,114,128,0.35)_8px)]";

export interface SlotState {
  slotBlocked: boolean;
  timeWindow: TimeWindow | null;
  hasTimeWindow: boolean;
  isWindowStart: boolean;
  remainingQuota: number;
  isQuotaFull: boolean;
  isDisabled: boolean;
  windowColor: { bg: string; hover: string; badge: string };
  blockedStripeClass: string;
}

export function computeSlotState(
  date: Date,
  slot: { hour: number; minutes: number },
  isPastDay: boolean,
  deps: {
    getTimeWindowForSlot: (
      date: Date,
      hour: number,
      minutes: number
    ) => TimeWindow | null;
    getRemainingQuota: (window: TimeWindow, date: Date) => number;
    isSlotBlocked: (date: Date, hour: number, minutes: number) => boolean;
  }
): SlotState {
  const slotBlocked = deps.isSlotBlocked(date, slot.hour, slot.minutes);
  const timeWindow = deps.getTimeWindowForSlot(date, slot.hour, slot.minutes);
  const hasTimeWindow = timeWindow !== null;
  const timeRange = hasTimeWindow
    ? TimeWindowUtils.getTimeRange(timeWindow)
    : null;
  const isWindowStart =
    hasTimeWindow &&
    timeRange !== null &&
    slot.hour === timeRange.startHour &&
    slot.minutes === timeRange.startMinutes;
  const remainingQuota = hasTimeWindow
    ? deps.getRemainingQuota(timeWindow, date)
    : 0;
  const isQuotaFull = remainingQuota === 0;
  const isDisabled = isPastDay || slotBlocked || isQuotaFull;
  const windowColor =
    hasTimeWindow && timeWindow.color
      ? TIME_WINDOW_COLORS[timeWindow.color]
      : TIME_WINDOW_COLORS.emerald;
  const blockedStripeClass =
    slotBlocked && !isPastDay ? BLOCKED_STRIPE_CLASS : "";
  return {
    slotBlocked,
    timeWindow,
    hasTimeWindow,
    isWindowStart,
    remainingQuota,
    isQuotaFull,
    isDisabled,
    windowColor,
    blockedStripeClass,
  };
}

export interface SlotCellClassNameOptions {
  isLastDay?: boolean;
  isLastSlot?: boolean;
  /** Mark the left edge as the boundary between past (read-only) and today. */
  isFirstEditable?: boolean;
}

export function getSlotCellClassName(
  state: SlotState,
  isPastDay: boolean,
  options?: SlotCellClassNameOptions
): string {
  const {
    slotBlocked,
    hasTimeWindow,
    isQuotaFull,
    windowColor,
    blockedStripeClass,
  } = state;
  const {
    isLastDay = false,
    isLastSlot = false,
    isFirstEditable = false,
  } = options ?? {};
  return twMerge(
    // The cell is now a passive ruler — overlay rectangles (rendered by
    // ShiftOverlayLayer) are the actual click target and the only place a
    // selection ring is drawn. `pointer-events-none` keeps clicks falling
    // through to whichever element is on top at that point (overlay
    // rectangle or chip).
    "h-full w-full relative pointer-events-none",
    "border-l border-t border-gray-200 dark:border-gray-700",
    isFirstEditable && "border-l-2 border-l-primary-500 dark:border-l-primary-400",
    "transition-all duration-200 p-1 cursor-default",
    blockedStripeClass,
    isPastDay && !hasTimeWindow && "bg-gray-50/60 dark:bg-gray-900/20",
    !isPastDay && !slotBlocked && isQuotaFull && "opacity-60",
    !slotBlocked && hasTimeWindow && !isQuotaFull && windowColor.bg,
    !slotBlocked &&
      hasTimeWindow &&
      isQuotaFull &&
      "bg-red-50 dark:bg-red-900/20",
    isLastDay && "border-r",
    isLastSlot && "border-b",
    isLastDay && isLastSlot && "rounded-br-lg"
  );
}
