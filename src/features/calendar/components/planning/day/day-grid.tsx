"use client";

import { Fragment, useMemo, useCallback, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import { twMerge } from "tailwind-merge";
import type { DayInfo } from "../planning-day-view.types";
import { generateTimeSlots } from "@/features/calendar/services/calendar.service";
import {
  usePlanningSelection,
  TIME_WINDOW_COLORS,
  TimeWindowUtils,
  type PlannedService,
  type TimeWindow,
} from "../planning-selection-context";
import {
  ServiceContextMenu,
  type ContextMenuPosition,
} from "../service-context-menu";
import { DeleteConfirmationModal } from "../delete-confirmation-modal";
import { ReassignmentConnector } from "../reassignment-connector";
import { ShowNotification } from "@/features/notifications/notification";

interface DayGridProps {
  lang: string;
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

const BLOCKED_STRIPE_CLASS =
  "[background:repeating-linear-gradient(45deg,rgb(254,242,242),rgb(254,242,242)_4px,rgba(239,68,68,0.2)_4px,rgba(239,68,68,0.2)_8px)] dark:[background:repeating-linear-gradient(45deg,rgb(55,48,48),rgb(55,48,48)_4px,rgba(239,68,68,0.3)_4px,rgba(239,68,68,0.3)_8px)]";

interface SlotState {
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

function computeSlotState(
  currentDate: Date,
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
  const slotBlocked = deps.isSlotBlocked(currentDate, slot.hour, slot.minutes);
  const timeWindow = deps.getTimeWindowForSlot(
    currentDate,
    slot.hour,
    slot.minutes
  );
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
    ? deps.getRemainingQuota(timeWindow, currentDate)
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

function getSlotCellClassName(
  state: SlotState,
  isPastDay: boolean,
  selected: boolean,
  isLast: boolean
): string {
  const {
    slotBlocked,
    hasTimeWindow,
    isQuotaFull,
    isDisabled,
    windowColor,
    blockedStripeClass,
  } = state;
  return twMerge(
    "h-full w-full relative",
    "border-l border-t border-r border-gray-200 dark:border-gray-700",
    "transition-all duration-200 p-1",
    blockedStripeClass,
    isPastDay && "bg-gray-100 dark:bg-gray-900/50 opacity-50",
    isDisabled ? "cursor-not-allowed" : "cursor-pointer",
    !isPastDay && !slotBlocked && isQuotaFull && "opacity-60",
    !isPastDay &&
      !slotBlocked &&
      hasTimeWindow &&
      !selected &&
      !isQuotaFull &&
      windowColor.bg,
    !isPastDay &&
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
    isLast && "border-b rounded-br-lg"
  );
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
      className={getSlotCellClassName(state, isPastDay, selected, isLastSlot)}
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

interface PlannedServiceChipProps {
  plannedService: PlannedService;
  isBeingReassigned: boolean;
  onContextMenu: (e: React.MouseEvent, ps: PlannedService) => void;
}

function PlannedServiceChip({
  plannedService,
  isBeingReassigned,
  onContextMenu,
}: Readonly<PlannedServiceChipProps>) {
  const hasUrgencia = plannedService.service.incidencias.includes("urgencia");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ContextMenu" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const syntheticEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      } as React.MouseEvent;
      onContextMenu(syntheticEvent, plannedService);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onContextMenu={(e) => onContextMenu(e, plannedService)}
      onKeyDown={handleKeyDown}
      className={twMerge(
        "flex-1 rounded flex items-center justify-start cursor-context-menu",
        "text-xs font-medium truncate px-1 border-l-4",
        hasUrgencia
          ? "bg-purple-100 text-purple-800 border-purple-600 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-400"
          : "bg-blue-100 text-blue-800 border-blue-600 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-400",
        isBeingReassigned && "ring-2 ring-amber-500 ring-offset-1 animate-pulse"
      )}
      title={`${plannedService.service.id} - Clic derecho para opciones`}
    >
      {plannedService.service.id}
    </div>
  );
}

export default function DayGrid({
  lang,
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
    reassigningService,
  } = usePlanningSelection();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: ContextMenuPosition;
    plannedService: PlannedService | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    plannedService: null,
  });

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    plannedService: PlannedService | null;
  }>({
    isOpen: false,
    plannedService: null,
  });

  // Context menu handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, plannedService: PlannedService) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        plannedService,
      });
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleReassign = useCallback(
    (plannedService: PlannedService) => {
      startReassignment(plannedService);
      ShowNotification({
        type: "info",
        message: "Seleccione una nueva fecha y hora para reasignar el servicio",
      });
    },
    [startReassignment]
  );

  const handleDeleteRequest = useCallback((plannedService: PlannedService) => {
    setDeleteModal({
      isOpen: true,
      plannedService,
    });
  }, []);

  const handleConfirmDelete = useCallback(
    async (plannedService: PlannedService) => {
      console.log("handleConfirmDelete", plannedService);
      if (plannedService) {
        try {
          await removeService(plannedService.service.id);
          ShowNotification({
            type: "success",
            message: "Asignación eliminada",
          });
        } catch (error) {
          console.error("Error deleting planned service:", error);
          ShowNotification({
            type: "error",
            message:
              "Error al eliminar la asignación. Por favor, intente nuevamente.",
          });
        }
      }
      setDeleteModal({ isOpen: false, plannedService: null });
    },
    [removeService]
  );

  const handleCancelDelete = useCallback(() => {
    setDeleteModal({ isOpen: false, plannedService: null });
  }, []);

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
      return plannedServices.filter(
        (ps) =>
          dayjs(ps.slot.date).isSame(currentDate, "day") &&
          ps.slot.hour === slot.hour &&
          ps.slot.minutes === slot.minutes
      );
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
        onDelete={handleDeleteRequest}
        onClose={handleCloseContextMenu}
      />

      {/* Delete Confirmation Modal */}
      {deleteModal.plannedService && (
        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          plannedService={deleteModal.plannedService}
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
