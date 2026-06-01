"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Label } from "flowbite-react";
import { HiCheck, HiChevronDown } from "react-icons/hi";
import { useCalendarHost } from "../../context/calendar-provider";

/** Time slot with availability information. */
export interface TimeSlotOption {
  time: string;
  /** Total andenes configured for the terminal. */
  totalAndenes: number;
  /** Andenes currently available (not occupied). */
  availableAndenes: number;
  /** Whether this time slot is fully occupied. */
  isFullyOccupied: boolean;
  /** Whether this slot is disabled for selection (defaults to isFullyOccupied). */
  isDisabled?: boolean;
}

interface TimeSlotAssignmentProps {
  readonly timeOptions: TimeSlotOption[];
  readonly selectedTime: string;
  readonly onTimeChange: (time: string) => void;
}

/**
 * Generic, domain-agnostic departure-time + andén availability picker. The
 * options (time, availability, occupancy) are computed by the host; all labels
 * come from the CalendarHost i18n seam. Faithful to the freight
 * time-slot-assignment look.
 */
export function TimeSlotAssignment({
  timeOptions,
  selectedTime,
  onTimeChange,
}: TimeSlotAssignmentProps) {
  const host = useCalendarHost();
  const t = useCallback(
    (path: string) => host.i18n.tr(path, host.i18n.dict),
    [host]
  );

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedTimeSlot = timeOptions.find((opt) => opt.time === selectedTime);

  const handleTimeSelect = (time: string) => {
    onTimeChange(time);
    setIsDropdownOpen(false);
  };

  return (
    <div className="rounded-lg flex flex-col gap-4">
      {/* Custom Time Slot Dropdown */}
      <div ref={dropdownRef} className="relative">
        <Label
          htmlFor="time-select"
          className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block"
        >
          {t("pages.planning.sidebar.form.departureTime")}
        </Label>
        {/* Dropdown trigger button */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          {selectedTimeSlot ? (
            <div className="flex items-center gap-3">
              <span className="font-medium text-gray-900 dark:text-white">
                {selectedTimeSlot.time}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                  selectedTimeSlot.availableAndenes > 0
                    ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    : "bg-yellow-50 dark:bg-yellow-900/20  text-yellow-400 dark:text-yellow-400"
                }`}
              >
                {selectedTimeSlot.availableAndenes}/
                {selectedTimeSlot.totalAndenes}{" "}
                {t("pages.planning.sidebar.form.andenes")}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                ({timeOptions.filter((o) => !o.isFullyOccupied).length}/
                {timeOptions.length}{" "}
                {t("pages.planning.sidebar.form.available")})
              </span>
            </div>
          ) : (
            <span className="text-gray-500">
              {t("pages.planning.sidebar.form.selectTime")}
            </span>
          )}
          <HiChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
          />
        </button>
        {/* Dropdown menu - opens upward */}
        {isDropdownOpen && (
          <div className="absolute z-10 w-full bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{t("pages.planning.sidebar.form.timeColumn")}</span>
                <span>
                  {t("pages.planning.sidebar.form.availabilityColumn")}
                </span>
              </div>
            </div>
            {/* Time slot options */}
            {timeOptions.map((option) => (
              <button
                key={option.time}
                type="button"
                onClick={() => handleTimeSelect(option.time)}
                disabled={option.isDisabled ?? option.isFullyOccupied}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                  option.time === selectedTime
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                } ${
                  (option.isDisabled ?? option.isFullyOccupied)
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-2">
                  {option.time === selectedTime && (
                    <HiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                  <span
                    className={`font-medium ${
                      option.time === selectedTime
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {option.time}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Andenes indicators */}
                  <div className="flex gap-0.5">
                    {Array.from({ length: option.totalAndenes }, (_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-4 rounded-sm ${
                          i < option.availableAndenes
                            ? "bg-gray-400 dark:bg-gray-500"
                            : "bg-yellow-400"
                        }`}
                        title={
                          i < option.availableAndenes
                            ? t("pages.planning.sidebar.form.andenAvailable")
                            : t("pages.planning.sidebar.form.andenOccupied")
                        }
                      />
                    ))}
                  </div>
                  <span
                    className={`text-xs min-w-12 text-right ${
                      option.availableAndenes > 0
                        ? "text-gray-600 dark:text-gray-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {option.availableAndenes}/{option.totalAndenes}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
