"use client";

import { Fragment, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);
import { twMerge } from "tailwind-merge";
import type {
  PlanningWeekViewProps,
  WeekDay,
} from "./planning-week-view.types";
import { parseUrlDate } from "@/features/calendar/services/calendar.service";
import type { PlannedService } from "./planning-selection-context";
import {
  computeSlotState,
  getSlotCellClassName,
  SlotCellContent,
  TimeLabelCell,
  BASE_ROW_HEIGHT_PX,
  buildShiftLayout,
  computeStretchedRowLayout,
  rowOffsetsFromHeights,
  type SlotState,
  type PositionedShift,
} from "@microboxlabs/miot-calendar-ui";
import { usePlanningGrid } from "./use-planning-grid";
import {
  PlanningGridShell,
  buildPlanningGridShellProps,
} from "./planning-grid-shell";

const DAYS_IN_WORK_WEEK = 7; // Mon-Sat

function generateWeekDays(currentDate: Date, lang: string): WeekDay[] {
  const locale = lang === "es" ? "es" : "en";
  const monday = dayjs(currentDate).startOf("isoWeek"); // ISO week always starts on Monday
  const today = dayjs().startOf("day");

  return Array.from({ length: DAYS_IN_WORK_WEEK }, (_, i) => {
    const date = monday.add(i, "day").locale(locale);
    return {
      date: date.toDate(),
      dayName: date.format("ddd").toUpperCase(),
      dayNumber: date.date(),
      isToday: date.isSame(today, "day"),
    };
  });
}

interface WeekSlotCellProps {
  day: WeekDay;
  slot: { hour: number; minutes: number; label: string };
  slotState: SlotState;
  isLastDay: boolean;
  isLastSlot: boolean;
}

function WeekSlotCell({
  day,
  slot,
  slotState,
  isLastDay,
  isLastSlot,
}: Readonly<WeekSlotCellProps>) {
  const dayIsPast = dayjs(day.date).isBefore(dayjs().startOf("day"), "day");

  return (
    <div className="w-full h-full">
      <div
        className={twMerge(
          "appearance-none border-0 p-0 m-0 text-left",
          getSlotCellClassName(slotState, dayIsPast, {
            isLastDay,
            isLastSlot,
            isFirstEditable: day.isToday,
          })
        )}
      >
        <SlotCellContent state={slotState} isPastDay={dayIsPast} />
      </div>
    </div>
  );
}

