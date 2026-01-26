"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Badge, Button, Label } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  FormSection,
  InfoRow,
  KpiRow,
  ProgressBar,
  LeadTimeDisplay,
} from "./form-components";
import {
  usePlanningSelection,
  type SelectedService,
  type SelectedSlot,
} from "./planning-selection-context";
import { HiExclamation, HiCheck, HiChevronDown } from "react-icons/hi";
import { categorizeIncidencias } from "./incidencias.types";
import { ShowNotification } from "@/features/notifications/notification";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";

/** Time slot with availability information */
interface TimeSlotOption {
  time: string;
  /** Total andenes configured for the terminal */
  totalAndenes: number;
  /** Andenes currently available (not occupied) */
  availableAndenes: number;
  /** Whether this time slot is fully occupied */
  isFullyOccupied: boolean;
}

interface PlanningSidebarFormProps {
  readonly dict: I18nRecord;
  readonly isActive: boolean;
  readonly selectedService?: SelectedService & { slot?: string };
  readonly onSubmit?: (values: Record<string, string | boolean>) => void;
  readonly andenesCount?: number;
  /** Slot start time in HH:mm format */
  readonly slotStartTime?: string;
  /** Slot end time in HH:mm format */
  readonly slotEndTime?: string;
  /** Quota for the time window */
  readonly windowQuota?: number;
  /** Number of base slots in the time window */
  readonly windowBaseSlots?: number;
}

/**
 * Generate time options with subdivisions based on quota and andenes
 *
 * Logic:
 * - Each slot (30 min) can be subdivided to accommodate more services
 * - Number of subdivisions = ceil(servicesPerSlot / andenesCount)
 * - Each subdivision can hold up to `andenesCount` services simultaneously
 *
 * @param startHour - Start hour of the slot
 * @param startMinutes - Start minutes of the slot
 * @param endHour - End hour of the slot
 * @param endMinutes - End minutes of the slot
 * @param subdivisions - Number of time subdivisions within the slot (default 1)
 * @param totalAndenes - Total number of andenes configured
 * @param occupiedSlots - Map of time -> occupied andenes count (for future use)
 */
