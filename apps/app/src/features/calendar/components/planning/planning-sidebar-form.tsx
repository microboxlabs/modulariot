"use client";

import { useState, useMemo, useEffect } from "react";
import { Badge, Button } from "flowbite-react";
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
import { useServiceTypes } from "@/features/common/providers/client-api.provider";
import { HiCalendar, HiExclamation, HiUserAdd } from "react-icons/hi";
import { categorizeIncidencias } from "./incidencias.types";
import { ShowNotification } from "@/features/notifications/notification";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { SlotResponse } from "@microboxlabs/miot-calendar-client";
import {
  TimeSlotAssignment,
  type TimeSlotOption,
  AssignmentForm,
  type AssignmentFormData,
} from "./sidebar-tabs";
import { usePermissions } from "@/features/auth/hooks/use-permissions";
import {
  TabButtons,
  type TabItem,
} from "@/features/common/components/tab-buttons";

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
  /** Backend slot data for the selected date */
  readonly backendSlots?: SlotResponse[];
  /** Whether backend slots are currently loading */
  readonly isSlotsLoading?: boolean;
}

export function PlanningSidebarForm({
  dict,
  isActive,
  selectedService,
  onSubmit,
  andenesCount = 1,
  slotStartTime,
  slotEndTime,
  backendSlots,
  isSlotsLoading = false,
}: PlanningSidebarFormProps) {
  const [showAllIncidencias, setShowAllIncidencias] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedAnden, setSelectedAnden] = useState<number>(1);
  const [selectedServiceCategory, setSelectedServiceCategory] =
    useState<string>(selectedService?.serviceCategory ?? "");
  const [assignmentData, setAssignmentData] = useState<AssignmentFormData>({
    transportista: "",
    conductor: "",
    segundoConductor: "",
    hasSegundoConductor: false,
    camion: "",
    remolque: "",
    hasRemolque: false,
  });

  const { serviceTypes, isLoading: isLoadingServiceTypes } = useServiceTypes();
  const serviceCategoryOptions = serviceTypes.map((t) => ({
    value: t.code,
    label: t.name,
  }));

  const {
    confirmService,
    selectedSlot,
    canAddToSlot,
    reassigningService,
    assigningService,
    cancelAssignment,
    getOccupiedAndenes,
    updateServiceDrivers,
  } = usePlanningSelection();

  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  // Avoid hiding the tab while permissions are loading (transient false negative)
  const canAssign = isLoadingPermissions || hasPermission(["GROUP_ASSIGNMENT"]);
  const canPlan = isLoadingPermissions || hasPermission(["GROUP_PLANNING"]);

  // Tab state management
  type TabType = "planificacion" | "asignacion";
  const [activeTab, setActiveTab] = useState<TabType>("planificacion");

  // Auto-switch to asignacion tab when assignment mode is triggered from context menu
  useEffect(() => {
    if (assigningService && canAssign) {
      setActiveTab("asignacion");
    }
  }, [assigningService, canAssign]);

  // Build time options from backend slots, filtered to the visible cell range [slotStartTime, slotEndTime)
  const timeOptions = useMemo(() => {
    if (!slotStartTime || !slotEndTime || !selectedSlot || !backendSlots)
      return [];

    const [startHour, startMinutes] = slotStartTime.split(":").map(Number);
    const [endHour, endMinutes] = slotEndTime.split(":").map(Number);
    const startInMinutes = startHour * 60 + startMinutes;
    const endInMinutes = endHour * 60 + endMinutes;

    return backendSlots
      .filter((slot) => {
        const slotMinutes = slot.slotHour * 60 + slot.slotMinutes;
        return slotMinutes >= startInMinutes && slotMinutes < endInMinutes;
      })
      .map((slot): TimeSlotOption => {
        const time = `${slot.slotHour.toString().padStart(2, "0")}:${slot.slotMinutes.toString().padStart(2, "0")}`;
        const localOccupied = getOccupiedAndenes(
          selectedSlot.date,
          slot.slotHour,
          slot.slotMinutes
        );
        const availableAndenes = Math.max(
          0,
          Math.min(andenesCount - localOccupied.length, slot.availableCapacity)
        );
        return {
          time,
          totalAndenes: andenesCount,
          availableAndenes,
          isFullyOccupied:
            slot.availableCapacity <= 0 || localOccupied.length >= andenesCount,
        };
      });
  }, [
    slotStartTime,
    slotEndTime,
    backendSlots,
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
    // Pass the final slot directly to confirmService, along with service category and driver overrides
    const serviceOverrides: Partial<SelectedService> = {};
    if (selectedServiceCategory) {
      serviceOverrides.serviceCategory = selectedServiceCategory;
    }
    if (assignmentData.conductor) {
      serviceOverrides.assignedDriver = assignmentData.conductor;
    }
    if (assignmentData.hasSegundoConductor && assignmentData.segundoConductor) {
      serviceOverrides.assignedDriver2 = assignmentData.segundoConductor;
    }
    const finalOverrides: Partial<SelectedService> | undefined =
      Object.keys(serviceOverrides).length > 0 ? serviceOverrides : undefined;
    try {
      const result = await confirmService(finalSlot, finalOverrides);
      if (wasReassigning || result) {
        ShowNotification({
          type: "success",
          message: tr("pages.planning.sidebar.notifications.reassigned", dict),
        });
      } else {
        ShowNotification({
          type: "success",
          message: tr("pages.planning.sidebar.notifications.assigned", dict),
        });
      }
      onSubmit?.({});
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : tr("pages.planning.sidebar.notifications.assignError", dict);
      ShowNotification({ type: "error", message });
    }
  };

  /**
   * Handle assignment-only action (Asignar button in Asignación tab)
   * This persists assignmentData without affecting planning state
   */
  const handleAssign = () => {
    if (!assigningService) {
      return;
    }

    const serviceId = assigningService.service.service.id;
    const driver1 = assignmentData.conductor || undefined;
    const driver2 =
      assignmentData.hasSegundoConductor && assignmentData.segundoConductor
        ? assignmentData.segundoConductor
        : undefined;

    // Client-side only update - no backend calls
    updateServiceDrivers(serviceId, driver1, driver2);

    ShowNotification({
      type: "success",
      message: tr(
        "pages.planning.sidebar.notifications.assignmentCompleted",
        dict
      ),
    });

    // Clear assignment mode
    cancelAssignment();
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

  // Extract incident codes and create code-to-label map for tooltips
  const codeToLabelMap = new Map<string, string>();
  const incidentCodes = (selectedService.mintral_incidents ?? []).map(
    (incident) => {
      const rawCode = incident[0];
      const label = incident[1];
      // Remove "mintral_incident_" prefix to get just the code (e.g., "C307")
      const code = rawCode.replace(/^mintral_incident_/i, "");
      codeToLabelMap.set(code, label);
      return code;
    }
  );

  // Categorize incidencias into primary (always visible) and secondary (expandable)
  const { primary, secondary } = categorizeIncidencias(incidentCodes);
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
  const getIncidenciaBadgeProps = (
    key: string,
    configColor?: string,
    label?: string
  ) => {
    // Check if it's urgencia/C309 (purple with icon)
    if (
      key === "urgencia" ||
      key === "C309" ||
      label === "C309" ||
      configColor === "purple"
    ) {
      return {
        color: "purple" as const,
        className:
          "flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5",
        icon: HiExclamation,
      };
    }
    // Use the config color if available, otherwise gray
    return {
      color:
        (configColor as
          | "red"
          | "yellow"
          | "green"
          | "blue"
          | "gray"
          | "pink") || "gray",
      className:
        "flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5",
    };
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Flags Section */}
      {hasIncidencias && (
        <FormSection title={tr("pages.planning.sidebar.form.flags", dict)}>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {/* Primary incidencias - always visible */}
            {primary.map(({ key, config }) => {
              const tooltip =
                codeToLabelMap.get(key) || codeToLabelMap.get(config.label);
              return (
                <Badge
                  key={key}
                  size="xs"
                  title={tooltip}
                  {...getIncidenciaBadgeProps(key, config.color, config.label)}
                >
                  {config.label}
                </Badge>
              );
            })}

            {/* Secondary incidencias - shown directly if ≤2 and no primary, otherwise when expanded */}
            {(showSecondaryDirectly || showAllIncidencias) &&
              secondary.map(({ key, config }) => {
                const tooltip =
                  codeToLabelMap.get(key) || codeToLabelMap.get(config.label);
                return (
                  <Badge
                    key={key}
                    size="xs"
                    color="gray"
                    className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5"
                    title={tooltip}
                  >
                    {config.label}
                  </Badge>
                );
              })}

            {/* "+N more" button to expand secondary incidencias - only if not showing directly */}
            {!showSecondaryDirectly &&
              secondary.length > 0 &&
              !showAllIncidencias && (
                <button
                  type="button"
                  onClick={() => setShowAllIncidencias(true)}
                  className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  {tr("pages.planning.sidebar.form.showMore", dict, {
                    count: String(secondary.length),
                  })}
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
                  {tr("pages.planning.sidebar.form.showLess", dict)}
                </button>
              )}
          </div>
        </FormSection>
      )}
      {/* KPIs Section */}
      <FormSection title={tr("pages.planning.sidebar.form.kpis", dict)}>
        <LeadTimeDisplay leadTime={selectedService.leadTime} dict={dict} />
        <KpiRow label="ETA" value={eta} />
        <ProgressBar
          label={tr("pages.planning.sidebar.form.occupancy", dict)}
          value={occupancy}
        />
      </FormSection>
      {/* Load Utilization Section */}
      {selectedService.loadConstraint && (
        <FormSection
          title={tr("pages.planning.sidebar.form.loadUtilization", dict)}
        >
          <InfoRow
            label={tr("pages.planning.sidebar.form.constraint", dict)}
            value={selectedService.loadConstraint}
          />
          <InfoRow
            label={tr("pages.planning.sidebar.form.maxUtilization", dict)}
            value={
              selectedService.loadMaxUtilization == null
                ? "—"
                : `${selectedService.loadMaxUtilization.toFixed(1)}`
            }
          />
          {selectedService.loadConstraint === "Carga" && (
            <InfoRow
              label={tr("pages.planning.sidebar.form.weightUtilization", dict)}
              value={
                selectedService.loadWeightUtilization == null
                  ? "—"
                  : `${selectedService.loadWeightUtilization.toFixed(1)}%`
              }
            />
          )}
          {selectedService.loadConstraint === "Pallets" && (
            <InfoRow
              label={tr("pages.planning.sidebar.form.palletUtilization", dict)}
              value={
                selectedService.loadPalletUtilization == null
                  ? "—"
                  : `${selectedService.loadPalletUtilization.toFixed(1)}%`
              }
            />
          )}
          {selectedService.loadConstraint === "Volumen" && (
            <InfoRow
              label={tr("pages.planning.sidebar.form.volumeUtilization", dict)}
              value={
                selectedService.loadVolumeUtilization == null
                  ? "—"
                  : `${selectedService.loadVolumeUtilization.toFixed(1)}%`
              }
            />
          )}
        </FormSection>
      )}
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
      {isSlotsLoading && (
        <FormSection
          title={tr("pages.planning.sidebar.form.timeAssignment", dict)}
        >
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            {tr("pages.planning.sidebar.form.loadingSlots", dict)}
          </p>
        </FormSection>
      )}
      {!isSlotsLoading &&
        backendSlots &&
        backendSlots.length > 0 &&
        timeOptions.length === 0 && (
          <FormSection
            title={tr("pages.planning.sidebar.form.timeAssignment", dict)}
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              {tr("pages.planning.sidebar.form.noSlotsAvailable", dict)}
            </p>
          </FormSection>
        )}
      {/* Custom Tabs */}
      <div className="flex flex-col gap-3">
        <TabButtons
          pill
          tabs={
            [
              {
                id: "planificacion",
                label: tr("pages.planning.sidebar.form.planningTab", dict),
                icon: <HiCalendar />,
                disabled: !canPlan,
              },
              {
                id: "asignacion",
                label: tr("pages.planning.sidebar.form.assignmentTab", dict),
                icon: <HiUserAdd />,
                disabled: !canAssign,
              },
            ] as TabItem<TabType>[]
          }
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab Content */}
        {activeTab === "planificacion" && (
          <>
            {!isSlotsLoading && timeOptions.length > 0 && (
              <TimeSlotAssignment
                dict={dict}
                timeOptions={timeOptions}
                selectedTime={selectedTime}
                onTimeChange={setSelectedTime}
                serviceCategoryOptions={serviceCategoryOptions}
                selectedServiceCategory={selectedServiceCategory}
                onServiceCategoryChange={setSelectedServiceCategory}
                isLoadingServiceTypes={isLoadingServiceTypes}
              />
            )}
            <div className="flex gap-2 pt-2">
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
          </>
        )}
        {activeTab === "asignacion" && canAssign && (
          <>
            <AssignmentForm
              value={assignmentData}
              onChange={setAssignmentData}
              dict={dict}
            />
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                color="blue"
                className="flex-1"
                onClick={handleAssign}
                disabled={!assigningService}
              >
                {tr("pages.planning.sidebar.form.assign", dict)}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
    </form>
  );
}
