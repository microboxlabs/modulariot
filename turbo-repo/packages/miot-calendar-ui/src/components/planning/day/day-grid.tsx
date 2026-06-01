"use client";

import { Fragment, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import { twMerge } from "tailwind-merge";
import type { CalendarItem } from "../../../types/calendar-item";
import type { PlannedService } from "../../../types/planning";
import type { DayGridProps, DayInfo } from "../planning-views.types";
import {
  computeSlotState,
  getSlotCellClassName,
  type SlotState,
} from "../planning-slot-utils";
import { SlotCellContent, TimeLabelCell } from "../slot-cell-shared";
import { PlanningGridShell } from "../planning-grid-shell";
import {
  BASE_ROW_HEIGHT_PX,
  buildShiftLayout,
  computeStretchedRowLayout,
  rowOffsetsFromHeights,
  type PositionedShift,
} from "../shift-layout";

function getDayInfo(date: Date, lang: string): DayInfo {
  const locale = lang === "es" ? "es" : "en";
  const d = dayjs(date).locale(locale);
  const today = dayjs().startOf("day");

  return {
    date,
    dayName: d.format("dddd"),
    dayNumber: d.date(),
    monthName: d.format("MMMM"),
    year: d.year(),
    isToday: d.isSame(today, "day"),
  };
}

interface DayGridSlotCellProps {
  slot: { hour: number; minutes: number; label: string };
  currentDate: Date;
  isPastDay: boolean;
  state: SlotState;
  isLastSlot: boolean;
}

function DayGridSlotCell({
  isPastDay,
  state,
  isLastSlot,
}: Readonly<DayGridSlotCellProps>) {
  return (
    <div
      className={getSlotCellClassName(state, isPastDay, {
        isLastSlot,
        isFirstEditable: !isPastDay,
      })}
    >
      <SlotCellContent state={state} isPastDay={isPastDay} />
    </div>
  );
}

export function DayGrid<TItem extends { id: string } = CalendarItem>({
  lang,
  currentDate,
  grid,
  buildShellProps,
  startHour = 8,
  endHour = 22,
}: Readonly<DayGridProps<TItem>>) {
  const {
    handleSelectSlot,
    isSlotSelected: checkSlotSelected,
    timeSlots,
    isLastSlot,
    getTimeWindowForSlot,
    getRemainingQuota,
    isSlotBlocked,
    configuredTimeSlots,
    plannedServices,
    isShiftWindowFull,
  } = grid;

  const dayInfo = useMemo(
    () => getDayInfo(currentDate, lang),
    [currentDate, lang]
  );

  // Check if the current day is in the past
  const isPastDay = useMemo(() => {
    return dayjs(currentDate).isBefore(dayjs().startOf("day"), "day");
  }, [currentDate]);

  const handleShiftClick = useCallback(
    (shift: PositionedShift) => {
      // The window is at its booking capacity for the day — the overlay already hides the "add"
      // affordance for these; this is belt-and-suspenders.
      if (isShiftWindowFull(shift)) return;
      handleSelectSlot({
        date: shift.date,
        hour: shift.slotHour,
        minutes: shift.slotMinutes,
      });
    },
    [handleSelectSlot, isShiftWindowFull]
  );

  const isShiftSelected = useCallback(
    (shift: PositionedShift) =>
      checkSlotSelected(shift.date, shift.slotHour, shift.slotMinutes),
    [checkSlotSelected]
  );

  // Index planned services by exact start "HH:MM" on the current date so
  // the overlay layer can fetch the chips that belong inside each shift
  // rectangle in O(1).
  const servicesByStartOnDate = useMemo(() => {
    const map = new Map<string, PlannedService<TItem>[]>();
    for (const ps of plannedServices) {
      if (!dayjs(ps.slot.date).isSame(currentDate, "day")) continue;
      const key = `${ps.slot.hour}:${ps.slot.minutes}`;
      const arr = map.get(key);
      if (arr) {
        arr.push(ps);
      } else {
        map.set(key, [ps]);
      }
    }
    return map;
  }, [plannedServices, currentDate]);

  const getServicesForShift = useCallback(
    (shift: PositionedShift) =>
      servicesByStartOnDate.get(`${shift.slotHour}:${shift.slotMinutes}`) ?? [],
    [servicesByStartOnDate]
  );

  // Two-pass shift layout so rows containing chip-heavy shifts can stretch.
  // Pass 1: build shifts on a baseline 48px-per-row grid to learn each
  // shift's (start, end, duration) — geometry doesn't depend on heights yet.
  // Pass 2: walk those shifts, derive a required px/min for each row from
  // the densest shift inside, rebuild rowOffsets, then re-layout shifts.
  // This mirrors the old chip-driven cell expansion so the time axis stays
  // aligned with shift rectangles even when one slot holds multiple chips.
  const dayStartMin = startHour * 60;
  const baselineRowOffsets = useMemo(
    () =>
      rowOffsetsFromHeights(
        new Array(timeSlots.length).fill(BASE_ROW_HEIGHT_PX)
      ),
    [timeSlots.length]
  );
  const baseShifts = useMemo(
    () =>
      buildShiftLayout({
        timeSlots: configuredTimeSlots,
        date: currentDate,
        startHour,
        rowOffsets: baselineRowOffsets,
      }),
    [configuredTimeSlots, currentDate, startHour, baselineRowOffsets]
  );
  const { rowHeights, rowOffsets } = useMemo(
    () =>
      computeStretchedRowLayout({
        baseShifts,
        getServicesCount: (shift) => getServicesForShift(shift).length,
        rowCount: timeSlots.length,
        dayStartMin,
      }),
    [baseShifts, getServicesForShift, timeSlots.length, dayStartMin]
  );

  const positionedShifts = useMemo(
    () =>
      buildShiftLayout({
        timeSlots: configuredTimeSlots,
        date: currentDate,
        startHour,
        rowOffsets,
      }),
    [configuredTimeSlots, currentDate, startHour, rowOffsets]
  );

  // Header band (sticky day/time-axis row) height in px — the time-slot grid
  // starts immediately below this. Matches `h-20` (5rem) on the header cells.
  const HEADER_HEIGHT_PX = 80;
  // Time-axis column width — the overlay covers the day column only.
  const TIME_AXIS_WIDTH_PX = 64;

  const { shiftOverlay, gridOverlays } = buildShellProps({
    positionedShifts,
    onShiftClick: handleShiftClick,
    isShiftSelected,
    getServicesForShift,
    isWindowFull: isShiftWindowFull,
  });

  return (
    <PlanningGridShell<TItem>
      shiftOverlayTopPx={HEADER_HEIGHT_PX}
      shiftOverlayLeftPx={TIME_AXIS_WIDTH_PX}
      shiftOverlay={shiftOverlay}
      gridOverlays={gridOverlays}
    >
      <div className="grid" style={{ gridTemplateColumns: "64px 1fr" }}>
        {/* Header row - empty corner cell */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800">
          <div className="h-20 border-l border-t border-gray-200 dark:border-gray-700 rounded-tl-lg bg-gray-50 dark:bg-gray-900" />
        </div>

        {/* Header row - day column */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800">
          <div
            className={twMerge(
              "h-20 flex flex-col items-center justify-center",
              "border-l border-t border-r border-gray-200 dark:border-gray-700",
              "bg-gray-50 dark:bg-gray-900 rounded-tr-lg",
              !isPastDay &&
                "border-l-2 border-l-primary-500 dark:border-l-primary-400"
            )}
          >
            <span
              className={twMerge(
                "text-sm font-medium capitalize",
                dayInfo.isToday && "text-primary-600 dark:text-primary-400",
                !dayInfo.isToday &&
                  !isPastDay &&
                  "text-gray-500 dark:text-gray-400",
                !dayInfo.isToday &&
                  isPastDay &&
                  "text-gray-400 dark:text-gray-500 italic"
              )}
            >
              {dayInfo.dayName}
            </span>
            <span
              className={twMerge(
                "text-2xl font-bold",
                dayInfo.isToday &&
                  "bg-primary-600 text-white rounded-full w-10 h-10 flex items-center justify-center",
                !dayInfo.isToday &&
                  !isPastDay &&
                  "text-gray-900 dark:text-white",
                !dayInfo.isToday &&
                  isPastDay &&
                  "text-gray-400 dark:text-gray-500 font-normal"
              )}
            >
              {dayInfo.dayNumber}
            </span>
          </div>
        </div>

        {/* Time slots grid */}
        {timeSlots.map((slot, slotIdx) => {
          const slotState = computeSlotState(currentDate, slot, isPastDay, {
            getTimeWindowForSlot,
            getRemainingQuota,
            isSlotBlocked,
          });

          return (
            <Fragment key={slot.label}>
              <TimeLabelCell
                label={slot.label}
                minHeight={rowHeights[slotIdx]}
                isLastSlot={isLastSlot(slotIdx)}
              />
              <DayGridSlotCell
                slot={slot}
                currentDate={currentDate}
                isPastDay={isPastDay}
                state={slotState}
                isLastSlot={isLastSlot(slotIdx)}
              />
            </Fragment>
          );
        })}
      </div>
    </PlanningGridShell>
  );
}

export default DayGrid;
