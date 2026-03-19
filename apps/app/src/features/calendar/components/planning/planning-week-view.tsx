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
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { SlotCellContent, TimeLabelCell } from "./slot-cell-shared";
import { usePlanningGrid } from "./use-planning-grid";
import { PlanningGridOverlays } from "./planning-grid-overlays";

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

  const handleCellClick = useCallback(
    (day: WeekDay, slot: { hour: number; minutes: number }) => {
      handleSelectSlot({
        date: day.date,
        hour: slot.hour,
        minutes: slot.minutes,
        dayIndex: weekDays.findIndex((d) => d.date === day.date),
      });
    },
    [handleSelectSlot, weekDays]
  );

  const isSlotSelected = useCallback(
    (day: WeekDay, slot: { hour: number; minutes: number }) => {
      return checkSlotSelected(day.date, slot.hour, slot.minutes);
    },
    [checkSlotSelected]
  );

  const getPlannedServicesForSlot = useCallback(
    (day: WeekDay, slot: { hour: number; minutes: number }) => {
      return getServicesForSlot(day.date, slot.hour, slot.minutes);
    },
    [getServicesForSlot]
  );

  return (
    <div className="w-full h-full overflow-auto">
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
              <TimeLabelCell
                label={slot.label}
                minHeight={rowMinHeight}
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