function generateTimeSlotOptions(
  startHour: number,
  startMinutes: number,
  endHour: number,
  endMinutes: number,
  subdivisions: number = 1,
  totalAndenes: number = 1,
  occupiedSlots: Map<string, number> = new Map()
): TimeSlotOption[] {
  const options: TimeSlotOption[] = [];

  const startInMinutes = startHour * 60 + startMinutes;
  const endInMinutes = endHour * 60 + endMinutes;
  const totalMinutes = endInMinutes - startInMinutes;

  // Calculate interval between each time option
  const intervalMinutes = Math.max(1, Math.floor(totalMinutes / subdivisions));

  let currentMinutes = startInMinutes;

  while (currentMinutes < endInMinutes) {
    const hour = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    const time = `${hour.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

    const occupied = occupiedSlots.get(time) ?? 0;
    const availableAndenes = Math.max(0, totalAndenes - occupied);

    options.push({
      time,
      totalAndenes,
      availableAndenes,
      isFullyOccupied: availableAndenes === 0,
    });

    currentMinutes += intervalMinutes;
  }

  return options;
}

export function PlanningSidebarForm({
  dict,
  isActive,
  selectedService,
  onSubmit,
  andenesCount = 1,
  slotStartTime,
  slotEndTime,
  windowQuota = 1,
  windowBaseSlots = 1,
}: PlanningSidebarFormProps) {
  const [showAllIncidencias, setShowAllIncidencias] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedAnden, setSelectedAnden] = useState<number>(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    confirmService,
    selectedSlot,
    canAddToSlot,
    reassigningService,
    cancelReassignment,
    getOccupiedAndenes,
  } = usePlanningSelection();

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

  // Calculate subdivisions based on quota, base slots, and andenes
  // Formula: quota is distributed evenly across all base slots in the window
  // Each base slot gets (quota / windowBaseSlots) services
  // Each subdivision can handle `andenesCount` services simultaneously
  // So subdivisions per slot = ceil((quota / windowBaseSlots) / andenesCount)
  const subdivisions = useMemo(() => {
    if (andenesCount <= 0 || windowQuota <= 0 || windowBaseSlots <= 0) return 1;
    // Services that this slot needs to handle
    const servicesPerSlot = windowQuota / windowBaseSlots;
    // Each subdivision can handle `andenesCount` services simultaneously
    return Math.max(1, Math.ceil(servicesPerSlot / andenesCount));
  }, [andenesCount, windowQuota, windowBaseSlots]);

  // Generate time options based on the slot start and end times with subdivisions
  // Include actual occupied andenes for each time slot
  const timeOptions = useMemo(() => {
    if (!slotStartTime || !slotEndTime || !selectedSlot) return [];

    const [startHour, startMinutes] = slotStartTime.split(":").map(Number);
    const [endHour, endMinutes] = slotEndTime.split(":").map(Number);

    // Build occupied slots map from actual data
    const occupiedSlots = new Map<string, number>();

    // Calculate time intervals
    const startInMinutes = startHour * 60 + startMinutes;
    const endInMinutes = endHour * 60 + endMinutes;
    const totalMinutes = endInMinutes - startInMinutes;
    const intervalMinutes = Math.max(
      1,
      Math.floor(totalMinutes / subdivisions)
    );

    // For each potential time slot, check occupied andenes
    let currentMinutes = startInMinutes;
    while (currentMinutes < endInMinutes) {
      const hour = Math.floor(currentMinutes / 60);
      const mins = currentMinutes % 60;
      const time = `${hour.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

      const occupied = getOccupiedAndenes(selectedSlot.date, hour, mins);
      occupiedSlots.set(time, occupied.length);

      currentMinutes += intervalMinutes;
    }

    return generateTimeSlotOptions(
      startHour,
      startMinutes,
      endHour,
      endMinutes,
      subdivisions,
      andenesCount,
      occupiedSlots
    );
  }, [
    slotStartTime,
    slotEndTime,
    subdivisions,
    andenesCount,
    selectedSlot,
    getOccupiedAndenes,
  ]);

  // Get occupied andenes for the currently selected time
  const occupiedAndenesForSelectedTime = useMemo(() => {
    if (!selectedSlot || !selectedTime) return [];
    const [hour, mins] = selectedTime.split(":").map(Number);
    return getOccupiedAndenes(selectedSlot.date, hour, mins);
  }, [selectedSlot, selectedTime, getOccupiedAndenes]);

  // Get the selected time slot option
  const selectedTimeSlot = useMemo(() => {
    return timeOptions.find((opt) => opt.time === selectedTime);
  }, [timeOptions, selectedTime]);

  // Set default selected time when time options change or when no valid selection
  useEffect(() => {
    if (timeOptions.length === 0) return;

    // Check if current selection is valid
    const currentIsValid = timeOptions.some((opt) => opt.time === selectedTime);

    if (!selectedTime || !currentIsValid) {
      // Select first available (non-fully-occupied) time slot
      const firstAvailable = timeOptions.find((opt) => !opt.isFullyOccupied);
      if (firstAvailable) {
        setSelectedTime(firstAvailable.time);
      } else {
        // All slots are full, select the last one to show something
        setSelectedTime(timeOptions[timeOptions.length - 1].time);
      }
    }
  }, [timeOptions, selectedTime]);

  // Update selected andén when time changes (pick first available)
  useMemo(() => {
    if (selectedTime && andenesCount > 0) {
      // Find first available andén for this time
      for (let i = 1; i <= andenesCount; i++) {
        if (!occupiedAndenesForSelectedTime.includes(i)) {
          setSelectedAnden(i);
          return;
        }
      }
      // All occupied, default to 1
      setSelectedAnden(1);
    }
  }, [selectedTime, andenesCount, occupiedAndenesForSelectedTime]);

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setIsDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build the final slot with the chosen time and andén
    let finalSlot: SelectedSlot | undefined;
    if (selectedSlot && selectedTime) {
      const [hour, mins] = selectedTime.split(":").map(Number);
      finalSlot = {
        ...selectedSlot,
        hour,
        minutes: mins,
        anden: selectedAnden,
      };
    }

    const wasReassigning = reassigningService !== null;
    // Pass the final slot directly to confirmService
    const result = await confirmService(finalSlot);
    if (wasReassigning || result) {
      ShowNotification({
        type: "success",
        message: "Servicio reasignado exitosamente",
      });
    } else {
      ShowNotification({
        type: "success",
        message: "Servicio asignado exitosamente",
      });
    }
    onSubmit?.({});
  };

  // Check if the selected time has available andenes
  const hasAvailableAnden = useMemo(() => {
    if (!selectedTime || !selectedSlot) return false;
    return occupiedAndenesForSelectedTime.length < andenesCount;
  }, [
    selectedTime,
    selectedSlot,
    occupiedAndenesForSelectedTime,
    andenesCount,
  ]);

  // Need both a selected service, a slot with room, and an available andén to confirm
  const canConfirm =
    selectedSlot !== null && canAddToSlot(selectedSlot) && hasAvailableAnden;

  if (!isActive || !selectedService) {
    return null;
  }

  // Categorize incidencias into primary (always visible) and secondary (expandable)
  const { primary, secondary } = categorizeIncidencias(
    selectedService.incidencias
  );
  const hasIncidencias = primary.length > 0 || secondary.length > 0;
  // Show secondary directly if no primary and 2 or fewer secondary
  const showSecondaryDirectly = primary.length === 0 && secondary.length <= 2;

  // Use real data from selectedService
  const id = selectedService.id;
  const client = selectedService.cliente;
  const origin = selectedService.origen;
  const loadingPlace = selectedService.lugarCarguio;
  const destination = selectedService.destino;
  const tripType = selectedService.tipoViaje;
  const permanence = selectedService.permanencia;
  const notes = selectedService.observaciones;
  const eta = formatDateString(selectedService.eta, "datetime");
  const occupancy = selectedService.ocupacion;

  // Helper to get badge color class for incidencias
  const getIncidenciaBadgeProps = (key: string, color: string) => {
    if (key === "urgencia") {
      return {
        color: "purple" as const,
        className:
          "flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5",
        icon: HiExclamation,
      };
    }
    return {
      color: "gray" as const,
      className:
        "flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5",
    };
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Flags Section */}
      {hasIncidencias && (
        <FormSection title={tr("pages.planning.sidebar.form.flags", dict)}>
          <div className="flex flex-wrap gap-2">
            {/* Primary incidencias - always visible */}
            {primary.map(({ key, config }) => (
              <Badge
                key={key}
                size="xs"
                {...getIncidenciaBadgeProps(key, config.color)}
              >
                {config.label}
              </Badge>
            ))}

            {/* Secondary incidencias - shown directly if ≤2 and no primary, otherwise when expanded */}
            {(showSecondaryDirectly || showAllIncidencias) &&
              secondary.map(({ key, config }) => (
                <Badge
                  key={key}
                  size="xs"
                  color="gray"
                  className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5"
                >
                  {config.label}
                </Badge>
              ))}

            {/* "+N more" button to expand secondary incidencias - only if not showing directly */}
            {!showSecondaryDirectly &&
              secondary.length > 0 &&
              !showAllIncidencias && (
                <button
                  type="button"
                  onClick={() => setShowAllIncidencias(true)}
                  className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  +{secondary.length} más
                </button>
              )}

            {/* "Show less" button when expanded - only if not showing directly */}
            {!showSecondaryDirectly &&
              secondary.length > 0 &&
              showAllIncidencias && (
                <button
                  type="button"
                  onClick={() => setShowAllIncidencias(false)}
                  className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  ver menos
                </button>
              )}
          </div>
        </FormSection>
      )}

      {/* KPIs Section */}
      <FormSection title={tr("pages.planning.sidebar.form.kpis", dict)}>
        <LeadTimeDisplay leadTime={selectedService.leadTime} />
        <KpiRow label="ETA" value={eta} />
        <ProgressBar
          label={tr("pages.planning.sidebar.form.occupancy", dict)}
          value={occupancy}
        />
      </FormSection>

      {/* Information Section */}
      <FormSection title={tr("pages.planning.sidebar.form.information", dict)}>
        <InfoRow label={tr("ID", dict)} value={id} />
        <InfoRow
          label={tr("pages.planning.sidebar.form.client", dict)}
          value={client}
        />
        <InfoRow
          label={tr("pages.planning.sidebar.form.route", dict)}
          value={`${origin} → ${destination}`}
        />
        <InfoRow
          label={tr("pages.planning.sidebar.form.loadingPlace", dict)}
          value={loadingPlace}
        />
        <InfoRow
          label={tr("pages.planning.sidebar.form.tripType", dict)}
          value={tripType}
        />
        <InfoRow
          label={tr("pages.planning.sidebar.form.permanence", dict)}
          value={permanence}
        />
      </FormSection>

      {/* Notes Section */}
      <FormSection title={tr("pages.planning.sidebar.form.notes", dict)}>
        <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
          {notes}
        </p>
      </FormSection>

      {/* Time & Andenes Selection */}
      {timeOptions.length > 0 && (
        <FormSection title="Asignación de horario">
          <div className="space-y-3">
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
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        selectedTimeSlot.availableAndenes > 0
                          ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          : "bg-yellow-50 dark:bg-yellow-900/20  text-yellow-400 dark:text-yellow-400"
                      }`}
                    >
                      {selectedTimeSlot.availableAndenes}/
                      {selectedTimeSlot.totalAndenes} andenes
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
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
                          {Array.from(
                            { length: option.totalAndenes },
                            (_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-4 rounded-sm ${
                                  i < option.availableAndenes
                                    ? "bg-gray-400 dark:bg-gray-500"
                                    : "bg-yellow-400"
                                }`}
                                title={
                                  i < option.availableAndenes
                                    ? "Disponible"
                                    : "Ocupado"
                                }
                              />
                            )
                          )}
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
        </FormSection>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="submit"
          color="blue"
          className="flex-1"
          disabled={!canConfirm}
        >
          {reassigningService
            ? tr("pages.planning.sidebar.form.confirmReassignment", dict)
            : tr("pages.planning.sidebar.form.confirm", dict)}
        </Button>
      </div>
    </form>
  );
}