export default function PlanningWeekView({
  lang,
  dict,
  currentDate: propDate,
  startHour = 8,
  endHour = 22,
}: Readonly<PlanningWeekViewProps>) {
  const searchParams = useSearchParams();

  const planningGrid = usePlanningGrid({ startHour, endHour });
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
  } = planningGrid;

  // Read date from URL, fallback to prop or today
  const currentDate = useMemo(() => {
    const urlDate = parseUrlDate(searchParams.get("date"));
    if (urlDate) return urlDate.toDate();
    if (propDate) return propDate;
    return new Date();
  }, [searchParams, propDate]);

  const weekDays = useMemo(
    () => generateWeekDays(currentDate, lang),
    [currentDate, lang]
  );

  // Get today for past day comparison
  const today = useMemo(() => dayjs().startOf("day"), []);

  const isLastDay = (idx: number) => idx === weekDays.length - 1;
  const isPastDay = useCallback(
    (day: WeekDay) => dayjs(day.date).isBefore(today, "day"),
    [today]
  );

  const handleShiftClick = useCallback(
    (shift: PositionedShift) => {
      // The window is at its booking capacity for the day — the overlay already hides the "add"
      // affordance for these; this is belt-and-suspenders.
      if (isShiftWindowFull(shift)) return;
      handleSelectSlot({
        date: shift.date,
        hour: shift.slotHour,
        minutes: shift.slotMinutes,
        dayIndex: shift.columnIndex,
      });
    },
    [handleSelectSlot, isShiftWindowFull]
  );

  const isShiftSelected = useCallback(
    (shift: PositionedShift) =>
      checkSlotSelected(shift.date, shift.slotHour, shift.slotMinutes),
    [checkSlotSelected]
  );

  // Index planned services by date and exact "HH:MM" start so the overlay
  // layer can fetch the chips that belong inside each shift in O(1).
  const servicesByDateAndStart = useMemo(() => {
    const map = new Map<string, Map<string, PlannedService[]>>();
    for (const ps of plannedServices) {
      const dayKey = dayjs(ps.slot.date).format("YYYY-MM-DD");
      let inner = map.get(dayKey);
      if (!inner) {
        inner = new Map<string, PlannedService[]>();
        map.set(dayKey, inner);
      }
      const slotKey = `${ps.slot.hour}:${ps.slot.minutes}`;
      const arr = inner.get(slotKey);
      if (arr) {
        arr.push(ps);
      } else {
        inner.set(slotKey, [ps]);
      }
    }
    return map;
  }, [plannedServices]);

  const getServicesForShift = useCallback(
    (shift: PositionedShift) => {
      const dayKey = dayjs(shift.date).format("YYYY-MM-DD");
      return (
        servicesByDateAndStart
          .get(dayKey)
          ?.get(`${shift.slotHour}:${shift.slotMinutes}`) ?? []
      );
    },
    [servicesByDateAndStart]
  );

  // Two-pass shift layout (see DayGrid for the rationale). Week-view rows
  // are shared across all 7 day columns, so the per-row required px/min is
  // the MAX of any column's densest shift in that row — once any day
  // column needs the row taller, every column inherits the new height.
  const dayStartMin = startHour * 60;
  const baselineRowOffsets = useMemo(
    () =>
      rowOffsetsFromHeights(
        new Array(timeSlots.length).fill(BASE_ROW_HEIGHT_PX)
      ),
    [timeSlots.length]
  );
  const baseShifts = useMemo(() => {
    const out: PositionedShift[] = [];
    for (let i = 0; i < weekDays.length; i++) {
      const day = weekDays[i];
      out.push(
        ...buildShiftLayout({
          timeSlots: configuredTimeSlots,
          date: day.date,
          startHour,
          rowOffsets: baselineRowOffsets,
          columnIndex: i,
          columnCount: weekDays.length,
        })
      );
    }
    return out;
  }, [configuredTimeSlots, weekDays, startHour, baselineRowOffsets]);

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

  // One concatenated array of overlay rectangles, with per-shift column
  // geometry so the overlay layer can place them inside the matching day
  // column.
  const positionedShifts = useMemo(() => {
    const out: PositionedShift[] = [];
    for (let i = 0; i < weekDays.length; i++) {
      const day = weekDays[i];
      out.push(
        ...buildShiftLayout({
          timeSlots: configuredTimeSlots,
          date: day.date,
          startHour,
          rowOffsets,
          columnIndex: i,
          columnCount: weekDays.length,
        })
      );
    }
    return out;
  }, [configuredTimeSlots, weekDays, startHour, rowOffsets]);

  // Header band height in px (h-16 = 4rem = 64px) and time-axis column width.
  const HEADER_HEIGHT_PX = 64;
  const TIME_AXIS_WIDTH_PX = 64;

  const shellProps = buildPlanningGridShellProps({
    planningGrid,
    positionedShifts,
    onShiftClick: handleShiftClick,
    isShiftSelected,
    getServicesForShift,
    isWindowFull: isShiftWindowFull,
    dict,
  });

  return (
    <PlanningGridShell
      shiftOverlayTopPx={HEADER_HEIGHT_PX}
      shiftOverlayLeftPx={TIME_AXIS_WIDTH_PX}
      {...shellProps}
    >
      <div
        className="grid min-w-150"
        style={{
          gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)`,
        }}
      >
        {/* Header row - empty corner cell */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800">
          <div className="h-16 border-l border-t border-gray-200 dark:border-gray-700 rounded-tl-lg bg-gray-50 dark:bg-gray-900" />
        </div>

        {/* Header row - day columns */}
        {weekDays.map((day, idx) => {
          const dayIsPast = isPastDay(day);
          return (
            <div
              key={day.dayNumber}
              className="sticky top-0 z-10 bg-white dark:bg-gray-800"
            >
              <div
                className={twMerge(
                  "h-16 flex flex-col items-center justify-center",
                  "border-l border-t border-gray-200 dark:border-gray-700",
                  "bg-gray-50 dark:bg-gray-900",
                  day.isToday &&
                    "border-l-2 border-l-primary-500 dark:border-l-primary-400",
                  isLastDay(idx) && "border-r rounded-tr-lg"
                )}
              >
                <span
                  className={twMerge(
                    "text-xs font-medium",
                    day.isToday &&
                      "text-primary-600 dark:text-primary-400",
                    !day.isToday &&
                      !dayIsPast &&
                      "text-gray-500 dark:text-gray-400",
                    !day.isToday &&
                      dayIsPast &&
                      "text-gray-400 dark:text-gray-500 italic"
                  )}
                >
                  {day.dayName}
                </span>
                <span
                  className={twMerge(
                    "text-lg font-semibold",
                    day.isToday &&
                      "bg-primary-600 text-white rounded-full w-8 h-8 flex items-center justify-center",
                    !day.isToday &&
                      !dayIsPast &&
                      "text-gray-900 dark:text-white",
                    !day.isToday &&
                      dayIsPast &&
                      "text-gray-400 dark:text-gray-500 font-normal"
                  )}
                >
                  {day.dayNumber}
                </span>
              </div>
            </div>
          );
        })}

        {/* Time slots grid */}
        {timeSlots.map((slot, slotIdx) => {
          return (
            <Fragment key={slot.label}>
              {/* Time label column */}
              <TimeLabelCell
                label={slot.label}
                minHeight={rowHeights[slotIdx]}
                isLastSlot={isLastSlot(slotIdx)}
              />

              {/* Day cells */}
              {weekDays.map((day, dayIdx) => {
                const slotState = computeSlotState(
                  day.date,
                  slot,
                  isPastDay(day),
                  {
                    getTimeWindowForSlot,
                    getRemainingQuota,
                    isSlotBlocked,
                  }
                );

                return (
                  <WeekSlotCell
                    key={`${day.dayNumber}-${slot.label}`}
                    day={day}
                    slot={slot}
                    slotState={slotState}
                    isLastDay={isLastDay(dayIdx)}
                    isLastSlot={isLastSlot(slotIdx)}
                  />
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </PlanningGridShell>
  );
}
