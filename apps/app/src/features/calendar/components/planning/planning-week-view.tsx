"use client";

import { Fragment, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import isoWeek from "dayjs/plugin/isoWeek";
import { usePermissions } from "@/features/auth/hooks/use-permissions";

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
  getDeleteAssignmentMessages,
} from "./delete-confirmation-modal";
import { ReassignmentConnector } from "./reassignment-connector";
import { useServiceActions } from "./use-service-actions";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { SlotCellContent } from "./slot-cell-shared";

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
  dict: I18nRecord;
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
  dict,
}: Readonly<WeekSlotCellProps>) {
  const { slotBlocked, isDisabled } = slotState;
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
      <SlotCellContent
        state={slotState}
        isPastDay={dayIsPast}
        services={slotServices}
        reassigningServiceId={reassigningService?.service.service.id}
        onContextMenu={onContextMenu}
        dict={dict}
        servicesLayout="column"
      />
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
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  // Check if user has planning permission to select slots
  const canPlan = isLoadingPermissions || hasPermission(["GROUP_PLANNING"]);

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
    updateServiceDrivers,
  } = usePlanningSelection();

  // Create removeAssignment wrapper that clears driver assignments
  const removeAssignment = useCallback(
    async (serviceId: string) => {
      updateServiceDrivers(serviceId, undefined, undefined);
    },
    [updateServiceDrivers]
  );

  // Use shared hook for context menu and delete modal
  const {
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
  } = useServiceActions({
    removeService,
    removeAssignment,
    startReassignment,
    startAssignment,
  });

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
      if (!canPlan) return;
      selectSlot({
        date: day.date,
        hour: slot.hour,
        minutes: slot.minutes,
        dayIndex: weekDays.findIndex((d) => d.date === day.date),
      });
    },
    [selectSlot, weekDays, canPlan]
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
                    dict={dict}
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
        onDeleteAssignment={handleDeleteAssignmentRequest}
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

      {/* Delete Assignment Confirmation Modal */}
      {deleteAssignmentModal.plannedService && (
        <DeleteConfirmationModal
          isOpen={deleteAssignmentModal.isOpen}
          plannedService={deleteAssignmentModal.plannedService}
          messages={getDeleteAssignmentMessages(
            dict,
            deleteAssignmentModal.plannedService.service.id
          )}
          onConfirm={handleConfirmDeleteAssignment}
          onCancel={handleCancelDeleteAssignment}
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
