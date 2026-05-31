import type { ReactNode } from "react";
import type { CalendarItem } from "../../types/calendar-item";
import type { PlannedService } from "../../types/planning";
import type { TimeSlot as TimeAxisSlot } from "../../services/calendar.service.types";
import type { PositionedShift } from "./shift-layout";
import type { TimeSlot, TimeWindow } from "./time-window";
import type { ShiftOverlayLayerProps } from "./shift-overlay-layer";
import type { PlanningGridOverlaysProps } from "./planning-grid-overlays";

/**
 * The generic slice of a planning-grid controller the day/week views read.
 *
 * The full controller (selection state + permissions + booking CRUD + context
 * menu) is domain-bound and stays host-side (the app's `usePlanningGrid`); the
 * host passes this structurally-compatible subset in so the package views own
 * only generic geometry + markup. Generic over the host item type `TItem`
 * (defaults to {@link CalendarItem}); the package only relies on `id`.
 */
export interface PlanningGridData<TItem extends { id: string } = CalendarItem> {
  /** Select an empty shift slot (opens the host sidebar in "add" mode). */
  handleSelectSlot: (slot: {
    date: Date;
    hour: number;
    minutes: number;
    dayIndex?: number;
  }) => void;
  /** Is the given (date, hour, minute) the currently-selected slot? */
  isSlotSelected: (date: Date, hour: number, minutes: number) => boolean;
  /** Time-axis rows ({hour, minutes, label}) for the configured day span. */
  timeSlots: TimeAxisSlot[];
  isLastSlot: (idx: number) => boolean;
  getTimeWindowForSlot: (
    date: Date,
    hour: number,
    minutes: number
  ) => TimeWindow | null;
  getRemainingQuota: (window: TimeWindow, date: Date) => number;
  isSlotBlocked: (date: Date, hour: number, minutes: number) => boolean;
  /** Configured time windows/blocks driving the shift overlay cadence. */
  configuredTimeSlots: TimeSlot[];
  /** All planned items currently on the grid (across the loaded date range). */
  plannedServices: PlannedService<TItem>[];
  /** Is the shift's parent window at its day booking capacity? */
  isShiftWindowFull: (shift: PositionedShift) => boolean;
}

/**
 * The view-computed inputs a host needs to assemble the `<PlanningGridShell>`
 * prop bundles. The host closure captures its domain controller + i18n `dict`
 * and returns the shift-overlay + grid-overlay props (chip render-prop, context
 * menu, delete-modal copy) — keeping the domain glue host-side.
 */
export interface BuildShellPropsArgs<
  TItem extends { id: string } = CalendarItem,
> {
  positionedShifts: readonly PositionedShift[];
  onShiftClick: (shift: PositionedShift) => void;
  isShiftSelected: (shift: PositionedShift) => boolean;
  getServicesForShift: (
    shift: PositionedShift
  ) => readonly PlannedService<TItem>[];
  isWindowFull: (shift: PositionedShift) => boolean;
}

export type BuildShellProps<TItem extends { id: string } = CalendarItem> = (
  args: BuildShellPropsArgs<TItem>
) => {
  shiftOverlay: ShiftOverlayLayerProps<TItem>;
  gridOverlays: PlanningGridOverlaysProps<TItem>;
};

export interface DayInfo {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthName: string;
  year: number;
  isToday: boolean;
}

export interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}

export interface MonthDay {
  date: Date;
  dayNumber: number;
  isToday: boolean;
  isCurrentMonth: boolean;
}

/** Shared inputs for the day-axis grid + the day/week views built on it. */
export interface PlanningGridViewProps<
  TItem extends { id: string } = CalendarItem,
> {
  lang: string;
  grid: PlanningGridData<TItem>;
  buildShellProps: BuildShellProps<TItem>;
  startHour?: number;
  endHour?: number;
}

export interface DayGridProps<TItem extends { id: string } = CalendarItem>
  extends PlanningGridViewProps<TItem> {
  /** The day this grid renders (the views read it from `useCalendar()`). */
  currentDate: Date;
}

export type PlanningDayViewProps<
  TItem extends { id: string } = CalendarItem,
> = PlanningGridViewProps<TItem>;

export type PlanningWeekViewProps<
  TItem extends { id: string } = CalendarItem,
> = PlanningGridViewProps<TItem>;

export interface PlanningMonthViewProps<
  TItem extends { id: string } = CalendarItem,
> {
  lang: string;
  /** Provides `plannedServices` (the month view reads only that slice). */
  grid: Pick<PlanningGridData<TItem>, "plannedServices">;
  /**
   * Render one day-cell chip for a planned item. Host-supplied so the domain
   * chip (urgency color, label) stays host-side; the package owns the cell
   * container + overflow ("+N más").
   */
  renderDayChip: (ps: PlannedService<TItem>) => ReactNode;
}

export interface PlanningCalendarProps<
  TItem extends { id: string } = CalendarItem,
> {
  lang: string;
  grid: PlanningGridData<TItem>;
  buildShellProps: BuildShellProps<TItem>;
  renderDayChip: (ps: PlannedService<TItem>) => ReactNode;
  startHour?: number;
  endHour?: number;
}
