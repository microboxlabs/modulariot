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
  type SlotState,
} from "./planning-slot-utils";
import { SlotCellContent, TimeLabelCell } from "./slot-cell-shared";
import { usePlanningGrid } from "./use-planning-grid";
import { PlanningGridOverlays } from "./planning-grid-overlays";
import { ShiftOverlayLayer } from "./shift-overlay-layer";
import { buildShiftLayout, type PositionedShift } from "./shift-layout";

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
        data-slot-date={dayjs(day.date).format("YYYY-MM-DD")}
        data-slot-time={`${slot.hour.toString().padStart(2, "0")}:${slot.minutes.toString().padStart(2, "0")}`}
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

  const {
    selectedSlot,
    handleSelectSlot,
    isSlotSelected: checkSlotSelected,
    timeSlots,
    isLastSlot,
    getTimeWindowForSlot,
    getRemainingQuota,
    isSlotBlocked,
    reassigningService,
    contextMenu,
    deleteModal,
    deleteAssignmentModal,
    handleContextMenu,
    handleCloseContextMenu,
    handleReassign,
    handleAssign,
    handleDeleteRequest,
    handleConfirmDelete,
    handleCancelDelete,
    handleDeleteAssignmentRequest,
    handleConfirmDeleteAssignment,
    handleCancelDeleteAssignment,
    viewPlannedService,
    configuredTimeSlots,
    plannedServices,
  } = usePlanningGrid({ startHour, endHour });

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
      handleSelectSlot({
        date: shift.date,
        hour: shift.slotHour,
        minutes: shift.slotMinutes,
        dayIndex: shift.columnIndex,
      });
    },
    [handleSelectSlot]
  );

  const isShiftSelected = useCallback(
    (shift: PositionedShift) =>
      checkSlotSelected(shift.date, shift.slotHour, shift.slotMinutes),
    [checkSlotSelected]
  );

  // Cells no longer expand for chip stacking (chips render inside the shift
  // overlay rectangles, not in cells), so each row has the same fixed
  // height. Matches the previous base value so the overall grid density is
  // unchanged.
  const ROW_HEIGHT_PX = 48;
  const rowOffsets = useMemo(() => {
    const offsets = [0];
    for (let i = 0; i < timeSlots.length; i++) {
      offsets.push(offsets[i] + ROW_HEIGHT_PX);
    }
    return offsets;
  }, [timeSlots.length]);

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

  return (
    <div className="w-full h-full overflow-auto">
     <div className="relative">
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
                minHeight={ROW_HEIGHT_PX}
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

      {/* Shift overlay: each rectangle owns its own chips and "add booking"
          affordance. */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: HEADER_HEIGHT_PX,
          left: TIME_AXIS_WIDTH_PX,
          right: 0,
          bottom: 0,
        }}
      >
        <ShiftOverlayLayer
          shifts={positionedShifts}
          onShiftClick={handleShiftClick}
          isShiftSelected={isShiftSelected}
          getServicesForShift={getServicesForShift}
          onChipClick={viewPlannedService}
          onChipContextMenu={handleContextMenu}
          reassigningServiceId={reassigningService?.service.service.id}
          dict={dict}
        />
      </div>
     </div>

      {/* Overlays */}
      <PlanningGridOverlays
        dict={dict}
        contextMenu={contextMenu}
        onReassign={handleReassign}
        onAssign={handleAssign}
        onDeleteRequest={handleDeleteRequest}
        onDeleteAssignmentRequest={handleDeleteAssignmentRequest}
        onCloseContextMenu={handleCloseContextMenu}
        deleteModal={deleteModal}
        onConfirmDelete={handleConfirmDelete}
        onCancelDelete={handleCancelDelete}
        deleteAssignmentModal={deleteAssignmentModal}
        onConfirmDeleteAssignment={handleConfirmDeleteAssignment}
        onCancelDeleteAssignment={handleCancelDeleteAssignment}
        reassigningService={reassigningService}
        selectedSlot={selectedSlot}
      />
    </div>
  );
}
