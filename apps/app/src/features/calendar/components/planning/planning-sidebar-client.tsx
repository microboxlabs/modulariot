"use client";

import { useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import { HiArrowLeft, HiX, HiSwitchHorizontal } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  usePlanningSelection,
  type SelectedService,
  getLeadTimeStatus,
  DEBUG_SHOW_TEST_SERVICE,
  TEST_SERVICES,
} from "./planning-selection-context";
import { PlanningSidebarForm } from "./planning-sidebar-form";
import { ServiceEvent } from "./service-event";
import { PlanningSearchAutocomplete } from "./planning-search-autocomplete";
import { PlanningSearchTags } from "./planning-search-tags";
import { ShowNotification } from "@/features/notifications/notification";
import { useMyTasks } from "@/features/common/providers/client-api.provider";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { transformBoardsToTableData } from "@/features/shipping/utils/transform-data";

interface PlanningSidebarClientProps {
  dict: I18nDictionary;
}

type PlanningSearchMatchType =
  | "id"
  | "cliente"
  | "origen"
  | "destino"
  | "lugarCarguio"
  | "permanencia"
  | "tipoViaje";

/**
 * Determine trip type from serviceKind or executionType
 */
function determineTripType(
  task: KanbanBoardTask
): "Sider" | "Doble Sider" | "Rampla" {
  if (task.serviceKind === "Sider") return "Sider";
  if (task.serviceKind === "Doble Sider") return "Doble Sider";
  if (task.executionType === "Rampla") return "Rampla";
  return "Sider"; // Default
}

/**
 * Calculate permanencia (duration) from departure and arrival dates
 */
function calculatePermanencia(task: KanbanBoardTask): string {
  if (!task.departureDate || !task.estimatedArrivalDate) {
    return "24h"; // Default
  }

  const dep = dayjs(task.departureDate);
  const arr = dayjs(task.estimatedArrivalDate);

  if (!arr.isValid() || !dep.isValid()) {
    return "24h"; // Default
  }

  const hours = arr.diff(dep, "hour");
  return `${hours}h`;
}

/**
 * Extract incidencias from task fields
 */
function extractIncidencias(task: KanbanBoardTask): string[] {
  const incidencias: string[] = [];

  if (task.mintral_priorityCode) {
    incidencias.push(task.mintral_priorityCode.toLowerCase());
  }
  // Only add "urgencia" if we have actual compliance data showing 0%
  // Don't add it when data is missing (undefined/null)
  if (
    task.mintral_deliveryComplianceRate !== undefined &&
    task.mintral_deliveryComplianceRate !== null &&
    task.mintral_deliveryComplianceRate === 0
  ) {
    incidencias.push("urgencia");
  }

  return incidencias;
}

/**
 * Extract and validate mintral_incidents to proper tuple format
 */
function extractMintralIncidents(
  incidents: KanbanBoardTask["mintral_incidents"]
): Array<[string, string]> | undefined {
  if (!incidents) return undefined;

  return incidents
    .filter(
      (incident): incident is [string, string] =>
        Array.isArray(incident) &&
        incident.length === 2 &&
        typeof incident[0] === "string" &&
        typeof incident[1] === "string"
    )
    .map((incident) => [incident[0], incident[1]] as [string, string]);
}

// Transform KanbanBoardTask to SelectedService
function transformTaskToService(task: KanbanBoardTask): SelectedService {
  const serviceId = task.name || task.id;
  const tipoViaje = determineTripType(task);
  const permanencia = calculatePermanencia(task);

  return {
    id: serviceId,
    cliente: task.client || task.clientCode || "",
    origen: task.origin || "",
    lugarCarguio: "", // Not available in KanbanBoardTask
    destino: task.destination || "",
    tipoViaje,
    ocupacion: task.mintral_loadMaxUtilization ?? 0,
    permanencia,
    leadTime: {
      total_lineasoc_cumplen: task.mintral_compliantOrderLines ?? 0,
      total_lineasoc_incumplen: task.mintral_nonCompliantOrderLines ?? 0,
      lineasoc_pctn_cumplimiento: task.mintral_deliveryComplianceRate ?? 0,
    },
    eta: task.estimatedArrivalDate || task.arrivalDate || "",
    incidencias: extractIncidencias(task),
    mintral_incidents: extractMintralIncidents(task.mintral_incidents),
    observaciones: task.description || "",
    prioridad: task.mintral_icuCondition ?? 0,
    cm_created: task.cm_created,
    loadConstraint: task.mintral_loadConstraint,
    loadMaxUtilization: task.mintral_loadMaxUtilization,
    loadWeightUtilization: task.mintral_loadWeightUtilization,
    loadPalletUtilization: task.mintral_loadPalletUtilization,
    loadVolumeUtilization: task.mintral_loadVolumeUtilization,
    serviceCategory: task.mintral_serviceCategory ?? undefined,
  };
}

