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
import { SHIPPING_COORDINATOR_PROCESS_TASKS_V2 } from "@/features/task-forms/services/form.service";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { transformBoardsToTableData } from "@/features/shipping/utils/transform-data";

interface PlanningSidebarClientProps {
  dict: I18nDictionary;
}

// Transform KanbanBoardTask to SelectedService
function transformTaskToService(task: KanbanBoardTask): SelectedService {
  // Extract service code from name (format: "1045782-V" or "1045782-v")
  // Use name if available, otherwise use id
  const serviceId = task.name || task.id;

  // Determine trip type from serviceKind or executionType
  const tipoViaje =
    task.serviceKind === "Sider"
      ? "Sider"
      : task.serviceKind === "Doble Sider"
        ? "Doble Sider"
        : task.executionType === "Rampla"
          ? "Rampla"
          : "Sider"; // Default

  // Calculate permanencia from dates if available
  let permanencia = "24h"; // Default
  if (task.departureDate && task.estimatedArrivalDate) {
    const dep = dayjs(task.departureDate);
    const arr = dayjs(task.estimatedArrivalDate);
    if (arr.isValid() && dep.isValid()) {
      const hours = arr.diff(dep, "hour");
      permanencia = `${hours}h`;
    }
  }

  // Calculate lead time compliance from mintral_icuCondition
  // Positive values = compliant, negative = non-compliant
  const icuCondition = task.mintral_icuCondition ?? 0;
  const totalLines = 4; // Default total lines for calculation
  const compliantLines =
    icuCondition >= 0
      ? Math.min(totalLines, Math.abs(icuCondition) + 2)
      : Math.max(0, totalLines - Math.abs(icuCondition));
  const nonCompliantLines = totalLines - compliantLines;
  const compliancePercentage = Math.round((compliantLines / totalLines) * 100);

  // Extract incidencias from priority code or other fields
  const incidencias: string[] = [];
  if (task.mintral_priorityCode) {
    incidencias.push(task.mintral_priorityCode.toLowerCase());
  }
  if (compliancePercentage === 0) {
    incidencias.push("urgencia");
  }

  // Extract mintral_incidents - filter and map to proper format
  const mintral_incidents: Array<[string, string]> | undefined = task.mintral_incidents
    ? task.mintral_incidents
        .filter(
          (incident): incident is [string, string] =>
            Array.isArray(incident) &&
            incident.length === 2 &&
            typeof incident[0] === "string" &&
            typeof incident[1] === "string"
        )
        .map((incident) => [incident[0], incident[1]] as [string, string])
    : undefined;

  return {
    id: serviceId,
    cliente: task.client || task.clientCode || "",
    origen: task.origin || "",
    lugarCarguio: "", // Not available in KanbanBoardTask
    destino: task.destination || "",
    tipoViaje: tipoViaje as "Sider" | "Doble Sider" | "Rampla",
    ocupacion: 0, // Not available in KanbanBoardTask
    permanencia,
    leadTime: {
      total_lineasoc_cumplen: compliantLines,
      total_lineasoc_incumplen: nonCompliantLines,
      lineasoc_pctn_cumplimiento: compliancePercentage,
    },
    eta: task.estimatedArrivalDate || task.arrivalDate || "",
    incidencias,
    mintral_incidents,
    observaciones: task.description || "",
    prioridad:
      task.mintral_icuCondition !== undefined ? task.mintral_icuCondition : 0,
    cm_created: task.cm_created,
  };
}

