"use client";

import { Fragment, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import { twMerge } from "tailwind-merge";
import type { DayInfo } from "../planning-day-view.types";
import { generateTimeSlots } from "@/features/calendar/services/calendar.service";
import {
  usePlanningSelection,
  type PlannedService,
} from "../planning-selection-context";
import { ServiceContextMenu } from "../service-context-menu";
import {
  DeleteConfirmationModal,
  getDeleteModalMessages,
} from "../delete-confirmation-modal";
import { ReassignmentConnector } from "../reassignment-connector";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { PlannedServiceChip } from "../planned-service-chip";
import {
  computeSlotState,
  getSlotCellClassName,
  type SlotState,
} from "../planning-slot-utils";
import { useServiceActions } from "../use-service-actions";

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
}: Readonly<DayGridSlotCellProps>) {
  const {
    slotBlocked,
    timeWindow,
    isWindowStart,
    remainingQuota,
    isQuotaFull,
    isDisabled,
    windowColor,
  } = state;

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
      })}
    >
      {!isPastDay && slotBlocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-red-500/60 text-lg">⊘</span>
        </div>
      )}
      {!isPastDay && !slotBlocked && isWindowStart && timeWindow?.name && (
        <div className="absolute -top-0.5 left-1 right-1 flex items-center justify-center pointer-events-none">
          <span
            className={twMerge(
              "text-[9px] font-semibold px-1.5 py-0.5 rounded-b shadow-sm truncate max-w-full",
              isQuotaFull
                ? "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-800/80"
                : windowColor.badge
            )}
          >
            {timeWindow.name}
          </span>
        </div>
      )}
      {!isPastDay && !slotBlocked && isWindowStart && timeWindow && (
        <div className="absolute top-0.5 right-0.5">
          <span
            className={twMerge(
              "text-[9px] font-bold px-1 rounded",
              isQuotaFull
                ? "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50"
                : windowColor.badge
            )}
          >
            {remainingQuota}/{timeWindow.quota}
          </span>
        </div>
      )}
      {slotServices.length > 0 && (
        <div className="absolute inset-1 flex flex-row gap-0.5">
          {slotServices.map((ps) => (
            <PlannedServiceChip
              key={ps.service.id}
              plannedService={ps}
              isBeingReassigned={
                reassigningService?.service.service.id === ps.service.id
              }
              onContextMenu={onContextMenu}
              className="flex-1"
            />
          ))}
        </div>
      )}
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
    selectSlot,
    plannedServices,
    getTimeWindowForSlot,
    getRemainingQuota,
    isSlotBlocked,
    removeService,
    startReassignment,
    startAssignment,
    reassigningService,
  } = usePlanningSelection();

  // Use shared hook for context menu and delete modal
  const {
    contextMenu,
    deleteModal,
    handleContextMenu,
    handleCloseContextMenu,
    handleReassign,
    handleAssign,
    handleDeleteRequest,
    handleConfirmDelete,
    handleCancelDelete,
  } = useServiceActions({ removeService, startReassignment, startAssignment });

  const timeSlots = useMemo(
    () => generateTimeSlots(startHour, endHour),
    [startHour, endHour]
  );

  const dayInfo = useMemo(
    () => getDayInfo(currentDate, lang),
    [currentDate, lang]
  );

  // Check if the current day is in the past
  const isPastDay = useMemo(() => {
    return dayjs(currentDate).isBefore(dayjs().startOf("day"), "day");
  }, [currentDate]);

  const isLastSlot = (idx: number) => idx === timeSlots.length - 1;

  const handleCellClick = useCallback(
    (slot: { hour: number; minutes: number }) => {
      selectSlot({
        date: currentDate,
        hour: slot.hour,
        minutes: slot.minutes,
      });
    },
    [selectSlot, currentDate]
  );

  const isSlotSelected = useCallback(
    (slot: { hour: number; minutes: number }) => {
      if (!selectedSlot) return false;
      return (
        dayjs(selectedSlot.date).isSame(currentDate, "day") &&
        selectedSlot.hour === slot.hour &&
        selectedSlot.minutes === slot.minutes
      );
    },
    [selectedSlot, currentDate]
  );

  const getPlannedServicesForSlot = useCallback(
    (slot: { hour: number; minutes: number }) => {
      const cellStartMin = slot.hour * 60 + slot.minutes;
      const cellEndMin = cellStartMin + 30;
      return plannedServices.filter((ps) => {
        if (!dayjs(ps.slot.date).isSame(currentDate, "day")) return false;
        const serviceMin = ps.slot.hour * 60 + ps.slot.minutes;
        return serviceMin >= cellStartMin && serviceMin < cellEndMin;
      });
    },
    [plannedServices, currentDate]
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
              "bg-gray-50 dark:bg-gray-900 rounded-tr-lg"
            )}
          >
            <span
              className={twMerge(
                "text-sm font-medium capitalize",
                dayInfo.isToday
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-500 dark:text-gray-400"
              )}
            >
              {dayInfo.dayName}
            </span>
            <span
              className={twMerge(
                "text-2xl font-bold",
                dayInfo.isToday
                  ? "bg-primary-600 text-white rounded-full w-10 h-10 flex items-center justify-center"
                  : "text-gray-900 dark:text-white"
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
              <div
                style={{ minHeight: `${rowMinHeight}px` }}
                className={twMerge(
                  "flex items-start justify-end pr-2 pt-0.5",
                  "border-l border-t border-gray-200 dark:border-gray-700",
                  "text-xs text-gray-500 dark:text-gray-400",
                  isLastSlot(slotIdx) && "border-b rounded-bl-lg"
                )}
              >
                {slot.label}
              </div>
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
              />
            </Fragment>
          );
        })}
      </div>

      {/* Context Menu */}
      <ServiceContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        plannedService={contextMenu.plannedService}
        onReassign={handleReassign}
        onAssign={handleAssign}
        onDelete={handleDeleteRequest}
        onClose={handleCloseContextMenu}
        dict={dict}
      />

      {/* Delete Confirmation Modal */}
      {deleteModal.plannedService && (
        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          plannedService={deleteModal.plannedService}
          messages={getDeleteModalMessages(
            dict,
            deleteModal.plannedService.service.id
          )}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {/* Reassignment Connector - shows line between original and target slot */}
      {reassigningService && (
        <ReassignmentConnector
          originSlot={reassigningService.originalSlot}
          targetSlot={selectedSlot}
          serviceId={reassigningService.service.service.id}
        />
      )}
    </div>
  );
}
