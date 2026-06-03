"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import { HiSwitchHorizontal } from "react-icons/hi";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SidebarShell,
  useCalendarHost,
  type CalendarItem,
} from "@microboxlabs/miot-calendar-ui";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  usePlanningSelection,
  type SelectedService,
} from "./planning-selection-context";
import { PlanningSidebarForm } from "./planning-sidebar-form";
import { PlanningSearchAutocomplete } from "./planning-search-autocomplete";
import { PlanningSearchTags } from "./planning-search-tags";
import { useCalendarViewMode } from "./use-calendar-view-mode";
import {
  useCalendars,
  useMyTasks,
} from "@/features/common/providers/client-api.provider";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { KanbanBoardTask } from "@/features/shipping/types/common.types";

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

function toPercent(value: number | null | undefined): number | null {
  // Preserve "no data" semantics — null/undefined upstream means the metric
  // hasn't been measured, which is distinct from a measured 0%. Rendering
  // and the backend sort agree on this via the calendarPlanningPriority
  // preset (ecm-coordinator #238).
  if (value == null) return null;
  return Math.round(value <= 1 ? value * 100 : value);
}

// Transform KanbanBoardTask to SelectedService
function transformTaskToService(task: KanbanBoardTask): SelectedService {
  const serviceId = task.name || task.id;
  const tipoViaje = determineTripType(task);
  const permanencia = calculatePermanencia(task);

  return {
    id: serviceId,
    mintral_serviceCode: task.mintral_serviceCode,
    cliente: task.client || task.clientCode || "",
    mintral_clientRut: task.mintral_clientRut,
    mintral_delegacionOrigen: task.mintral_delegacionOrigen,
    origen: task.origin || "",
    lugarCarguio: "", // Not available in KanbanBoardTask
    destino: task.destination || "",
    tipoViaje,
    mintral_serviceType: task.serviceType || undefined,
    ocupacion: 100 * (task.mintral_loadMaxUtilization ?? 0),
    loadMaxUtilization:
      task.mintral_loadMaxUtilization == null
        ? undefined
        : 100 * task.mintral_loadMaxUtilization,
    loadWeightUtilization:
      task.mintral_loadWeightUtilization == null
        ? undefined
        : 100 * task.mintral_loadWeightUtilization,
    loadPalletUtilization:
      task.mintral_loadPalletUtilization == null
        ? undefined
        : 100 * task.mintral_loadPalletUtilization,
    loadVolumeUtilization:
      task.mintral_loadVolumeUtilization == null
        ? undefined
        : 100 * task.mintral_loadVolumeUtilization,
    permanencia,
    leadTime: {
      total_lineasoc_cumplen: task.mintral_compliantOrderLines ?? 0,
      total_lineasoc_incumplen: task.mintral_nonCompliantOrderLines ?? 0,
      lineasoc_pctn_cumplimiento: toPercent(
        task.mintral_deliveryComplianceRate
      ),
    },
    eta: task.estimatedArrivalDate || task.arrivalDate || "",
    incidencias: extractIncidencias(task),
    mintral_incidents: extractMintralIncidents(task.mintral_incidents),
    observaciones: task.description || "",
    prioridad: task.mintral_icuCondition ?? 0,
    cm_created: task.cm_created,
    loadConstraint: task.mintral_loadConstraint,
    serviceCategory: task.mintral_serviceCategory ?? undefined,
    expectedDepartureDate: task.expectedDepartureDate || "",
    presentationDate: task.mintral_creationDate || task.cm_created || "",
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
    calendarId,
    selectedSlot,
    selectedService,
    clearService,
    closeSidebar,
    selectService,
    reassigningService,
    assigningService,
    andenesCount,
    backendSlots,
    isSlotsLoading,
    bookingVersion,
    isSidebarOpen,
    getLiveTask,
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
  // Debounced text from the autocomplete. Flows into `apiParams` as `q=` so
  // the backend prefix-search reaches services beyond the loaded page.
  const [searchQuery, setSearchQuery] = useState("");

  // Seed search tags from the active calendar's stored filter (origin /
  // destination delegate codes). Re-seed only when the filter signature
  // changes — i.e. when the user navigates to a different calendar or
  // updates the calendar's filter via the gear menu. Manual chip removals
  // are session-only and must not get re-seeded.
  const { calendars } = useCalendars();
  const activeCalendar = useMemo(
    () => calendars.find((c) => c.id === calendarId),
    [calendars, calendarId]
  );
  const lastSeededSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeCalendar) return;
    const sig = `${activeCalendar.id}|${activeCalendar.filter?.origin ?? ""}|${activeCalendar.filter?.destination ?? ""}`;
    if (lastSeededSigRef.current === sig) return;
    lastSeededSigRef.current = sig;

    const seeded: Array<{ matchType: PlanningSearchMatchType; value: string }> =
      [];
    if (activeCalendar.filter?.origin) {
      seeded.push({ matchType: "origen", value: activeCalendar.filter.origin });
    }
    if (activeCalendar.filter?.destination) {
      seeded.push({
        matchType: "destino",
        value: activeCalendar.filter.destination,
      });
    }
    setSearchTags(seeded);
  }, [activeCalendar]);

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

    if (calendarId) {
      params.push(`calendarId=${calendarId}`);
    }

    if (searchQuery) {
      params.push(`q=${encodeURIComponent(searchQuery)}`);
    }

    // Server-side sort preset (ecm-coordinator #238): C309 urgency first,
    // then mintral_deliveryComplianceRate ASC. Resolves the pagination
    // correctness gap of the previous client-side sort.
    params.push("orderBy=mintral_calendarPlanningPriority");

    return params.join("&");
  }, [searchTags, calendarId, searchQuery]);

  // Fetch tasks from API
  const {
    data: myTasksData,
    isLoading: isLoadingTasks,
    refresh: refreshTasks,
  } = useMyTasks(
    [
      "planService",
      "assignDriver",
      "presentDriver",
      "prepareService",
      "missionControl",
    ],
    false, // showFinished
    1, // page (1-based, but API uses 0-based internally)
    100, // limit
    apiParams || undefined
  );

  // Re-fetch task list when a booking is created or removed
  useEffect(() => {
    if (bookingVersion > 0) {
      refreshTasks();
    }
  }, [bookingVersion, refreshTasks]);

  // Transform API data to SelectedService array. The kanban stage isn't
  // attached here — every consumer that needs the current stage for a
  // service should resolve it via context's `getLiveTask`, which reads the
  // freshly fetched workflow index by `mintral_serviceCode` and is stable
  // across stage advances.
  //
  // Prefer `orderedTasks` when the proxy provides it: the planner relies on
  // the calendarPlanningPriority preset's GLOBAL sort across stages, which
  // is lost by `Object.values(data)` (board-binned). The proxy emits
  // orderedTasks only on the single-call calendarId path; older consumers
  // and the fanout paths still get the board-binned `data`.
  const apiServices = useMemo(() => {
    if (!myTasksData) return [];

    if (myTasksData.orderedTasks && myTasksData.orderedTasks.length > 0) {
      return myTasksData.orderedTasks.map((task) =>
        transformTaskToService(task)
      );
    }

    if (!myTasksData.data) return [];

    const services: SelectedService[] = [];
    for (const board of Object.values(myTasksData.data)) {
      for (const task of board.tasks) {
        services.push(
          transformTaskToService({ ...task, title: board.title })
        );
      }
    }
    return services;
  }, [myTasksData]);

  // Use only real API data.
  const allServices = apiServices;

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

  // Sort order is applied server-side via the calendarPlanningPriority preset
  // (ecm-coordinator #238). This memo only handles the client-side filters that
  // don't have API params (lugarCarguio, permanencia, tipoViaje) and the legacy
  // search-by-match-type fallback; the original order from the API is preserved.
  const sortedServices = useMemo(() => {
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

    return services;
  }, [
    filteredServiceId,
    filterMatchType,
    searchTags,
    matchesService,
    allServices,
  ]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { forceViewer } = useCalendarViewMode();

  // Strip the `?as=viewer` override (used by planners previewing the
  // viewer experience) without touching any other URL params. The page
  // re-renders in full-edit mode, mirroring the existing chip-menu
  // "Salir de previsualización" action. Uses `replace` so the browser
  // Back button doesn't bounce the user back into preview.
  const exitViewerPreview = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("as");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [router, pathname, searchParams]);

  const handleSubmit = () => {
    closeSidebar();
  };

  const handleBack = () => {
    // In viewer-preview mode the only way out today is the chip-menu
    // toggle. Make the sidebar's back button exit preview too, so the
    // close affordance feels symmetric to assign/reassign mode where
    // the header X cancels the special mode.
    if (forceViewer) {
      exitViewerPreview();
    }
    clearService(); // Go back to services list, keep sidebar open
    // Keep filters and tags when going back - user can still see filtered results
  };

  const handleCancel = () => {
    if (forceViewer) {
      exitViewerPreview();
    }
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

  // Preserve content state during close animation to prevent flicker.
  // When the sidebar closes, all state (selectedService, selectedSlot, etc.) is cleared
  // immediately, but the CSS transition takes 300ms. We snapshot the state when the
  // sidebar is open and use that snapshot during the close animation.
  const stateSnapshotRef = useRef<{
    isFormActive: boolean;
    selectedService: typeof selectedService;
    formattedSlot: typeof formattedSlot;
    reassigningService: typeof reassigningService;
    assigningService: typeof assigningService;
  }>({
    isFormActive: false,
    selectedService: null,
    formattedSlot: undefined,
    reassigningService: null,
    assigningService: null,
  });

  // Update snapshot only when sidebar is open
  useEffect(() => {
    if (isSidebarOpen) {
      stateSnapshotRef.current = {
        isFormActive: Boolean(selectedService),
        selectedService,
        formattedSlot,
        reassigningService,
        assigningService,
      };
    }
  }, [
    isSidebarOpen,
    selectedService,
    formattedSlot,
    reassigningService,
    assigningService,
  ]);

  // Use actual state when open, snapshot when closing
  const displayState = isSidebarOpen
    ? {
        isFormActive: Boolean(selectedService),
        selectedService,
        formattedSlot,
        reassigningService,
        assigningService,
      }
    : stateSnapshotRef.current;

  // Determine which header button to show based on current mode. Viewer-
  // preview mode is treated as a "special mode" alongside reassign/assign:
  // the header surfaces an X that exits the mode (strips `?as=viewer`),
  // mirroring how Cancelar exits assignment/reassignment.
  const isInSpecialMode =
    displayState.reassigningService !== null ||
    displayState.assigningService !== null ||
    forceViewer;
  const showCloseButton = !displayState.isFormActive || isInSpecialMode;

  // Determine the header title based on current mode
  const getHeaderTitle = (): string => {
    if (!displayState.isFormActive) {
      return tr("pages.planning.sidebar.servicesList", dict);
    }
    if (displayState.assigningService) {
      return tr("pages.planning.sidebar.assignmentTitle", dict);
    }
    return tr("pages.planning.sidebar.title", dict);
  };

  // Canonical items for the generic shell; the host's renderItemCard seam
  // renders each as the freight ServiceEvent from `item.raw`.
  const { toItem } = useCalendarHost();
  const items = useMemo<CalendarItem[]>(
    () => sortedServices.map((service) => toItem(service)),
    [sortedServices, toItem]
  );

  const banner = displayState.reassigningService ? (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
      <HiSwitchHorizontal className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
          {tr("pages.planning.sidebar.reassignment.title", dict)}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
          {displayState.reassigningService.service.service.id}
        </p>
      </div>
    </div>
  ) : undefined;

  return (
    <SidebarShell
      isFormActive={displayState.isFormActive}
      headerTitle={getHeaderTitle()}
      selectedItemId={displayState.selectedService?.id}
      formattedSlot={displayState.formattedSlot}
      slotLabel={tr("pages.planning.sidebar.form.slot", dict)}
      showCloseButton={showCloseButton}
      backLabel={tr("pages.planning.sidebar.form.back", dict)}
      closeLabel={tr("pages.planning.sidebar.form.cancel", dict)}
      onBack={handleBack}
      onClose={handleCancel}
      banner={banner}
      search={
        <PlanningSearchAutocomplete
          dict={dict}
          services={allServices}
          onSelect={handleSearchSelect}
          onMatchTypeSelect={handleMatchTypeSelect}
          onClear={handleSearchClear}
          onQueryChange={setSearchQuery}
          hasActiveFilter={searchTags.length > 0}
          isLoading={isLoadingTasks}
        />
      }
      tags={
        searchTags.length > 0 ? (
          <PlanningSearchTags
            dict={dict}
            tags={searchTags}
            onTagsChange={handleTagsChange}
          />
        ) : undefined
      }
      items={items}
      highlightItemId={displayState.reassigningService?.service.service.id}
      emptyText={tr("pages.planning.sidebar.search.noResults", dict)}
      hintText={
        displayState.reassigningService
          ? tr("pages.planning.sidebar.reassignment.hint", dict)
          : tr("pages.planning.sidebar.selectServiceHint", dict)
      }
      form={
        <PlanningSidebarForm
          dict={dict}
          isActive={true}
          selectedService={
            displayState.selectedService
              ? {
                  ...displayState.selectedService,
                  mintral_clientRut:
                    displayState.selectedService.mintral_clientRut ??
                    allServices.find(
                      (s) => s.id === displayState.selectedService?.id
                    )?.mintral_clientRut,
                  mintral_delegacionOrigen:
                    displayState.selectedService.mintral_delegacionOrigen ??
                    allServices.find(
                      (s) => s.id === displayState.selectedService?.id
                    )?.mintral_delegacionOrigen,
                  slot: displayState.formattedSlot?.full,
                }
              : undefined
          }
          onSubmit={handleSubmit}
          andenesCount={andenesCount}
          slotStartTime={displayState.formattedSlot?.startTime}
          slotEndTime={displayState.formattedSlot?.endTime}
          backendSlots={backendSlots}
          isSlotsLoading={isSlotsLoading}
          liveTaskStage={
            getLiveTask(displayState.selectedService?.mintral_serviceCode)?.stage
          }
        />
      }
    />
  );
}
