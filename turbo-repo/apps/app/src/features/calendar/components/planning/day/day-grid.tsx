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
  selected: boolean;
  slotServices: PlannedService[];
  isLastSlot: boolean;
  reassigningService: {
    service: PlannedService;
    originalSlot: { date: Date; hour: number; minutes: number };
  } | null;
  onCellClick: (slot: { hour: number; minutes: number }) => void;
  onContextMenu: (e: React.MouseEvent, ps: PlannedService) => void;
  onChipClick: (ps: PlannedService) => void;
  dict: I18nDictionary;
}

function DayGridSlotCell({
  slot,
  currentDate,
  isPastDay,
  state,
  selected,
  slotServices,
  isLastSlot,
  reassigningService,
  onCellClick,
  onContextMenu,
  onChipClick,
  dict,
}: Readonly<DayGridSlotCellProps>) {
  const { slotBlocked, isDisabled } = state;

  const handleClick = () => {
    if (!isDisabled) onCellClick(slot);
  };

  const cellContent = (
    <button
      type="button"
      data-slot-date={dayjs(currentDate).format("YYYY-MM-DD")}
      data-slot-time={`${slot.hour.toString().padStart(2, "0")}:${slot.minutes.toString().padStart(2, "0")}`}
      onClick={handleClick}
      disabled={isDisabled}
      className={getSlotCellClassName(state, isPastDay, selected, {
        isLastSlot,
        isFirstEditable: !isPastDay,
      })}
    >
      <SlotCellContent
        state={state}
        isPastDay={isPastDay}
        services={slotServices}
        reassigningServiceId={reassigningService?.service.service.id}
        onContextMenu={onContextMenu}
        onChipClick={onChipClick}
        dict={dict}
        servicesLayout="row"
      />
    </button>
  );

  if (slotBlocked && !isPastDay) {
    return <div className="w-full h-full">{cellContent}</div>;
  }
  return cellContent;
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
    getPlannedServicesForSlot: getServicesForSlot,
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
  } = usePlanningGrid({ startHour, endHour });

  const dayInfo = useMemo(
    () => getDayInfo(currentDate, lang),
    [currentDate, lang]
  );

  // Check if the current day is in the past
  const isPastDay = useMemo(() => {
    return dayjs(currentDate).isBefore(dayjs().startOf("day"), "day");
  }, [currentDate]);

  const handleCellClick = useCallback(
    (slot: { hour: number; minutes: number }) => {
      handleSelectSlot({
        date: currentDate,
        hour: slot.hour,
        minutes: slot.minutes,
      });
    },
    [handleSelectSlot, currentDate]
  );

  const isSlotSelected = useCallback(
    (slot: { hour: number; minutes: number }) => {
      return checkSlotSelected(currentDate, slot.hour, slot.minutes);
    },
    [checkSlotSelected, currentDate]
  );

  const getPlannedServicesForSlot = useCallback(
    (slot: { hour: number; minutes: number }) => {
      return getServicesForSlot(currentDate, slot.hour, slot.minutes);
    },
    [getServicesForSlot, currentDate]
  );

  return (
    <div className="w-full h-full overflow-auto">
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
          const selected = isSlotSelected(slot);
          const slotServices = getPlannedServicesForSlot(slot);
          const rowMinHeight = 48 + Math.max(0, slotServices.length - 1) * 20;

          return (
            <Fragment key={slot.label}>
              <TimeLabelCell
                label={slot.label}
                minHeight={rowMinHeight}
                isLastSlot={isLastSlot(slotIdx)}
              />
              <DayGridSlotCell
                slot={slot}
                currentDate={currentDate}
                isPastDay={isPastDay}
                state={slotState}
                selected={selected}
                slotServices={slotServices}
                isLastSlot={isLastSlot(slotIdx)}
                reassigningService={reassigningService}
                onCellClick={handleCellClick}
                onContextMenu={handleContextMenu}
                onChipClick={viewPlannedService}
                dict={dict}
              />
            </Fragment>
          );
        })}
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
