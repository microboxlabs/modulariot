"use client";

import { useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import { HiArrowLeft, HiX } from "react-icons/hi";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  usePlanningSelection,
  type SelectedService,
} from "./planning-selection-context";
import { PlanningSidebarForm } from "./planning-sidebar-form";
import { ServiceEvent } from "./service-event";
import { PlanningSearchAutocomplete } from "./planning-search-autocomplete";
import { PlanningSearchTags } from "./planning-search-tags";

interface PlanningSidebarClientProps {
  dict: I18nDictionary;
}

// Mock services for demonstration - will be replaced with real data from API
const MOCK_SERVICES: SelectedService[] = [
  {
    id: "1045782-v",
    cliente: "Acme Corp",
    origen: "VAP",
    lugarCarguio: "Andén 5",
    destino: "ZOS",
    tipoViaje: "Sider",
    ocupacion: 85,
    permanencia: "24h",
    leadTime: {
      deadline: "2026-02-15",
      status: "on_time",
    },
    eta: "2026-02-16T14:30:00",
    incidencias: ["urgencia", "c4", "c5"],
    observaciones:
      "Presentar documentación antes de las 10:00. Contactar a Juan.",
    prioridad: 1,
  },
  {
    id: "1045782-v",
    cliente: "Acme Corp",
    origen: "SCL",
    lugarCarguio: "Andén 5",
    destino: "VAP",
    tipoViaje: "Sider",
    ocupacion: 85,
    permanencia: "24h",
    leadTime: {
      deadline: "2026-01-15",
      status: "on_time",
    },
    eta: "2026-01-16T14:30:00",
    incidencias: ["urgencia", "c4", "c5"],
    observaciones:
      "Presentar documentación antes de las 10:00. Contactar a Juan.",
    prioridad: 1,
  },
  {
    id: "2038491-v",
    cliente: "Minera Los Andes",
    origen: "SCL",
    lugarCarguio: "Dock 3",
    destino: "VAP",
    tipoViaje: "Doble Sider",
    ocupacion: 60,
    permanencia: "48h",
    leadTime: {
      deadline: "2026-01-14",
      status: "warning",
    },
    eta: "2026-01-15T09:00:00",
    incidencias: ["shutdown"],
    observaciones: "Carga frágil. Requiere supervisión especial.",
    prioridad: 2,
  },
  {
    id: "1049760-v",
    cliente: "Transportes del Norte",
    origen: "SCL",
    lugarCarguio: "Plataforma 1",
    destino: "VAP",
    tipoViaje: "Rampla",
    ocupacion: 100,
    permanencia: "12h",
    leadTime: {
      deadline: "2026-01-13",
      status: "delayed",
    },
    eta: "2026-01-14T18:00:00",
    incidencias: ["urgencia", "shutdown", "c4", "c5", "c7", "c8", "c9"],
    observaciones: "URGENTE: Cliente prioritario. Llamar antes de salir.",
    prioridad: 1,
  },
  {
    id: "4815263-v",
    cliente: "Agrícola Sur",
    origen: "SCL",
    lugarCarguio: "Andén 2",
    destino: "ZOS",
    tipoViaje: "Sider",
    ocupacion: 45,
    permanencia: "8h",
    leadTime: {
      deadline: "2026-01-18",
      status: "on_time",
    },
    eta: "2026-01-18T11:30:00",
    incidencias: ["c4"],
    observaciones: "Productos perecederos. Mantener cadena de frío.",
    prioridad: 3,
  },
];

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
  } = usePlanningSelection();
  const [filteredServiceId, setFilteredServiceId] = useState<string | null>(
    null
  );
  const [filterMatchType, setFilterMatchType] = useState<{
    matchType: "id" | "cliente" | "origen" | "destino" | "lugarCarguio" | "permanencia" | "tipoViaje";
    query: string;
  } | null>(null);
  const [searchTags, setSearchTags] = useState<Array<{ matchType: "id" | "cliente" | "origen" | "destino" | "lugarCarguio" | "permanencia" | "tipoViaje"; value: string }>>([]);

  // Format the selected slot for display
  const formattedSlot = useMemo(() => {
    if (!selectedSlot) return undefined;
    const date = dayjs(selectedSlot.date).locale("es");
    const hour = selectedSlot.hour.toString().padStart(2, "0");
    const minutes = selectedSlot.minutes.toString().padStart(2, "0");
    return `${date.format("dddd D MMM")}, ${hour}:${minutes}`;
  }, [selectedSlot]);

  type MatchType = "id" | "cliente" | "origen" | "destino" | "lugarCarguio" | "permanencia" | "tipoViaje";

  // Helper function to check if service matches a match type
  const matchesService = useCallback((
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
  }, []);

  // Sort services by urgency/status priority:
  // 1. Urgent (red-orange)
  // 2. Delayed (red)
  // 3. Warning (yellow)
  // 4. On time (blue)
  const sortedServices = useMemo(() => {
    const getStatusPriority = (service: SelectedService): number => {
      if (service.incidencias.includes("urgencia")) return 0; // Urgent first
      if (service.leadTime.status === "delayed") return 1;
      if (service.leadTime.status === "warning") return 2;
      return 3; // on_time last
    };

    let services = [...MOCK_SERVICES];

    // Filter by tags if they exist (tags take priority)
    if (searchTags.length > 0) {
      // Filter out invalid tags first
      const validTags = searchTags.filter(
        (tag): tag is { matchType: MatchType; value: string } =>
          tag != null &&
          typeof tag === "object" &&
          "matchType" in tag &&
          "value" in tag &&
          typeof tag.matchType === "string" &&
          typeof tag.value === "string" &&
          tag.value.length > 0
      );

      if (validTags.length > 0) {
        // Group tags by matchType (attribute)
        // Example: { origen: ["SCL", "VAP"], destino: ["ZOS"] }
        const tagsByType = new Map<MatchType, string[]>();
        for (const tag of validTags) {
          if (!tagsByType.has(tag.matchType)) {
            tagsByType.set(tag.matchType, []);
          }
          tagsByType.get(tag.matchType)!.push(tag.value);
        }

        // Filter services with the logic:
        // - OR within same attribute: (origen: SCL OR origen: VAP)
        // - AND between different attributes: (origen group) AND (destino group)
        // Example: (origen: SCL OR origen: VAP) AND (destino: ZOS)
        services = services.filter((service) => {
          // Service must match at least one value from EACH attribute type (AND between attribute types)
          return Array.from(tagsByType.entries()).every(([matchType, values]) => {
            // For each attribute type, service must match ANY of its values (OR within same attribute)
            return values.some((value) => {
              const lowerValue = value.toLowerCase();
              return matchesService(service, matchType, lowerValue);
            });
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

    // Sort by tag order if tags exist
    if (searchTags.length > 0) {
      // Filter out invalid tags (safety check for malformed tag objects)
      const validTags = searchTags.filter(
        (tag): tag is { matchType: MatchType; value: string } =>
          tag != null &&
          typeof tag === "object" &&
          "matchType" in tag &&
          "value" in tag &&
          typeof tag.matchType === "string" &&
          typeof tag.value === "string" &&
          tag.value.length > 0
      );

      if (validTags.length > 0) {
        return services.sort((a, b) => {
          // First sort by tag order priority
          for (const tag of validTags) {
            const lowerValue = tag.value.toLowerCase();
            const aMatches = matchesService(a, tag.matchType, lowerValue);
            const bMatches = matchesService(b, tag.matchType, lowerValue);

            if (aMatches && !bMatches) return -1;
            if (!aMatches && bMatches) return 1;
          }

          // Then by status priority
          return getStatusPriority(a) - getStatusPriority(b);
        });
      }
    }

    return services.sort((a, b) => getStatusPriority(a) - getStatusPriority(b));
  }, [filteredServiceId, filterMatchType, searchTags, matchesService]);

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
    matchType: "id" | "cliente" | "origen" | "destino" | "lugarCarguio" | "permanencia" | "tipoViaje",
    query: string
  ) => {
    // Add tag if not already present (check both matchType and value)
    setSearchTags((prev) => {
      const exists = prev.some(tag => tag.matchType === matchType && tag.value === query);
      if (!exists) {
        return [...prev, { matchType, value: query }];
      }
      return prev;
    });
    setFilterMatchType({ matchType, query });
    setFilteredServiceId(null); // Clear service ID filter
  };

  const handleTagsChange = (tags: Array<{ matchType: "id" | "cliente" | "origen" | "destino" | "lugarCarguio" | "permanencia" | "tipoViaje"; value: string }>) => {
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
              {formattedSlot}
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
              onClick={handleBack}
              className="p-1 -ml-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={tr("pages.planning.sidebar.form.back", dict)}
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
                    slot: formattedSlot,
                  }
                : undefined
            }
            onSubmit={handleSubmit}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {/* Search bar with autocomplete */}
            <PlanningSearchAutocomplete
              dict={dict}
              services={MOCK_SERVICES}
              onSelect={handleSearchSelect}
              onMatchTypeSelect={handleMatchTypeSelect}
              onClear={handleSearchClear}
              hasActiveFilter={searchTags.length > 0}
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
                sortedServices.map((service) => (
                  <ServiceEvent key={service.id} service={service} />
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  {tr("pages.planning.sidebar.search.noResults", dict)}
                </p>
              )}
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
              {tr("pages.planning.sidebar.selectServiceHint", dict)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
