"use client";

import { useState, useRef, useEffect } from "react";
import { Label } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { HiCheck, HiChevronDown } from "react-icons/hi";

/** Time slot with availability information */
export interface TimeSlotOption {
  time: string;
  /** Total andenes configured for the terminal */
  totalAndenes: number;
  /** Andenes currently available (not occupied) */
  availableAndenes: number;
  /** Whether this time slot is fully occupied */
  isFullyOccupied: boolean;
}

interface ServiceCategoryOption {
  value: string;
  label: string;
}

interface TimeSlotAssignmentProps {
  readonly dict: I18nRecord;
  readonly timeOptions: TimeSlotOption[];
  readonly selectedTime: string;
  readonly onTimeChange: (time: string) => void;
  readonly serviceCategoryOptions: ServiceCategoryOption[];
  readonly selectedServiceCategory: string;
  readonly onServiceCategoryChange: (category: string) => void;
  readonly isLoadingServiceTypes: boolean;
}

export function TimeSlotAssignment({
  dict,
  timeOptions,
  selectedTime,
  onTimeChange,
  serviceCategoryOptions,
  selectedServiceCategory,
  onServiceCategoryChange,
  isLoadingServiceTypes,
}: TimeSlotAssignmentProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTripTypeDropdownOpen, setIsTripTypeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tripTypeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        tripTypeDropdownRef.current &&
        !tripTypeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTripTypeDropdownOpen(false);
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
    <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg flex flex-col gap-4">
      {/* Service Category Dropdown */}
      <div ref={tripTypeDropdownRef} className="relative">
        <Label
          htmlFor="service-category-select"
          className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block"
        >
          {tr("pages.planning.sidebar.form.serviceCategory", dict)}
        </Label>
        {/* Dropdown trigger button */}
        <button
          type="button"
          disabled={isLoadingServiceTypes}
          onClick={() => setIsTripTypeDropdownOpen(!isTripTypeDropdownOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="font-medium text-gray-900 dark:text-white">
            {isLoadingServiceTypes
              ? tr("pages.planning.sidebar.form.serviceCategoryLoading", dict)
              : (serviceCategoryOptions.find(
                  (opt) => opt.value === selectedServiceCategory
                )?.label ??
                tr(
                  "pages.planning.sidebar.form.serviceCategoryPlaceholder",
                  dict
                ))}
          </span>
          <HiChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform ${isTripTypeDropdownOpen ? "rotate-180" : ""}`}
          />
        </button>
        {/* Dropdown menu */}
        {isTripTypeDropdownOpen && (
          <div className="absolute z-10 w-full bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {serviceCategoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onServiceCategoryChange(option.value);
                  setIsTripTypeDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                  option.value === selectedServiceCategory
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                } cursor-pointer`}
              >
                <div className="flex items-center gap-2">
                  {option.value === selectedServiceCategory && (
                    <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  )}
                  <span
                    className={`text-sm ${
                      option.value === selectedServiceCategory
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {option.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom Time Slot Dropdown */}
      <div ref={dropdownRef} className="relative">
        <Label
          htmlFor="time-select"
          className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block"
        >
          Hora de salida
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
                {selectedTimeSlot.totalAndenes} andenes
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                ({timeOptions.filter((o) => !o.isFullyOccupied).length}/
                {timeOptions.length} disponibles)
              </span>
            </div>
          ) : (
            <span className="text-gray-500">Seleccionar horario</span>
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
                <span>Horario</span>
                <span>Disponibilidad</span>
              </div>
            </div>
            {/* Time slot options */}
            {timeOptions.map((option) => (
              <button
                key={option.time}
                type="button"
                onClick={() => handleTimeSelect(option.time)}
                disabled={option.isFullyOccupied}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                  option.time === selectedTime
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                } ${
                  option.isFullyOccupied
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
                          i < option.availableAndenes ? "Disponible" : "Ocupado"
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
