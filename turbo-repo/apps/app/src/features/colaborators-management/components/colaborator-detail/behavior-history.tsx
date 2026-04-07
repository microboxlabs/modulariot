"use client";

import { useState, useMemo } from "react";
import { HiOutlineClock, HiMapPin, HiTruck } from "react-icons/hi2";
import { CustomBadge } from "@/features/common/components/custom-badge";

type EventUrgency = "critical" | "warning" | "info";
type BehaviorCategory = "seguridad" | "uso" | "normativo";
type FilterType = "todos" | "seguridad" | "uso" | "normativo" | "criticos";

interface BehaviorEvent {
  readonly title: string;
  readonly licensePlate: string;
  readonly route: string;
  readonly location: string;
  readonly date: string;
  readonly urgency: EventUrgency;
  readonly category: BehaviorCategory;
}

const urgencyConfig: Record<
  EventUrgency,
  { className: string; label: string; dotColor: string }
> = {
  critical: {
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label: "Crítico",
    dotColor: "bg-red-500 dark:bg-red-400",
  },
  warning: {
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    label: "Alerta",
    dotColor: "bg-yellow-500 dark:bg-yellow-400",
  },
  info: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Info",
    dotColor: "bg-blue-500 dark:bg-blue-400",
  },
};

const categoryLabels: Record<BehaviorCategory, string> = {
  seguridad: "Seguridad",
  uso: "Uso",
  normativo: "Normativo",
};

const categoryBadgeClasses: Record<BehaviorCategory, string> = {
  seguridad:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  uso: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  normativo:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

interface BehaviorTimelineEventProps {
  readonly event: BehaviorEvent;
  readonly isLast: boolean;
}

function BehaviorTimelineEvent({ event, isLast }: BehaviorTimelineEventProps) {
  const urgencyData = urgencyConfig[event.urgency];

  return (
    <div className="relative flex gap-4">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full ${urgencyData.dotColor} ring-4 ring-white dark:ring-gray-800 z-10`}
        />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 ${isLast ? "" : "pb-4 mb-4 border-b border-gray-100 dark:border-gray-700"}`}
      >
        <div className="flex items-start gap-2 mb-1 flex-wrap">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {event.title}
          </h4>
          <CustomBadge
            text={urgencyData.label}
            className={urgencyData.className}
          />
          <CustomBadge
            text={categoryLabels[event.category]}
            className={categoryBadgeClasses[event.category]}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2 flex-wrap">
          <span className="flex items-center gap-1">
            <HiTruck className="w-3.5 h-3.5" />
            {event.licensePlate}
          </span>
          <span>•</span>
          <span>{event.route}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <HiMapPin className="w-3.5 h-3.5" />
            {event.location}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <HiOutlineClock className="w-3.5 h-3.5" />
            {event.date}
          </span>
        </div>
      </div>
    </div>
  );
}

// Mock data for demonstration
const mockEvents: BehaviorEvent[] = [
  {
    title: "Exceso de velocidad moderado detectado (85 km/h en zona 60 km/h)",
    licensePlate: "AB-1234",
    route: "Ruta Santiago - Valparaíso",
    location: "Km 78, Casablanca",
    date: "05/04/2026, 14:32",
    urgency: "warning",
    category: "seguridad",
  },
  {
    title: "Frenada brusca en intersección",
    licensePlate: "AB-1234",
    route: "Ruta Santiago - Valparaíso",
    location: "Km 45, Curacaví",
    date: "05/04/2026, 11:15",
    urgency: "critical",
    category: "seguridad",
  },
  {
    title: "Uso de vehículo fuera de horario laboral",
    licensePlate: "CD-5678",
    route: "Ruta urbana Santiago Centro",
    location: "Av. Libertador Bernardo O'Higgins",
    date: "04/04/2026, 22:45",
    urgency: "warning",
    category: "uso",
  },
  {
    title: "Certificación de manejo defensivo próxima a vencer",
    licensePlate: "—",
    route: "—",
    location: "—",
    date: "03/04/2026, 09:00",
    urgency: "info",
    category: "normativo",
  },
  {
    title: "Exceso de velocidad grave (120 km/h en zona 80 km/h)",
    licensePlate: "AB-1234",
    route: "Autopista del Sol",
    location: "Km 32, Peaje Lo Prado",
    date: "02/04/2026, 16:50",
    urgency: "critical",
    category: "seguridad",
  },
  {
    title: "Desvío de ruta no autorizado",
    licensePlate: "CD-5678",
    route: "Ruta Santiago - Rancagua",
    location: "Salida Buin",
    date: "01/04/2026, 13:20",
    urgency: "warning",
    category: "uso",
  },
  {
    title: "Licencia de conducir renovada exitosamente",
    licensePlate: "—",
    route: "—",
    location: "Municipalidad de Santiago",
    date: "30/03/2026, 10:00",
    urgency: "info",
    category: "normativo",
  },
];

export default function BehaviorHistory() {
  const [filter, setFilter] = useState<FilterType>("todos");

  const filteredEvents = useMemo(() => {
    switch (filter) {
      case "seguridad":
        return mockEvents.filter((e) => e.category === "seguridad");
      case "uso":
        return mockEvents.filter((e) => e.category === "uso");
      case "normativo":
        return mockEvents.filter((e) => e.category === "normativo");
      case "criticos":
        return mockEvents.filter((e) => e.urgency === "critical");
      default:
        return mockEvents;
    }
  }, [filter]);

  const getFilterButtonClass = (filterType: FilterType) => {
    const isActive = filter === filterType;
    return `px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
      isActive
        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
    }`;
  };

  return (
    <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Historial de Comportamiento
        </h3>
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setFilter("todos")}
            className={getFilterButtonClass("todos")}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFilter("seguridad")}
            className={getFilterButtonClass("seguridad")}
          >
            Seguridad
          </button>
          <button
            type="button"
            onClick={() => setFilter("uso")}
            className={getFilterButtonClass("uso")}
          >
            Uso
          </button>
          <button
            type="button"
            onClick={() => setFilter("normativo")}
            className={getFilterButtonClass("normativo")}
          >
            Normativo
          </button>
          <button
            type="button"
            onClick={() => setFilter("criticos")}
            className={getFilterButtonClass("criticos")}
          >
            Críticos
          </button>
        </div>
      </div>

      <div className="max-h-125 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
            No hay eventos para mostrar
          </p>
        ) : (
          filteredEvents.map((event, index) => (
            <BehaviorTimelineEvent
              key={`${event.title}-${event.date}`}
              event={event}
              isLast={index === filteredEvents.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
