"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import dayjs from "dayjs";
import { Badge, Button, Spinner } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  FormSection,
  InfoRow,
  KpiRow,
  LeadTimeDisplay,
} from "./form-components";
import { ProgressBar } from "@/features/common/components/progress-bar";
import {
  usePlanningSelection,
  type SelectedService,
  type SelectedSlot,
  type TaskStage,
} from "./planning-selection-context";
import { useServiceTypes } from "@/features/common/providers/client-api.provider";
import { HiCalendar, HiExclamation, HiUserAdd } from "react-icons/hi";
import { categorizeIncidencias } from "./incidencias.types";
import { formatPercent } from "@microboxlabs/miot-calendar-ui";
import { ShowNotification } from "@/features/notifications/notification";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { SlotResponse } from "@microboxlabs/miot-calendar-client";
import { SidebarFormShell } from "@microboxlabs/miot-calendar-ui";
import {
  type TimeSlotOption,
  AssignmentForm,
  type AssignmentFormData,
} from "./sidebar-tabs";
import { useCalendarViewMode } from "./use-calendar-view-mode";
import {
  TabButtons,
  type TabItem,
} from "@/features/common/components/tab-buttons";

/**
 * Build the service-override patch that travels with `confirmService` so the
 * booking payload reflects the user's current selections. Each slot is only
 * written when the user actually filled it in (or kept its conditional
 * section open) — partial assignments shouldn't wipe previously-saved fields
 * with empty strings.
 */
function assignmentOverrides(
  data: AssignmentFormData
): Partial<SelectedService> {
  const out: Partial<SelectedService> = {};
  if (data.carrier) {
    out.assignedCarrier = data.carrier;
    // Carry the upstream prve_codigo alongside the UUID so the binding
    // extractor can ship `carrier_external_id` for Alerce `proveedor`.
    // `null` is a real value (carrier with no upstream code on file) and
    // must be preserved — don't gate this on truthiness.
    out.assignedCarrierExternalId = data.carrierExternalId;
  }
  if (data.driver) out.assignedDriver = data.driver;
  if (data.hasSecondDriver && data.secondDriver) {
    out.assignedDriver2 = data.secondDriver;
  }
  if (data.truck) out.assignedTruck = data.truck;
  if (data.hasTrailer && data.trailer) {
    out.assignedTrailer = data.trailer;
  }
  return out;
}

/**
 * Build the initial `AssignmentFormData` from a service, hydrating the
 * carrier / driver / truck / trailer slots from the values persisted on the
 * previous `confirmService` call. Missing fields collapse to empty strings;
 * `hasSecondDriver` / `hasTrailer` toggle on when the matching slot is
 * set so the conditional UI opens automatically on reassign.
 */
