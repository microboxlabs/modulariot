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
import {
  generateTimeSlots,
  parseUrlDate,
} from "@/features/calendar/services/calendar.service";
import {
  usePlanningSelection,
  type PlannedService,
} from "./planning-selection-context";
import {
  computeSlotState,
  getSlotCellClassName,
  type SlotState,
} from "./planning-slot-utils";
import { ServiceContextMenu } from "./service-context-menu";
import {
  DeleteConfirmationModal,
  getDeleteModalMessages,
} from "./delete-confirmation-modal";
import { ReassignmentConnector } from "./reassignment-connector";
import { PlannedServiceChip } from "./planned-service-chip";
import { useServiceActions } from "./use-service-actions";

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
  selected: boolean;
  slotServices: PlannedService[];
  isLastDay: boolean;
  isLastSlot: boolean;
  reassigningService: {
    service: PlannedService;
    originalSlot: { date: Date; hour: number; minutes: number };
  } | null;
  onCellClick: (day: WeekDay, slot: { hour: number; minutes: number }) => void;
  onContextMenu: (e: React.MouseEvent, ps: PlannedService) => void;
}

function WeekSlotCell({
  day,
  slot,
  slotState,
  selected,
  slotServices,
  isLastDay,
  isLastSlot,
  reassigningService,
  onCellClick,
  onContextMenu,
}: Readonly<WeekSlotCellProps>) {
  const {
    slotBlocked,
    timeWindow,
    isWindowStart,
    remainingQuota,
    isQuotaFull,
    isDisabled,
    windowColor,
  } = slotState;
  const dayIsPast = dayjs(day.date).isBefore(dayjs().startOf("day"), "day");

  const handleClick = () => {
    if (!isDisabled) onCellClick(day, slot);
  };

  const cellContent = (
    <button
      type="button"
      tabIndex={isDisabled ? -1 : 0}
      onClick={handleClick}
      disabled={isDisabled}
      data-slot-date={dayjs(day.date).format("YYYY-MM-DD")}
      data-slot-time={`${slot.hour.toString().padStart(2, "0")}:${slot.minutes.toString().padStart(2, "0")}`}
      className={twMerge(
        "appearance-none border-0 p-0 m-0 text-left",
        getSlotCellClassName(slotState, dayIsPast, selected, {
          isLastDay,
          isLastSlot,
        })
      )}
    >
      {!dayIsPast && slotBlocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-red-500/60 text-lg">⊘</span>
        </div>
      )}
      {!dayIsPast && !slotBlocked && isWindowStart && timeWindow?.name && (
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
      {!dayIsPast && !slotBlocked && isWindowStart && timeWindow && (
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
        <div className="flex flex-col gap-0.5">
          {slotServices.map((ps) => (
            <PlannedServiceChip
              key={ps.service.id}
              plannedService={ps}
              isBeingReassigned={
                reassigningService?.service.service.id === ps.service.id
              }
              onContextMenu={onContextMenu}
              className="w-full h-5"
            />
          ))}
        </div>
      )}
    </button>
  );

  if (slotBlocked && !dayIsPast) {
    return <div className="w-full h-full">{cellContent}</div>;
  }

  return <div className="w-full h-full">{cellContent}</div>;
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

  // Read date from URL, fallback to prop or today
  const currentDate = useMemo(() => {
    const urlDate = parseUrlDate(searchParams.get("date"));
    if (urlDate) return urlDate.toDate();
    if (propDate) return propDate;
    return new Date();
  }, [searchParams, propDate]);

  const timeSlots = useMemo(
    () => generateTimeSlots(startHour, endHour),
    [startHour, endHour]
  );

  const weekDays = useMemo(
    () => generateWeekDays(currentDate, lang),
    [currentDate, lang]
  );

  // Get today for past day comparison
  const today = useMemo(() => dayjs().startOf("day"), []);

  const isLastDay = (idx: number) => idx === weekDays.length - 1;
  const isLastSlot = (idx: number) => idx === timeSlots.length - 1;
  const isPastDay = useCallback(
    (day: WeekDay) => dayjs(day.date).isBefore(today, "day"),
    [today]
  );

  const handleCellClick = useCallback(
    (day: WeekDay, slot: { hour: number; minutes: number }) => {
      selectSlot({
        date: day.date,
        hour: slot.hour,
        minutes: slot.minutes,
        dayIndex: weekDays.findIndex((d) => d.date === day.date),
      });
    },
    [selectSlot, weekDays]
  );

  const isSlotSelected = useCallback(
    (day: WeekDay, slot: { hour: number; minutes: number }) => {
      if (!selectedSlot) return false;
      return (
        dayjs(selectedSlot.date).isSame(day.date, "day") &&
        selectedSlot.hour === slot.hour &&
        selectedSlot.minutes === slot.minutes
      );
    },
    [selectedSlot]
  );

  const getPlannedServicesForSlot = useCallback(
    (day: WeekDay, slot: { hour: number; minutes: number }) => {
      const cellStartMin = slot.hour * 60 + slot.minutes;
      const cellEndMin = cellStartMin + 30;
      return plannedServices.filter((ps) => {
        if (!dayjs(ps.slot.date).isSame(day.date, "day")) return false;
        const serviceMin = ps.slot.hour * 60 + ps.slot.minutes;
        return serviceMin >= cellStartMin && serviceMin < cellEndMin;
      });
    },
    [plannedServices]
  );

  return (
    <div className="w-full h-full overflow-auto">
      <div
        className="grid min-w-[600px]"
        style={{
          gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)`,
        }}
      >
        {/* Header row - empty corner cell */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800">
          <div className="h-16 border-l border-t border-gray-200 dark:border-gray-700 rounded-tl-lg bg-gray-50 dark:bg-gray-900" />
        </div>

        {/* Header row - day columns */}
        {weekDays.map((day, idx) => (
          <div
            key={day.dayNumber}
            className="sticky top-0 z-10 bg-white dark:bg-gray-800"
          >
            <div
              className={twMerge(
                "h-16 flex flex-col items-center justify-center",
                "border-l border-t border-gray-200 dark:border-gray-700",
                "bg-gray-50 dark:bg-gray-900",
                isLastDay(idx) && "border-r rounded-tr-lg"
              )}
            >
              <span
                className={twMerge(
                  "text-xs font-medium",
                  day.isToday
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {day.dayName}
              </span>
              <span
                className={twMerge(
                  "text-lg font-semibold",
                  day.isToday
                    ? "bg-primary-600 text-white rounded-full w-8 h-8 flex items-center justify-center"
                    : "text-gray-900 dark:text-white"
                )}
              >
                {day.dayNumber}
              </span>
            </div>
          </div>
        ))}

        {/* Time slots grid */}
        {timeSlots.map((slot, slotIdx) => {
          // Calculate max services across all days for this time slot to determine row height
          const maxServicesInRow = Math.max(
            1,
            ...weekDays.map(
              (day) => getPlannedServicesForSlot(day, slot).length
            )
          );
          // Base height is 48px (h-12), add 20px per additional service
          const rowMinHeight = 48 + Math.max(0, maxServicesInRow - 1) * 20;

          return (
            <Fragment key={slot.label}>
              {/* Time label column */}
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
                const selected = isSlotSelected(day, slot);
                const slotServices = getPlannedServicesForSlot(day, slot);

                return (
                  <WeekSlotCell
                    key={`${day.dayNumber}-${slot.label}`}
                    day={day}
                    slot={slot}
                    slotState={slotState}
                    selected={selected}
                    slotServices={slotServices}
                    isLastDay={isLastDay(dayIdx)}
                    isLastSlot={isLastSlot(slotIdx)}
                    reassigningService={reassigningService}
                    onCellClick={handleCellClick}
                    onContextMenu={handleContextMenu}
                  />
                );
              })}
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
