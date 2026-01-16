"use client";

import { useMemo, useState } from "react";
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

interface PlanningSidebarClientProps {
  dict: I18nDictionary;
}

// Mock services for demonstration - will be replaced with real data from API
const MOCK_SERVICES: SelectedService[] = [
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
    origen: "CCP",
    lugarCarguio: "Dock 3",
    destino: "ZCO",
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
    origen: "ANF",
    lugarCarguio: "Plataforma 1",
    destino: "IQQ",
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
    origen: "PMC",
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
  const { selectedSlot, selectedService, clearService, closeSidebar, selectService } =
    usePlanningSelection();
  const [filteredServiceId, setFilteredServiceId] = useState<string | null>(null);

  // Format the selected slot for display
  const formattedSlot = useMemo(() => {
    if (!selectedSlot) return undefined;
    const date = dayjs(selectedSlot.date).locale("es");
    const hour = selectedSlot.hour.toString().padStart(2, "0");
    const minutes = selectedSlot.minutes.toString().padStart(2, "0");
    return `${date.format("dddd D MMM")}, ${hour}:${minutes}`;
  }, [selectedSlot]);

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

    // Filter by selected service ID if search was used
    if (filteredServiceId) {
      services = services.filter((s) => s.id === filteredServiceId);
    }

    return services.sort(
      (a, b) => getStatusPriority(a) - getStatusPriority(b)
    );
  }, [filteredServiceId]);

  const handleSubmit = (values: Record<string, string | boolean>) => {
    // TODO: Implement actual submission logic
    console.log("Form submitted:", { selectedService, values });
    closeSidebar();
  };

  const handleBack = () => {
    clearService(); // Go back to services list, keep sidebar open
    setFilteredServiceId(null); // Clear the filter when going back
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
        <div className="flex items-center gap-2">
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
            onCancel={handleCancel}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {/* Search bar with autocomplete */}
            <PlanningSearchAutocomplete
              dict={dict}
              services={MOCK_SERVICES}
              onSelect={handleSearchSelect}
              onClear={handleSearchClear}
              hasActiveFilter={filteredServiceId !== null}
            />

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