function assignmentDataFromService(
  service: SelectedService | undefined
): AssignmentFormData {
  return {
    carrier: service?.assignedCarrier ?? "",
    // Survive reopen: the persisted prve_codigo flows back even when the
    // carrier row falls off the current accredited-resources page or the
    // carrier has been deactivated upstream since the prior confirm.
    carrierExternalId: service?.assignedCarrierExternalId ?? null,
    driver: service?.assignedDriver ?? "",
    secondDriver: service?.assignedDriver2 ?? "",
    hasSecondDriver: Boolean(service?.assignedDriver2),
    truck: service?.assignedTruck ?? "",
    trailer: service?.assignedTrailer ?? "",
    hasTrailer: Boolean(service?.assignedTrailer),
  };
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
  /** Backend slot data for the selected date */
  readonly backendSlots?: SlotResponse[];
  /** Whether backend slots are currently loading */
  readonly isSlotsLoading?: boolean;
  /**
   * Live kanban stage of the selected task, derived by the parent from the
   * freshly fetched myTasks payload. Never persisted on the booking — pass
   * `undefined` when the task isn't in any active column.
   */
  readonly liveTaskStage?: TaskStage;
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
  liveTaskStage,
}: PlanningSidebarFormProps) {
  const [showAllIncidencias, setShowAllIncidencias] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedAnden, setSelectedAnden] = useState<number>(1);
  const [selectedServiceCategory, setSelectedServiceCategory] =
    useState<string>(selectedService?.serviceCategory ?? "");
  const [assignmentData, setAssignmentData] = useState<AssignmentFormData>(() =>
    assignmentDataFromService(selectedService)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-hydrate the assignment form when the user reopens the sidebar for a
  // different planned service — otherwise a stale (carrier, driver) pair from
  // the previous selection would leak into the new one. Keyed off service id
  // so typing/selecting within the same service doesn't thrash.
  useEffect(() => {
    setAssignmentData(assignmentDataFromService(selectedService));
    setSelectedServiceCategory(selectedService?.serviceCategory ?? "");
  }, [selectedService?.id, selectedService?.serviceCategory]);

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
  } = usePlanningSelection();

  // Effective view-mode — already accounts for `?as=viewer` for users
  // with GROUP_CALENDAR_VIEWER. Fail-closed during permission load.
  const { canPlan, canAssign, isViewerOnly, isLoadingPermissions } =
    useCalendarViewMode();

  // View-only mode: the sidebar was opened either by (a) left-clicking a
  // past-day chip without entering reassign/assign, or (b) a pure
  // GROUP_CALENDAR_VIEWER right-clicking a chip to inspect it. Form controls
  // stay visible so the existing values can be inspected, but every mutation
  // path — inputs and action buttons — is suppressed. For past-day slots the
  // right-click context menu still exposes Replanificar / Asignar / Eliminar
  // so planners can reconcile after the fact; picking either reassign or
  // assign sets `reassigningService` / `assigningService`, which drops the
  // flag below and returns the form to edit mode. Viewers never reach those
  // entries because the menu hides them when canPlan/canAssign are false.
  const isReadOnlyView = useMemo(() => {
    if (!selectedSlot || reassigningService || assigningService) return false;
    if (isViewerOnly) return true;
    return dayjs(selectedSlot.date).isBefore(dayjs().startOf("day"), "day");
  }, [selectedSlot, reassigningService, assigningService, isViewerOnly]);

  // Tab state management
  type TabType = "planificacion" | "assignment";
  const [activeTab, setActiveTab] = useState<TabType>("planificacion");

  // Set initial tab based on permissions once loaded (fail-closed)
  useEffect(() => {
    if (isLoadingPermissions) return;

    // Auto-switch to assignment tab when assignment mode is triggered
    if (assigningService && canAssign) {
      setActiveTab("assignment");
      return;
    }

    // Default to first available tab based on permissions
    if (!canPlan && canAssign) {
      setActiveTab("assignment");
    }
  }, [isLoadingPermissions, assigningService, canAssign, canPlan]);

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
        const isFullyOccupied =
          slot.availableCapacity <= 0 || localOccupied.length >= andenesCount;
        // When reassigning, the original slot is full in the backend but
        // should still be selectable (the old booking will be replaced).
        const isReassigningSlot =
          reassigningService &&
          dayjs(reassigningService.originalSlot.date).isSame(
            selectedSlot.date,
            "day"
          ) &&
          reassigningService.originalSlot.hour === slot.slotHour &&
          reassigningService.originalSlot.minutes === slot.slotMinutes;
        return {
          time,
          totalAndenes: andenesCount,
          availableAndenes,
          isFullyOccupied,
          isDisabled: isReassigningSlot ? false : isFullyOccupied,
        };
      });
  }, [
    slotStartTime,
    slotEndTime,
    backendSlots,
    andenesCount,
    selectedSlot,
    getOccupiedAndenes,
    reassigningService,
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
      // When reassigning, prefer the original booking time
      if (reassigningService) {
        const origTime = `${reassigningService.originalSlot.hour.toString().padStart(2, "0")}:${reassigningService.originalSlot.minutes.toString().padStart(2, "0")}`;
        const origOption = timeOptions.find((opt) => opt.time === origTime);
        if (origOption) {
          setSelectedTime(origTime);
          return;
        }
      }
      // Select first available (non-fully-occupied) time slot
      const firstAvailable = timeOptions.find((opt) => !opt.isFullyOccupied);
      if (firstAvailable) {
        setSelectedTime(firstAvailable.time);
      } else {
        // All slots are full, select the last one to show something
        setSelectedTime(timeOptions[timeOptions.length - 1].time);
      }
    }
  }, [timeOptions, selectedTime, reassigningService]);

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
    if (isSubmitting) return;
    // Defense against Enter-key submission while the form is in read-only
    // mode. The visible submit button is already hidden by isReadOnlyView,
    // but the <form> element can still receive a submit event from inputs.
    if (isReadOnlyView) return;

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
    const serviceOverrides: Partial<SelectedService> = {
      ...assignmentOverrides(assignmentData),
    };
    if (selectedServiceCategory) {
      serviceOverrides.serviceCategory = selectedServiceCategory;
    }
    const finalOverrides: Partial<SelectedService> | undefined =
      Object.keys(serviceOverrides).length > 0 ? serviceOverrides : undefined;
    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle the "Asignar" action in the Asignación tab. The sidebar opens on
   * an already-planned service (slot unchanged), and we want the new
   * carrier / driver / truck / trailer tuple to round-trip through the
   * booking backend — otherwise a refresh would wipe the assignment.
   *
   * We therefore go through `confirmService` (just like the planning tab's
   * reassignment flow) with `finalSlot = undefined` so the existing slot is
   * preserved. `confirmService` updates plannedServices locally, writes a
   * new booking, and cancels the previous one atomically.
   */
  const handleAssign = async () => {
    if (!assigningService || isSubmitting) {
      return;
    }
    if (isReadOnlyView) return;

    const overrides = assignmentOverrides(assignmentData);
    setIsSubmitting(true);
    try {
      await confirmService(
        undefined,
        Object.keys(overrides).length > 0 ? overrides : undefined
      );
      ShowNotification({
        type: "success",
        message: tr(
          "pages.planning.sidebar.notifications.assignmentCompleted",
          dict
        ),
      });
      cancelAssignment();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : tr("pages.planning.sidebar.notifications.assignError", dict);
      ShowNotification({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
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

  // Need a selected service, a slot with room, an available andén, and a service category to confirm
  const canConfirm =
    selectedSlot !== null &&
    canAddToSlot(selectedSlot) &&
    hasAvailableAnden &&
    selectedServiceCategory !== "";

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
  // Always reserve up to INLINE_BUDGET inline slots: primary first, then top up with secondary.
  const INLINE_BUDGET = 2;
  const inlineSecondaryCount = Math.max(
    0,
    Math.min(secondary.length, INLINE_BUDGET - primary.length)
  );
  const inlineSecondary = secondary.slice(0, inlineSecondaryCount);
  const collapsedSecondary = secondary.slice(inlineSecondaryCount);
  const hasCollapsed = collapsedSecondary.length > 0;

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
      {isReadOnlyView && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          {tr(
            isViewerOnly
              ? "pages.planning.sidebar.form.viewerBanner"
              : "pages.planning.sidebar.form.readOnlyBanner",
            dict
          )}
        </div>
      )}
      <fieldset
        disabled={isReadOnlyView}
        className="flex flex-col gap-4 min-w-0 border-0 p-0 m-0"
      >
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

            {/* Inline secondary incidencias - always visible */}
            {inlineSecondary.map(({ key, config }) => {
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

            {/* Collapsed secondary incidencias - revealed when expanded */}
            {hasCollapsed &&
              showAllIncidencias &&
              collapsedSecondary.map(({ key, config }) => {
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

            {/* "+N more" button to expand collapsed secondary incidencias */}
            {hasCollapsed && !showAllIncidencias && (
              <button
                type="button"
                onClick={() => setShowAllIncidencias(true)}
                className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 cursor-pointer transition-colors"
              >
                {tr("pages.planning.sidebar.form.showMore", dict, {
                  count: String(collapsedSecondary.length),
                })}
              </button>
            )}

            {/* "Show less" button when expanded */}
            {hasCollapsed && showAllIncidencias && (
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
      {/* Live workflow stage — sits above the KPIs as the form's first data row */}
      {liveTaskStage && (
        <InfoRow
          label={tr("pages.planning.sidebar.taskStage.label", dict)}
          value={tr(`pages.planning.sidebar.taskStage.${liveTaskStage}`, dict)}
        />
      )}
      {/* KPIs Section */}
      <FormSection title={tr("pages.planning.sidebar.form.kpis", dict)}>
        <LeadTimeDisplay leadTime={selectedService.leadTime} dict={dict} />
        <KpiRow label="ETA" value={eta} />
        <ProgressBar
          label={{ text: tr("pages.planning.sidebar.form.occupancy", dict) }}
          progress={occupancy}
          value={{ text: formatPercent(occupancy) }}
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
                : formatPercent(selectedService.loadMaxUtilization)
            }
          />
          {selectedService.loadConstraint === "Carga" && (
            <InfoRow
              label={tr("pages.planning.sidebar.form.weightUtilization", dict)}
              value={
                selectedService.loadWeightUtilization == null
                  ? "—"
                  : formatPercent(selectedService.loadWeightUtilization)
              }
            />
          )}
          {selectedService.loadConstraint === "Pallets" && (
            <InfoRow
              label={tr("pages.planning.sidebar.form.palletUtilization", dict)}
              value={
                selectedService.loadPalletUtilization == null
                  ? "—"
                  : formatPercent(selectedService.loadPalletUtilization)
              }
            />
          )}
          {selectedService.loadConstraint === "Volumen" && (
            <InfoRow
              label={tr("pages.planning.sidebar.form.volumeUtilization", dict)}
              value={
                selectedService.loadVolumeUtilization == null
                  ? "—"
                  : formatPercent(selectedService.loadVolumeUtilization)
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
        {selectedService.mintral_clientRut && (
          <InfoRow
            label={tr("pages.planning.sidebar.form.clientRut", dict)}
            value={selectedService.mintral_clientRut}
          />
        )}
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
        {selectedService.expectedDepartureDate && (
          <InfoRow
            label={tr("pages.planning.sidebar.form.departureDate", dict)}
            value={formatDateString(
              selectedService.expectedDepartureDate,
              "datetime"
            )}
          />
        )}
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
      </fieldset>
      {/* Custom Tabs. Kept outside the disabled fieldset so viewers can
          still switch between Planificación and Asignación for inspection
          — `<fieldset disabled>` would otherwise disable the tab buttons
          themselves. The tab *content* is re-wrapped below in its own
          disabled fieldset so the actual inputs remain non-mutating. */}
      {/* Tab region: the generic package shell owns the planificación body
          (service-category select + time/andén picker + confirm) and the tab
          layout; the assignment tab (domain) is injected via the assignPanel
          slot. Rendered inside this <form> so its confirm button submits it. */}
      <SidebarFormShell
        tabs={
          <TabButtons
            pill
            tabs={
              [
                {
                  id: "planificacion",
                  label: tr("pages.planning.sidebar.form.planningTab", dict),
                  icon: <HiCalendar />,
                  // Viewers can still tab through to inspect each section's
                  // values; mutation surfaces are suppressed by isReadOnlyView.
                  disabled: !canPlan && !isReadOnlyView,
                },
                {
                  id: "assignment",
                  label: tr("pages.planning.sidebar.form.assignmentTab", dict),
                  icon: <HiUserAdd />,
                  disabled: !canAssign && !isReadOnlyView,
                },
              ] as TabItem<TabType>[]
            }
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        }
        activeTab={activeTab}
        canPlan={canPlan}
        canAssign={canAssign}
        isReadOnlyView={isReadOnlyView}
        serviceCategoryOptions={serviceCategoryOptions}
        selectedServiceCategory={selectedServiceCategory}
        onServiceCategoryChange={setSelectedServiceCategory}
        isLoadingServiceTypes={isLoadingServiceTypes}
        timeOptions={timeOptions}
        selectedTime={selectedTime}
        onTimeChange={setSelectedTime}
        isSlotsLoading={isSlotsLoading}
        canConfirm={canConfirm}
        isReassigning={reassigningService !== null}
        isSubmitting={isSubmitting}
        assignPanel={
          <>
            <AssignmentForm
              value={assignmentData}
              onChange={setAssignmentData}
              dict={dict}
              mintralClientRut={selectedService?.mintral_clientRut}
              mintralDelegacionOrigen={
                selectedService?.mintral_delegacionOrigen ??
                selectedService?.origen
              }
            />
            {!isReadOnlyView && (
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  color="blue"
                  className="flex-1"
                  onClick={handleAssign}
                  disabled={
                    !assigningService ||
                    !assignmentData.carrier ||
                    !assignmentData.driver ||
                    !assignmentData.truck ||
                    isSubmitting
                  }
                >
                  {isSubmitting && <Spinner size="sm" className="mr-2" />}
                  {tr("pages.planning.sidebar.form.assign", dict)}
                </Button>
              </div>
            )}
          </>
        }
      />
    </form>
  );
}
