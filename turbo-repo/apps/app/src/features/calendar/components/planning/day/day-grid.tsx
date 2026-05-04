"use client";

import { Fragment, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import { twMerge } from "tailwind-merge";
import type { DayInfo } from "../planning-day-view.types";
import type { PlannedService } from "../planning-selection-context";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import {
  computeSlotState,
  getSlotCellClassName,
  type SlotState,
} from "../planning-slot-utils";
import { SlotCellContent, TimeLabelCell } from "../slot-cell-shared";
import { usePlanningGrid } from "../use-planning-grid";
import { PlanningGridOverlays } from "../planning-grid-overlays";
import { ShiftOverlayLayer } from "../shift-overlay-layer";
import { buildShiftLayout, type PositionedShift } from "../shift-layout";

interface DayGridProps {
  lang: string;
  dict: I18nDictionary;
  currentDate: Date;
  startHour?: number;
  endHour?: number;
}

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
  slot,
  currentDate,
  isPastDay,
  state,
  isLastSlot,
}: Readonly<DayGridSlotCellProps>) {
  return (
    <div
      data-slot-date={dayjs(currentDate).format("YYYY-MM-DD")}
      data-slot-time={`${slot.hour.toString().padStart(2, "0")}:${slot.minutes.toString().padStart(2, "0")}`}
      className={getSlotCellClassName(state, isPastDay, {
        isLastSlot,
        isFirstEditable: !isPastDay,
      })}
    >
      <SlotCellContent state={state} isPastDay={isPastDay} />
    </div>
  );
}

export default function DayGrid({
  lang,
  dict,
  currentDate,
  startHour = 8,
  endHour = 22,
}: Readonly<DayGridProps>) {
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
      handleSelectSlot({
        date: shift.date,
        hour: shift.slotHour,
        minutes: shift.slotMinutes,
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
  // height. The constant matches the previous base value so the overall
  // grid density is unchanged.
  const ROW_HEIGHT_PX = 48;
  const rowOffsets = useMemo(() => {
    const offsets = [0];
    for (let i = 0; i < timeSlots.length; i++) {
      offsets.push(offsets[i] + ROW_HEIGHT_PX);
    }
    return offsets;
  }, [timeSlots.length]);

  // Index planned services by exact start "HH:MM" on the current date so
  // the overlay layer can fetch the chips that belong inside each shift
  // rectangle in O(1).
  const servicesByStartOnDate = useMemo(() => {
    const map = new Map<string, PlannedService[]>();
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

  return (
    <div className="w-full h-full overflow-auto">
     <div className="relative">
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
                minHeight={ROW_HEIGHT_PX}
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

      {/* Shift overlay: each rectangle owns its own chips and "add booking"
          affordance. Sits over the day column only. */}
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

      {/* Context Menu */}
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
