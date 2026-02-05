"use client";

import { Button, Datepicker, Select } from "flowbite-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiPlus, HiTrash, HiCheck, HiClock, HiCalendar } from "react-icons/hi";
import { HiNoSymbol } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";
import dayjs from "dayjs";
import {
  type TimeBlock,
  type ParsedWeeklyPattern,
  TimeWindowUtils,
  usePlanningSelection,
} from "../planning-selection-context";

const MIN_HOUR = 0;
const MAX_HOUR = 23;

// Days using format standard: 1=Monday, 7=Sunday
const DAYS_OF_WEEK = [
  { value: 1, label: "L", fullLabel: "Lunes" },
  { value: 2, label: "M", fullLabel: "Martes" },
  { value: 3, label: "X", fullLabel: "Miércoles" },
  { value: 4, label: "J", fullLabel: "Jueves" },
  { value: 5, label: "V", fullLabel: "Viernes" },
  { value: 6, label: "S", fullLabel: "Sábado" },
  { value: 7, label: "D", fullLabel: "Domingo" },
];

function generateTimeOptions(
  minHour = MIN_HOUR,
  maxHour = MAX_HOUR
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let hour = minHour; hour <= maxHour; hour++) {
    for (const minutes of [0, 30]) {
      if (hour === maxHour && minutes > 0) continue;
      const value = `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      options.push({ value, label: value });
    }
  }
  return options;
}

function parseTime(timeStr: string): { hour: number; minutes: number } {
  const [hour, minutes] = timeStr.split(":").map(Number);
  return { hour, minutes };
}

function formatTime(hour: number, minutes: number): string {
  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function timeToMinutes(hour: number, minutes: number): number {
  return hour * 60 + minutes;
}

/**
 * Get parsed weekly pattern or default values for a time block
 */
function getBlockPattern(block: TimeBlock): ParsedWeeklyPattern {
  if (block.type === "weekly" && block.weeklyPattern) {
    const parsed = TimeWindowUtils.parseWeeklyPattern(block.weeklyPattern);
    if (parsed) return parsed;
  }
  if (block.type === "daily-override") {
    const timeRange = TimeWindowUtils.getTimeRange(block);
    if (timeRange) {
      return {
        weeks: [],
        days: [],
        ...timeRange,
      };
    }
  }
  // Default values
  return {
    weeks: [],
    days: [1, 2, 3, 4, 5],
    startHour: 8,
    startMinutes: 0,
    endHour: 12,
    endMinutes: 0,
  };
}

/**
 * Check if two time blocks have overlapping days
 */
function hasOverlappingDays(a: TimeBlock, b: TimeBlock): boolean {
  const aPattern = getBlockPattern(a);
  const bPattern = getBlockPattern(b);
  return aPattern.days.some((day) => bPattern.days.includes(day));
}

/**
 * Check if two time blocks have overlapping weeks
 */
function hasOverlappingWeeks(a: TimeBlock, b: TimeBlock): boolean {
  const aPattern = getBlockPattern(a);
  const bPattern = getBlockPattern(b);
  if (aPattern.weeks.length === 0 || bPattern.weeks.length === 0) return true;
  return aPattern.weeks.some((week) => bPattern.weeks.includes(week));
}

/**
 * Check if two time ranges overlap
 */
function hasOverlappingTime(a: TimeBlock, b: TimeBlock): boolean {
  const aPattern = getBlockPattern(a);
  const bPattern = getBlockPattern(b);
  const aStart = timeToMinutes(aPattern.startHour, aPattern.startMinutes);
  const aEnd = timeToMinutes(aPattern.endHour, aPattern.endMinutes);
  const bStart = timeToMinutes(bPattern.startHour, bPattern.startMinutes);
  const bEnd = timeToMinutes(bPattern.endHour, bPattern.endMinutes);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Check if two time blocks collide (overlap in days, weeks, AND time)
 */
function blocksCollide(a: TimeBlock, b: TimeBlock): boolean {
  if (a.type === "daily-override" || b.type === "daily-override") {
    return false;
  }
  return (
    hasOverlappingDays(a, b) &&
    hasOverlappingWeeks(a, b) &&
    hasOverlappingTime(a, b)
  );
}

/**
 * Get IDs of blocks that collide with the given block
 */
function getCollidingBlockIds(
  block: TimeBlock,
  allBlocks: TimeBlock[]
): string[] {
  return allBlocks
    .filter((b) => b.id !== block.id && blocksCollide(block, b))
    .map((b) => b.id);
}

/**
 * Portal-based Datepicker that renders outside overflow:hidden containers
 */
function PortalDatepicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (date: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-datepicker-portal]") &&
        !triggerRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const displayDate = value
    ? dayjs(value).format("DD/MM/YYYY")
    : "Seleccionar fecha";
  const dayName = value ? dayjs(value).format("dddd") : "";
  const minDate = dayjs().startOf("day").toDate();

  return (
    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
      <HiCalendar className="h-4 w-4 text-red-500 shrink-0" />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex-1 text-left text-sm font-medium text-red-700 dark:text-red-300 bg-transparent border-0 focus:outline-none cursor-pointer"
      >
        {displayDate}
      </button>
      {dayName && (
        <span className="text-xs text-red-600 dark:text-red-400 font-medium">
          {dayName}
        </span>
      )}
      {isOpen &&
        createPortal(
          <div
            data-datepicker-portal
            className="fixed z-9999"
            style={{ top: position.top, left: position.left }}
          >
            <Datepicker
              inline
              value={value ? dayjs(value).toDate() : undefined}
              minDate={minDate}
              onChange={(date) => {
                if (date) {
                  onChange(dayjs(date).format("YYYY-MM-DD"));
                }
                setIsOpen(false);
              }}
              language="es-ES"
              labelTodayButton="Hoy"
              labelClearButton="Limpiar"
              showClearButton={false}
            />
          </div>,
          document.body
        )}
    </div>
  );
}

interface TimeBlockManagerProps {
  onBlocksChange?: (blocks: TimeBlock[]) => void;
}

export default function TimeBlockManager({
  onBlocksChange,
}: Readonly<TimeBlockManagerProps>) {
  const { timeBlocks, setTimeBlocks, syncTimeSlotsToAPI } = usePlanningSelection();
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  // Auto-delete expired daily-override blocks (date before today)
  useEffect(() => {
    const expiredIds = timeBlocks
      .filter((b) => TimeWindowUtils.isExpired(b))
      .map((b) => b.id);

    if (expiredIds.length > 0) {
      setTimeBlocks(timeBlocks.filter((b) => !expiredIds.includes(b.id)));
    }
  }, [timeBlocks, setTimeBlocks]);

  // Calculate which blocks have collisions (only weekly vs weekly)
  const blocksWithCollisions = useMemo(() => {
    const collisions = new Set<string>();
    const weeklyBlocks = timeBlocks.filter((b) => b.type === "weekly");
    for (const block of weeklyBlocks) {
      const collidingIds = getCollidingBlockIds(block, weeklyBlocks);
      if (collidingIds.length > 0) {
        collisions.add(block.id);
        collidingIds.forEach((id) => collisions.add(id));
      }
    }
    return collisions;
  }, [timeBlocks]);

  const hasAnyCollision = blocksWithCollisions.size > 0;

  const addTimeBlock = useCallback(
    (type: "weekly" | "daily-override" = "weekly") => {
      const today = dayjs();
      const newBlock: TimeBlock =
        type === "weekly"
          ? {
              id: crypto.randomUUID(),
              name: "",
              kind: "block",
              type: "weekly",
              weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
                [], // All weeks
                [1, 2, 3, 4, 5], // Monday to Friday
                8,
                0,
                12,
                0
              ),
            }
          : {
              id: crypto.randomUUID(),
              name: "",
              kind: "block",
              type: "daily-override",
              startTimestamp: today
                .hour(8)
                .minute(0)
                .second(0)
                .format("YYYY-MM-DDTHH:mm:ss"),
              endTimestamp: today
                .hour(12)
                .minute(0)
                .second(0)
                .format("YYYY-MM-DDTHH:mm:ss"),
            };
      setTimeBlocks([...timeBlocks, newBlock]);
    },
    [timeBlocks, setTimeBlocks]
  );

  const updateBlockType = useCallback(
    (id: string, type: "weekly" | "daily-override") => {
      setTimeBlocks(
        timeBlocks.map((b) => {
          if (b.id !== id) return b;
          const pattern = getBlockPattern(b);
          const today = dayjs();

          if (type === "daily-override") {
            return {
              ...b,
              type,
              weeklyPattern: undefined,
              startTimestamp: today
                .hour(pattern.startHour)
                .minute(pattern.startMinutes)
                .second(0)
                .format("YYYY-MM-DDTHH:mm:ss"),
              endTimestamp: today
                .hour(pattern.endHour)
                .minute(pattern.endMinutes)
                .second(0)
                .format("YYYY-MM-DDTHH:mm:ss"),
            };
          }
          return {
            ...b,
            type,
            startTimestamp: undefined,
            endTimestamp: undefined,
            weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
              [],
              [1, 2, 3, 4, 5],
              pattern.startHour,
              pattern.startMinutes,
              pattern.endHour,
              pattern.endMinutes
            ),
          };
        })
      );
    },
    [timeBlocks, setTimeBlocks]
  );

  const updateDailyOverrideDate = useCallback(
    (id: string, date: string) => {
      setTimeBlocks(
        timeBlocks.map((b) => {
          if (b.id !== id || b.type !== "daily-override") return b;
          const pattern = getBlockPattern(b);
          const newDate = dayjs(date);
          return {
            ...b,
            startTimestamp: newDate
              .hour(pattern.startHour)
              .minute(pattern.startMinutes)
              .second(0)
              .format("YYYY-MM-DDTHH:mm:ss"),
            endTimestamp: newDate
              .hour(pattern.endHour)
              .minute(pattern.endMinutes)
              .second(0)
              .format("YYYY-MM-DDTHH:mm:ss"),
          };
        })
      );
    },
    [timeBlocks, setTimeBlocks]
  );

  const updateBlockName = useCallback(
    (id: string, name: string) => {
      setTimeBlocks(timeBlocks.map((b) => (b.id === id ? { ...b, name } : b)));
    },
    [timeBlocks, setTimeBlocks]
  );

  const removeTimeBlock = useCallback(
    (id: string) => {
      setTimeBlocks(timeBlocks.filter((b) => b.id !== id));
    },
    [timeBlocks, setTimeBlocks]
  );

  const toggleDay = useCallback(
    (id: string, day: number) => {
      setTimeBlocks(
        timeBlocks.map((b) => {
          if (b.id !== id || b.type !== "weekly") return b;
          const pattern = getBlockPattern(b);
          const days = pattern.days.includes(day)
            ? pattern.days.filter((d) => d !== day)
            : [...pattern.days, day];
          return {
            ...b,
            weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
              pattern.weeks,
              days,
              pattern.startHour,
              pattern.startMinutes,
              pattern.endHour,
              pattern.endMinutes
            ),
          };
        })
      );
    },
    [timeBlocks, setTimeBlocks]
  );

  const toggleAllDays = useCallback(
    (id: string) => {
      setTimeBlocks(
        timeBlocks.map((b) => {
          if (b.id !== id || b.type !== "weekly") return b;
          const pattern = getBlockPattern(b);
          const allDays = DAYS_OF_WEEK.map((d) => d.value);
          const hasAllDays = allDays.every((d) => pattern.days.includes(d));
          const newDays = hasAllDays ? [] : allDays;
          return {
            ...b,
            weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
              pattern.weeks,
              newDays,
              pattern.startHour,
              pattern.startMinutes,
              pattern.endHour,
              pattern.endMinutes
            ),
          };
        })
      );
    },
    [timeBlocks, setTimeBlocks]
  );

  const updateTimeBlock = useCallback(
    (id: string, field: "start" | "end", timeStr: string) => {
      const { hour, minutes } = parseTime(timeStr);
      setTimeBlocks(
        timeBlocks.map((b) => {
          if (b.id !== id) return b;
          const pattern = getBlockPattern(b);

          let newStartHour = pattern.startHour;
          let newStartMinutes = pattern.startMinutes;
          let newEndHour = pattern.endHour;
          let newEndMinutes = pattern.endMinutes;

          if (field === "start") {
            const newStartMin = timeToMinutes(hour, minutes);
            const endMin = timeToMinutes(pattern.endHour, pattern.endMinutes);
            if (newStartMin >= endMin) {
              const adjustedEnd = newStartMin + 30;
              newEndHour = Math.min(Math.floor(adjustedEnd / 60), MAX_HOUR);
              newEndMinutes = newEndHour === MAX_HOUR ? 0 : adjustedEnd % 60;
            }
            newStartHour = hour;
            newStartMinutes = minutes;
          } else {
            const startMin = timeToMinutes(
              pattern.startHour,
              pattern.startMinutes
            );
            const newEndMin = timeToMinutes(hour, minutes);
            if (newEndMin <= startMin) {
              const adjustedStart = Math.max(newEndMin - 30, 0);
              newStartHour = Math.floor(adjustedStart / 60);
              newStartMinutes = adjustedStart % 60;
            }
            newEndHour = hour;
            newEndMinutes = minutes;
          }

          if (b.type === "weekly") {
            return {
              ...b,
              weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
                pattern.weeks,
                pattern.days,
                newStartHour,
                newStartMinutes,
                newEndHour,
                newEndMinutes
              ),
            };
          }

          const currentDate = b.startTimestamp
            ? dayjs(b.startTimestamp)
            : dayjs();
          return {
            ...b,
            startTimestamp: currentDate
              .hour(newStartHour)
              .minute(newStartMinutes)
              .second(0)
              .format("YYYY-MM-DDTHH:mm:ss"),
            endTimestamp: currentDate
              .hour(newEndHour)
              .minute(newEndMinutes)
              .second(0)
              .format("YYYY-MM-DDTHH:mm:ss"),
          };
        })
      );
    },
    [timeBlocks, setTimeBlocks]
  );

  const handleApply = useCallback(async () => {
    try {
      // Sync current time blocks to API
      await syncTimeSlotsToAPI();
      // Call the parent callback (closes modal, etc.)
      onBlocksChange?.(timeBlocks);
    } catch (error) {
      console.error("Error syncing time blocks to API:", error);
      // Still call the callback to close modal even if API sync fails
      onBlocksChange?.(timeBlocks);
    }
  }, [timeBlocks, onBlocksChange, syncTimeSlotsToAPI]);

  return (
    <div className="z-50 min-w-[320px]">
      {/* Time Blocks List */}
      <div className="p-3 space-y-3 max-h-[350px] overflow-y-auto overflow-x-visible">
        {timeBlocks.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
            <HiNoSymbol className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No hay bloqueos definidos
          </div>
        )}
        {timeBlocks.map((block, index) => {
          const pattern = getBlockPattern(block);
          const hasCollision = blocksWithCollisions.has(block.id);
          const blockDate = TimeWindowUtils.getDate(block);

          return (
            <div
              key={block.id}
              className={twMerge(
                "rounded-xl border",
                "bg-white dark:bg-gray-800",
                "shadow-sm",
                hasCollision
                  ? "border-orange-400 dark:border-orange-500 ring-2 ring-orange-200 dark:ring-orange-900/50"
                  : "border-gray-200 dark:border-gray-700"
              )}
            >
              {/* Header with name */}
              <div
                className={twMerge(
                  "flex items-center justify-between px-3 py-2 border-b rounded-t-xl",
                  hasCollision
                    ? "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800"
                    : "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700"
                )}
              >
                <div className="flex items-center gap-2 flex-1">
                  <HiNoSymbol className="h-4 w-4 text-gray-500 shrink-0" />
                  {hasCollision && (
                    <span
                      className="text-orange-500 text-xs"
                      title="Conflicto de horarios"
                    >
                      ⚠️
                    </span>
                  )}
                  <input
                    type="text"
                    value={block.name}
                    onChange={(e) => updateBlockName(block.id, e.target.value)}
                    placeholder={`Bloqueo ${index + 1}`}
                    className={twMerge(
                      "text-sm font-semibold bg-transparent border-0 focus:ring-0 p-0 flex-1 max-w-[180px] placeholder:text-gray-400",
                      hasCollision
                        ? "text-orange-700 dark:text-orange-300"
                        : "text-gray-900 dark:text-white"
                    )}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTimeBlock(block.id)}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                  title="Eliminar bloqueo"
                >
                  <HiTrash className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-3 flex flex-col gap-2.5 overflow-visible">
                {/* Block Type Toggle */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg flex-1">
                    <button
                      type="button"
                      onClick={() => updateBlockType(block.id, "weekly")}
                      className={twMerge(
                        "flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all duration-200",
                        block.type === "weekly"
                          ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      )}
                    >
                      Semanal
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateBlockType(block.id, "daily-override")
                      }
                      className={twMerge(
                        "flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all duration-200",
                        block.type === "daily-override"
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      )}
                    >
                      Día específico
                    </button>
                  </div>
                </div>

                {/* Time Range */}
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
                  <HiClock className="h-4 w-4 text-gray-400 shrink-0" />
                  <Select
                    id={`start-${block.id}`}
                    sizing="sm"
                    value={formatTime(pattern.startHour, pattern.startMinutes)}
                    onChange={(e) =>
                      updateTimeBlock(block.id, "start", e.target.value)
                    }
                    className="flex-1 [&>select]:bg-transparent [&>select]:border-0 [&>select]:py-1"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                  <span className="text-gray-300 dark:text-gray-600">→</span>
                  <Select
                    id={`end-${block.id}`}
                    sizing="sm"
                    value={formatTime(pattern.endHour, pattern.endMinutes)}
                    onChange={(e) =>
                      updateTimeBlock(block.id, "end", e.target.value)
                    }
                    className="flex-1 [&>select]:bg-transparent [&>select]:border-0 [&>select]:py-1"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Days of Week - Only for weekly blocks */}
                {block.type === "weekly" ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleAllDays(block.id)}
                      title={
                        pattern.days.length === 7
                          ? "Deseleccionar todos"
                          : "Seleccionar todos"
                      }
                      className={twMerge(
                        "shrink-0 w-7 h-7 text-[9px] font-bold rounded-md transition-all duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1",
                        pattern.days.length === 7
                          ? "bg-red-500 text-white shadow-sm hover:bg-red-600"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                      )}
                    >
                      ✓
                    </button>
                    <div className="flex items-center flex-1 gap-0.5">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = pattern.days.includes(day.value);
                        const isWeekend = day.value === 6 || day.value === 7;
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDay(block.id, day.value)}
                            title={day.fullLabel}
                            className={twMerge(
                              "flex-1 h-7 text-[10px] font-semibold rounded-md transition-all duration-200",
                              "focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1",
                              isSelected
                                ? "bg-red-500 text-white shadow-sm hover:bg-red-600"
                                : isWeekend
                                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Daily Override - Date Selection */
                  <PortalDatepicker
                    value={blockDate ?? undefined}
                    onChange={(date) => updateDailyOverrideDate(block.id, date)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div
        className={twMerge(
          "p-3 border-t flex items-center justify-between",
          hasAnyCollision
            ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
            : "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700"
        )}
      >
        <Button color="light" size="sm" onClick={() => addTimeBlock("weekly")}>
          <HiPlus className="h-4 w-4 mr-1.5" />
          Bloqueo
        </Button>

        <Button
          size="sm"
          onClick={handleApply}
          disabled={hasAnyCollision}
          color={hasAnyCollision ? "failure" : undefined}
          className={hasAnyCollision ? "opacity-50 cursor-not-allowed" : ""}
        >
          <HiCheck className="h-4 w-4 mr-1.5" />
          Aplicar
        </Button>
      </div>
    </div>
  );
}

export type { TimeBlock };