// Mock services commented out - using only real API data
// const MOCK_SERVICES: SelectedService[] = [
//   {
//     id: "1045782-v",
//     cliente: "Acme Corp",
//     origen: "VAP",
//     lugarCarguio: "Andén 5",
//     destino: "ZOS",
//     tipoViaje: "Sider",
//     ocupacion: 85,
//     permanencia: "24h",
//     leadTime: {
//       deadline: "2026-02-15",
//       status: "on_time",
//     },
//     eta: "2026-02-16T14:30:00",
//     incidencias: ["urgencia", "c4", "c5"],
//     observaciones:
//       "Presentar documentación antes de las 10:00. Contactar a Juan.",
//     prioridad: 1,
//   },
//   {
//     id: "1045782-v",
//     cliente: "Acme Corp",
//     origen: "SCL",
//     lugarCarguio: "Andén 5",
//     destino: "VAP",
//     tipoViaje: "Sider",
//     ocupacion: 85,
//     permanencia: "24h",
//     leadTime: {
//       deadline: "2026-01-15",
//       status: "on_time",
//     },
//     eta: "2026-01-16T14:30:00",
//     incidencias: ["urgencia", "c4", "c5"],
//     observaciones:
//       "Presentar documentación antes de las 10:00. Contactar a Juan.",
//     prioridad: 1,
//   },
//   {
//     id: "2038491-v",
//     cliente: "Minera Los Andes",
//     origen: "SCL",
//     lugarCarguio: "Dock 3",
//     destino: "VAP",
//     tipoViaje: "Doble Sider",
//     ocupacion: 60,
//     permanencia: "48h",
//     leadTime: {
//       deadline: "2026-01-14",
//       status: "warning",
//     },
//     eta: "2026-01-15T09:00:00",
//     incidencias: ["shutdown"],
//     observaciones: "Carga frágil. Requiere supervisión especial.",
//     prioridad: 2,
//   },
//   {
//     id: "1049760-v",
//     cliente: "Transportes del Norte",
//     origen: "SCL",
//     lugarCarguio: "Plataforma 1",
//     destino: "VAP",
//     tipoViaje: "Rampla",
//     ocupacion: 100,
//     permanencia: "12h",
//     leadTime: {
//       deadline: "2026-01-13",
//       status: "delayed",
//     },
//     eta: "2026-01-14T18:00:00",
//     incidencias: ["urgencia", "shutdown", "c4", "c5", "c7", "c8", "c9"],
//     observaciones: "URGENTE: Cliente prioritario. Llamar antes de salir.",
//     prioridad: 1,
//   },
//   {
//     id: "4815263-v",
//     cliente: "Agrícola Sur",
//     origen: "SCL",
//     lugarCarguio: "Andén 2",
//     destino: "ZOS",
//     tipoViaje: "Sider",
//     ocupacion: 45,
//     permanencia: "8h",
//     leadTime: {
//       deadline: "2026-01-18",
//       status: "on_time",
//     },
//     eta: "2026-01-18T11:30:00",
//     incidencias: ["c4"],
//     observaciones: "Productos perecederos. Mantener cadena de frío.",
//     prioridad: 3,
//   },
// ];

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
    getTimeWindowForSlot,
  } = usePlanningSelection();
  const [filteredServiceId, setFilteredServiceId] = useState<string | null>(
    null
  );
  const [filterMatchType, setFilterMatchType] = useState<{
    matchType:
      | "id"
      | "cliente"
      | "origen"
      | "destino"
      | "lugarCarguio"
      | "permanencia"
      | "tipoViaje";
    query: string;
  } | null>(null);
  const [searchTags, setSearchTags] = useState<
    Array<{
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
        case "id":
          // Extract numeric part from service ID (e.g., "1045782-v" -> "1045782")
          const serviceCodeMatch = tag.value.match(/^(\d+)/);
          const numericServiceCode = serviceCodeMatch
            ? serviceCodeMatch[1]
            : tag.value;
          params.push(`service=${numericServiceCode}`);
          break;
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
  const {
    data: myTasksData,
    error: myTasksError,
    isLoading: isLoadingTasks,
  } = useMyTasks(
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

  // Default slot duration in minutes (can be changed in the future)
  const SLOT_DURATION_MINUTES = 30;

  // Get the time window for the selected slot to get quota
  const selectedTimeWindow = useMemo(() => {
    if (!selectedSlot) return null;
    return getTimeWindowForSlot(
      selectedSlot.date,
      selectedSlot.hour,
      selectedSlot.minutes
    );
  }, [selectedSlot, getTimeWindowForSlot]);

  // Calculate the number of base slots in the time window
  const windowBaseSlots = useMemo(() => {
    if (!selectedTimeWindow?.weeklyPattern) return 1;
    // Parse the window pattern to get start and end times
    const match = selectedTimeWindow.weeklyPattern.match(/(\d{4})-(\d{4})$/);
    if (!match) return 1;
    const [, startTime, endTime] = match;
    const startHour = parseInt(startTime.slice(0, 2), 10);
    const startMinutes = parseInt(startTime.slice(2, 4), 10);
    const endHour = parseInt(endTime.slice(0, 2), 10);
    const endMinutes = parseInt(endTime.slice(2, 4), 10);

    const totalMinutes =
      endHour * 60 + endMinutes - (startHour * 60 + startMinutes);
    return Math.max(1, Math.floor(totalMinutes / SLOT_DURATION_MINUTES));
  }, [selectedTimeWindow]);

  // Format the selected slot for display with start and end times
  const formattedSlot = useMemo(() => {
    if (!selectedSlot) return undefined;
    const startDate = dayjs(selectedSlot.date)
      .hour(selectedSlot.hour)
      .minute(selectedSlot.minutes);
    const endDate = startDate.add(SLOT_DURATION_MINUTES, "minute");

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

    // COMMENTED OUT: Advanced filtering logic (OR/AND) - will be re-enabled later
    // Filter by tags if they exist (tags take priority)
    // if (searchTags.length > 0) {
    //   // Filter out invalid tags first
    //   const validTags = searchTags.filter(
    //     (tag): tag is { matchType: MatchType; value: string } =>
    //       tag != null &&
    //       typeof tag === "object" &&
    //       "matchType" in tag &&
    //       "value" in tag &&
    //       typeof tag.matchType === "string" &&
    //       typeof tag.value === "string" &&
    //       tag.value.length > 0
    //   );

    //   if (validTags.length > 0) {
    //     // Group tags by matchType (attribute)
    //     // Example: { origen: ["SCL", "VAP"], destino: ["ZOS"] }
    //     const tagsByType = new Map<MatchType, string[]>();
    //     for (const tag of validTags) {
    //       if (!tagsByType.has(tag.matchType)) {
    //         tagsByType.set(tag.matchType, []);
    //       }
    //       tagsByType.get(tag.matchType)!.push(tag.value);
    //     }

    //     // Filter services with the logic:
    //     // - OR within same attribute: (origen: SCL OR origen: VAP)
    //     // - AND between different attributes: (origen group) AND (destino group)
    //     // Example: (origen: SCL OR origen: VAP) AND (destino: ZOS)
    //     services = services.filter((service) => {
    //       // Service must match at least one value from EACH attribute type (AND between attribute types)
    //       return Array.from(tagsByType.entries()).every(([matchType, values]) => {
    //         // For each attribute type, service must match ANY of its values (OR within same attribute)
    //         return values.some((value) => {
    //           const lowerValue = value.toLowerCase();
    //           return matchesService(service, matchType, lowerValue);
    //         });
    //       });
    //     });
    //   }
    // }

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

    // COMMENTED OUT: Sort by tag order - will be re-enabled later
    // if (searchTags.length > 0) {
    //   // Filter out invalid tags (safety check for malformed tag objects)
    //   const validTags = searchTags.filter(
    //     (tag): tag is { matchType: MatchType; value: string } =>
    //       tag != null &&
    //       typeof tag === "object" &&
    //       "matchType" in tag &&
    //       "value" in tag &&
    //       typeof tag.matchType === "string" &&
    //       typeof tag.value === "string" &&
    //       tag.value.length > 0
    //   );

    //   if (validTags.length > 0) {
    //     return services.sort((a, b) => {
    //       // First sort by tag order priority
    //       for (const tag of validTags) {
    //         const lowerValue = tag.value.toLowerCase();
    //         const aMatches = matchesService(a, tag.matchType, lowerValue);
    //         const bMatches = matchesService(b, tag.matchType, lowerValue);

    //         if (aMatches && !bMatches) return -1;
    //         if (!aMatches && bMatches) return 1;
    //       }

    //       // Then by status priority
    //       return getStatusPriority(a) - getStatusPriority(b);
    //     });
    //   }
    // }

    return services.sort((a, b) => getStatusPriority(a) - getStatusPriority(b));
  }, [
    filteredServiceId,
    filterMatchType,
    searchTags,
    matchesService,
    allServices,
  ]);

  const handleSubmit = (values: Record<string, string | boolean>) => {
    console.log("Form submitted:", { selectedService, values });
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
                reassigningService !== null
                  ? handleCancelReassignment
                  : handleBack
              }
              className="p-1 -ml-1 rounded-md transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              aria-label={
                reassigningService !== null
                  ? tr("pages.planning.sidebar.form.cancelReassignment", dict)
                  : tr("pages.planning.sidebar.form.back", dict)
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
            windowQuota={selectedTimeWindow?.quota}
            windowBaseSlots={windowBaseSlots}
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
