import { twMerge } from "tailwind-merge";
import {
  TIME_WINDOW_COLORS,
  TimeWindowUtils,
  type TimeWindow,
} from "./planning-selection-context";

export const BLOCKED_STRIPE_CLASS =
  "[background:repeating-linear-gradient(45deg,rgb(254,242,242),rgb(254,242,242)_4px,rgba(239,68,68,0.2)_4px,rgba(239,68,68,0.2)_8px)] dark:[background:repeating-linear-gradient(45deg,rgb(55,48,48),rgb(55,48,48)_4px,rgba(239,68,68,0.3)_4px,rgba(239,68,68,0.3)_8px)]";

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
  selected: boolean,
  options?: SlotCellClassNameOptions
): string {
  const {
    slotBlocked,
    hasTimeWindow,
    isQuotaFull,
    isDisabled,
    windowColor,
    blockedStripeClass,
  } = state;
  const {
    isLastDay = false,
    isLastSlot = false,
    isFirstEditable = false,
  } = options ?? {};
  return twMerge(
    "h-full w-full relative",
    "border-l border-t border-gray-200 dark:border-gray-700",
    isFirstEditable && "border-l-2 border-l-primary-500 dark:border-l-primary-400",
    "transition-all duration-200 p-1",
    blockedStripeClass,
    isPastDay && !hasTimeWindow && "bg-gray-50/60 dark:bg-gray-900/20",
    isDisabled ? "cursor-not-allowed" : "cursor-pointer",
    !isPastDay && !slotBlocked && isQuotaFull && "opacity-60",
    !slotBlocked &&
      hasTimeWindow &&
      !selected &&
      !isQuotaFull &&
      windowColor.bg,
    !slotBlocked &&
      hasTimeWindow &&
      !selected &&
      isQuotaFull &&
      "bg-red-50 dark:bg-red-900/20",
    selected
      ? "bg-primary-100 dark:bg-primary-900/40 ring-2 ring-inset ring-primary-500"
      : !isPastDay &&
          !slotBlocked &&
          !hasTimeWindow &&
          "hover:bg-gray-50 dark:hover:bg-gray-700/50",
    !isPastDay &&
      !slotBlocked &&
      hasTimeWindow &&
      !selected &&
      !isQuotaFull &&
      windowColor.hover,
    isLastDay && "border-r",
    isLastSlot && "border-b",
    isLastDay && isLastSlot && "rounded-br-lg"
  );
}