/**
 * Client-side sidebar that shows:
 * 1. Services list when no selection
 * 2. Assignment form when a service is selected
 */
export function PlanningSidebarClient({
  dict,
}: Readonly<PlanningSidebarClientProps>) {
  const {
    selectedSlot,
    selectedService,
    clearService,
    closeSidebar,
    selectService,
    reassigningService,
    cancelReassignment,
    andenesCount,
    backendSlots,
    isSlotsLoading,
  } = usePlanningSelection();
  const [filteredServiceId, setFilteredServiceId] = useState<string | null>(
    null
  );
  const [filterMatchType, setFilterMatchType] = useState<{
    matchType: PlanningSearchMatchType;
    query: string;
  } | null>(null);
  const [searchTags, setSearchTags] = useState<
    Array<{ matchType: PlanningSearchMatchType; value: string }>
  >([]);

  // Handle cancel reassignment
  const handleCancelReassignment = useCallback(() => {
    cancelReassignment();
    ShowNotification({
      type: "info",
      message: "Reasignación cancelada",
    });
  }, [cancelReassignment]);

  // Build API params from search tags
  const apiParams = useMemo(() => {
    const params: string[] = [];

    for (const tag of searchTags) {
      switch (tag.matchType) {
        case "id": {
          // Extract numeric part from service ID (e.g., "1045782-v" -> "1045782")
          const serviceCodeMatch = /^(\d+)/.exec(tag.value);
          const numericServiceCode = serviceCodeMatch
            ? serviceCodeMatch[1]
            : tag.value;
          params.push(`service=${numericServiceCode}`);
          break;
        }
        case "cliente":
          params.push(`customer=${tag.value}`);
          break;
        case "origen":
          params.push(`origin=${tag.value.toUpperCase()}`);
          break;
        case "destino":
          params.push(`destination=${tag.value.toUpperCase()}`);
          break;
        // lugarCarguio, permanencia, tipoViaje don't have direct API mappings
        // They will be filtered client-side if needed
      }
    }

    return params.join("&");
  }, [searchTags]);

  // Fetch tasks from API
  const { data: myTasksData, isLoading: isLoadingTasks } = useMyTasks(
    ["planService"], //...SHIPPING_COORDINATOR_PROCESS_TASKS_V2
    false, // showFinished
    1, // page (1-based, but API uses 0-based internally)
    100, // limit
    apiParams || undefined
  );

  // Transform API data to SelectedService array
  const apiServices = useMemo(() => {
    if (!myTasksData?.data) return [];

    const tasks = transformBoardsToTableData(myTasksData.data);
    return tasks.map(transformTaskToService);
  }, [myTasksData]);

  // Use only real API data - no fallback to mock
  // When DEBUG_SHOW_TEST_SERVICE is true, add test services for development
  const allServices = DEBUG_SHOW_TEST_SERVICE
    ? [...TEST_SERVICES, ...apiServices]
    : apiServices;

  // Format the selected slot for display with start and end times.
  // Always use the actual selected slot's time (e.g., 10:00-10:30) rather than
  // the entire time window's boundaries (e.g., 9:00-11:00).
  const formattedSlot = useMemo(() => {
    if (!selectedSlot) return undefined;

    const startDate = dayjs(selectedSlot.date)
      .hour(selectedSlot.hour)
      .minute(selectedSlot.minutes);

    const endDate = startDate.add(30, "minute");

    const dateStr = formatDateString(startDate.toDate(), "date");
    const startTime = formatDateString(startDate.toDate(), "time");
    const endTime = formatDateString(endDate.toDate(), "time");

    return {
      date: dateStr,
      startTime,
      endTime,
      full: `${dateStr}, ${startTime} - ${endTime}`,
    };
  }, [selectedSlot]);

  type MatchType =
    | "id"
    | "cliente"
    | "origen"
    | "destino"
    | "lugarCarguio"
    | "permanencia"
    | "tipoViaje";

  // Helper function to check if service matches a match type
  const matchesService = useCallback(
    (
      service: SelectedService,
      matchType: MatchType,
      query: string
    ): boolean => {
      switch (matchType) {
        case "id":
          return service.id.toLowerCase().includes(query);
        case "cliente":
          return service.cliente.toLowerCase().includes(query);
        case "origen":
          return service.origen.toLowerCase().includes(query);
        case "destino":
          return service.destino.toLowerCase().includes(query);
        case "lugarCarguio":
          return service.lugarCarguio.toLowerCase().includes(query);
        case "permanencia":
          return service.permanencia.toLowerCase().includes(query);
        case "tipoViaje":
          return service.tipoViaje.toLowerCase().includes(query);
        default:
          return false;
      }
    },
    []
  );

  // Sort services by urgency/status priority:
  // 1. Urgent (red-orange)
  // 2. Error/Delayed (red) - 0% compliance
  // 3. Warning (yellow) - partial compliance
  // 4. Success/On time (green) - 100% compliance
  const sortedServices = useMemo(() => {
    const getStatusPriority = (service: SelectedService): number => {
      if (service.incidencias.includes("urgencia")) return 0; // Urgent first
      const status = getLeadTimeStatus(service.leadTime);
      if (status === "error") return 1;
      if (status === "warning") return 2;
      return 3; // success last
    };

    let services = [...allServices];

    // Client-side filtering for attributes that don't have API params (lugarCarguio, permanencia, tipoViaje)
    if (searchTags.length > 0) {
      const clientSideTags = searchTags.filter(
        (tag) =>
          tag.matchType === "lugarCarguio" ||
          tag.matchType === "permanencia" ||
          tag.matchType === "tipoViaje"
      );

      if (clientSideTags.length > 0) {
        services = services.filter((service) => {
          return clientSideTags.some((tag) => {
            const lowerValue = tag.value.toLowerCase();
            return matchesService(service, tag.matchType, lowerValue);
          });
        });
      }
    }

    // Legacy filters (only apply if no tags are active)
    if (searchTags.length === 0) {
      if (filterMatchType) {
        // Legacy: Filter by match type if search was used (but no tags)
        const { matchType, query } = filterMatchType;
        const lowerQuery = query.toLowerCase();

        services = services.filter((service) => {
          switch (matchType) {
            case "id":
              return service.id.toLowerCase().includes(lowerQuery);
            case "cliente":
              return service.cliente.toLowerCase().includes(lowerQuery);
            case "origen":
              return service.origen.toLowerCase().includes(lowerQuery);
            case "destino":
              return service.destino.toLowerCase().includes(lowerQuery);
            case "lugarCarguio":
              return service.lugarCarguio.toLowerCase().includes(lowerQuery);
            case "permanencia":
              return service.permanencia.toLowerCase().includes(lowerQuery);
            case "tipoViaje":
              return service.tipoViaje.toLowerCase().includes(lowerQuery);
            default:
              return true;
          }
        });
      } else if (filteredServiceId) {
        // Filter by selected service ID if search was used (legacy support)
        services = services.filter((s) => s.id === filteredServiceId);
      }
    }

    return services.sort((a, b) => getStatusPriority(a) - getStatusPriority(b));
  }, [
    filteredServiceId,
    filterMatchType,
    searchTags,
    matchesService,
    allServices,
  ]);

  const handleSubmit = () => {
    closeSidebar();
  };

  const handleBack = () => {
    clearService(); // Go back to services list, keep sidebar open
    // Keep filters and tags when going back - user can still see filtered results
  };

  const handleCancel = () => {
    closeSidebar(); // Close the entire sidebar
  };

  const handleSearchSelect = (service: SelectedService) => {
    selectService(service);
    setFilteredServiceId(service.id);
  };

  const handleSearchClear = () => {
    setFilteredServiceId(null);
    setFilterMatchType(null);
    setSearchTags([]);
  };

  const handleMatchTypeSelect = (
    matchType:
      | "id"
      | "cliente"
      | "origen"
      | "destino"
      | "lugarCarguio"
      | "permanencia"
      | "tipoViaje",
    query: string
  ) => {
    // Add tag if not already present (check both matchType and value)
    setSearchTags((prev) => {
      const exists = prev.some(
        (tag) => tag.matchType === matchType && tag.value === query
      );
      if (!exists) {
        return [...prev, { matchType, value: query }];
      }
      return prev;
    });
    setFilterMatchType({ matchType, query });
    setFilteredServiceId(null); // Clear service ID filter
  };

  const handleTagsChange = (
    tags: Array<{
      matchType:
        | "id"
        | "cliente"
        | "origen"
        | "destino"
        | "lugarCarguio"
        | "permanencia"
        | "tipoViaje";
      value: string;
    }>
  ) => {
    setSearchTags(tags);

    // If all tags are removed, clear all filters
    if (tags.length === 0) {
      setFilterMatchType(null);
      setFilteredServiceId(null);
    }
    // Note: We don't update filterMatchType when tags change
    // because filtering is now based directly on searchTags array
  };

  const isFormActive = Boolean(selectedService);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Selected slot display */}
      {formattedSlot && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {tr("pages.planning.sidebar.form.slot", dict)}:
            </span>
            <span className="font-medium text-gray-900 dark:text-white capitalize">
              {formattedSlot.date}
            </span>
            <span className="font-mono font-medium text-gray-900 dark:text-white">
              {formattedSlot.startTime}
            </span>
            <span className="text-gray-300 dark:text-gray-600">→</span>
            <span className="font-mono font-medium text-gray-900 dark:text-white">
              {formattedSlot.endTime}
            </span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="px-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 h-10">
          {isFormActive ? (
            <button
              type="button"
              onClick={
                reassigningService === null
                  ? handleBack
                  : handleCancelReassignment
              }
              className="p-1 -ml-1 rounded-md transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              aria-label={
                reassigningService === null
                  ? tr("pages.planning.sidebar.form.back", dict)
                  : tr("pages.planning.sidebar.form.cancelReassignment", dict)
              }
            >
              <HiArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 -ml-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={tr("pages.planning.sidebar.form.cancel", dict)}
            >
              <HiX className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isFormActive
              ? tr("pages.planning.sidebar.title", dict)
              : tr("pages.planning.sidebar.servicesList", dict)}
          </h2>
          {selectedService?.id && (
            <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
              {selectedService.id}
            </span>
          )}
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 p-3 overflow-y-auto">
        {isFormActive ? (
          <PlanningSidebarForm
            dict={dict}
            isActive={true}
            selectedService={
              selectedService
                ? {
                    ...selectedService,
                    slot: formattedSlot?.full,
                  }
                : undefined
            }
            onSubmit={handleSubmit}
            andenesCount={andenesCount}
            slotStartTime={formattedSlot?.startTime}
            slotEndTime={formattedSlot?.endTime}
            backendSlots={backendSlots}
            isSlotsLoading={isSlotsLoading}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {/* Reassignment mode banner */}
            {reassigningService && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                <HiSwitchHorizontal className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Reasignando servicio
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
                    {reassigningService.service.service.id}
                  </p>
                </div>
              </div>
            )}

            {/* Search bar with autocomplete */}
            <PlanningSearchAutocomplete
              dict={dict}
              services={allServices}
              onSelect={handleSearchSelect}
              onMatchTypeSelect={handleMatchTypeSelect}
              onClear={handleSearchClear}
              hasActiveFilter={searchTags.length > 0}
              isLoading={isLoadingTasks}
            />

            {/* Tags manager */}
            {searchTags.length > 0 && (
              <PlanningSearchTags
                dict={dict}
                tags={searchTags}
                onTagsChange={handleTagsChange}
              />
            )}

            {/* Services list */}
            <div className="flex flex-col gap-1.5">
              {sortedServices.length > 0 ? (
                sortedServices.map((service) => {
                  const isReassigning =
                    reassigningService?.service.service.id === service.id;
                  return (
                    <div
                      key={service.id}
                      className={twMerge(
                        "rounded-xl",
                        isReassigning &&
                          "ring-2 ring-amber-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-800"
                      )}
                    >
                      <ServiceEvent service={service} />
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  {tr("pages.planning.sidebar.search.noResults", dict)}
                </p>
              )}
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
              {reassigningService
                ? "Seleccione una fecha y hora en el calendario para reasignar"
                : tr("pages.planning.sidebar.selectServiceHint", dict)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
