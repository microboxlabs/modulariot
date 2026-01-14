"use client";

import { useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import { TextInput } from "flowbite-react";
import { HiArrowLeft, HiSearch, HiX } from "react-icons/hi";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  usePlanningSelection,
  type SelectedService,
} from "./planning-selection-context";
import { PlanningSidebarForm } from "./planning-sidebar-form";
import { ServiceEvent } from "./service-event";

interface PlanningSidebarClientProps {
  dict: I18nDictionary;
}

// Mock services for demonstration - will be replaced with real data from API
const MOCK_SERVICES: SelectedService[] = [
  {
    id: "svc-001",
    cliente: "Acme Corp",
    origen: "Santiago",
    lugarCarguio: "Andén 5",
    destino: "Valparaíso",
    tipoViaje: "Sider",
    ocupacion: 85,
    permanencia: "24h",
    leadTime: {
      deadline: "2026-01-15",
      status: "on_time",
    },
    eta: "2026-01-16T14:30:00",
    urgencia: true,
    shutdown: false,
    incidencias: 2,
    observaciones:
      "Presentar documentación antes de las 10:00. Contactar a Juan.",
    prioridad: 1,
  },
  {
    id: "svc-002",
    cliente: "Minera Los Andes",
    origen: "Concepción",
    lugarCarguio: "Dock 3",
    destino: "Temuco",
    tipoViaje: "Doble Sider",
    ocupacion: 60,
    permanencia: "48h",
    leadTime: {
      deadline: "2026-01-14",
      status: "warning",
    },
    eta: "2026-01-15T09:00:00",
    urgencia: false,
    shutdown: true,
    incidencias: 0,
    observaciones: "Carga frágil. Requiere supervisión especial.",
    prioridad: 2,
  },
  {
    id: "svc-003",
    cliente: "Transportes del Norte",
    origen: "Antofagasta",
    lugarCarguio: "Plataforma 1",
    destino: "Iquique",
    tipoViaje: "Rampla",
    ocupacion: 100,
    permanencia: "12h",
    leadTime: {
      deadline: "2026-01-13",
      status: "delayed",
    },
    eta: "2026-01-14T18:00:00",
    urgencia: true,
    shutdown: true,
    incidencias: 5,
    observaciones: "URGENTE: Cliente prioritario. Llamar antes de salir.",
    prioridad: 1,
  },
  {
    id: "svc-004",
    cliente: "Agrícola Sur",
    origen: "Puerto Montt",
    lugarCarguio: "Andén 2",
    destino: "Osorno",
    tipoViaje: "Sider",
    ocupacion: 45,
    permanencia: "8h",
    leadTime: {
      deadline: "2026-01-18",
      status: "on_time",
    },
    eta: "2026-01-18T11:30:00",
    urgencia: false,
    shutdown: false,
    incidencias: 1,
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
  const { selectedSlot, selectedService, clearService, closeSidebar } =
    usePlanningSelection();

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
      if (service.urgencia) return 0; // Urgent first
      if (service.leadTime.status === "delayed") return 1;
      if (service.leadTime.status === "warning") return 2;
      return 3; // on_time last
    };

    return [...MOCK_SERVICES].sort(
      (a, b) => getStatusPriority(a) - getStatusPriority(b)
    );
  }, []);

  const handleSubmit = (values: Record<string, string | boolean>) => {
    // TODO: Implement actual submission logic
    console.log("Form submitted:", { selectedService, values });
    closeSidebar();
  };

  const handleBack = () => {
    clearService(); // Go back to services list, keep sidebar open
  };

  const handleCancel = () => {
    closeSidebar(); // Close the entire sidebar
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
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
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
            {/* Search bar */}
            <div className="relative">
              <TextInput
                type="text"
                placeholder={tr(
                  "pages.planning.sidebar.searchPlaceholder",
                  dict
                )}
                icon={HiSearch}
                sizing="sm"
              />
            </div>

            {/* Services list */}
            <div className="flex flex-col gap-2">
              {sortedServices.map((service) => (
                <ServiceEvent key={service.id} service={service} />
              ))}
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
