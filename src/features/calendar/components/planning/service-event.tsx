"use client";

import { Badge } from "flowbite-react";
import {
  HiExclamation,
  HiLightningBolt,
  HiClock,
  HiCheck,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import {
  usePlanningSelection,
  type SelectedService,
} from "./planning-selection-context";
import { categorizeIncidencias } from "./incidencias.types";

export interface ServiceEventProps {
  service: SelectedService;
  className?: string;
}

/**
 * Get the color classes for lead time status
 */
function getLeadTimeStyles(status: "on_time" | "warning" | "delayed"): {
  text: string;
  icon: typeof HiCheck | typeof HiExclamation | typeof HiClock;
} {
  switch (status) {
    case "on_time":
      return {
        text: "text-gray-600 dark:text-gray-400",
        icon: HiCheck,
      };
    case "warning":
      return {
        text: "text-gray-600 dark:text-gray-400",
        icon: HiExclamation,
      };
    case "delayed":
      return {
        text: "text-yellow-400 dark:text-yellow-300",
        icon: HiClock,
      };
  }
}

/**
 * Format date for compact display
 */
function formatCompactDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

/**
 * Get occupancy color based on percentage
 */
function getOccupancyColor(percentage: number): string {
  if (percentage >= 100) return "bg-yellow-300 dark:bg-yellow-300";
  return "bg-gray-400";
}

/**
 * A clickable service event card for the calendar grid
 * Displays data following priority order from issue #949:
 * 1. Flags (Urgencia, Shutdown, Incidencias)
 * 2. KPIs (Lead Time, Ocupación)
 * 3. Static (Cliente, Origen → Destino)
 */
export function ServiceEvent({ service, className }: ServiceEventProps) {
  const { selectedService, selectService } = usePlanningSelection();

  const isSelected = selectedService?.id === service.id;
  const leadTimeStyles = getLeadTimeStyles(service.leadTime.status);

  // Categorize incidencias
  const { primary, secondary } = categorizeIncidencias(service.incidencias);
  const hasUrgencia = service.incidencias.includes("urgencia");
  const hasFlags = primary.length > 0 || secondary.length > 0;
  // Show secondary directly if no primary and 2 or fewer secondary
  const showSecondaryDirectly = primary.length === 0 && secondary.length <= 2;

  const handleClick = () => {
    selectService(service);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={twMerge(
        "w-full text-left rounded-xl transition-all duration-200 overflow-hidden",
        "border shadow-sm",
        "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
        isSelected
          ? "bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-600 ring-2 ring-primary-500/50"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
        className
      )}
    >
      <div className="p-2 flex flex-col gap-1.5">
        {/* Header: ID + Route + Priority */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
            {service.id}
          </span>
          <span className="text-xs truncate">
            <span className="text-gray-600 dark:text-gray-300">
              {service.origen}
            </span>
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {" "}
              →{" "}
            </span>
            <span className="text-gray-600 dark:text-gray-300">
              {service.destino}
            </span>
          </span>
        </div>

        {/* Client name */}
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {service.cliente}
        </h4>

        {/* Flags row */}
        {hasFlags && (
          <div className="flex flex-wrap items-center gap-1 pointer-events-none">
            {/* Primary incidencias - always visible */}
            {primary.map(({ key, config }) => {
              if (key === "urgencia") {
                return (
                  <Badge
                    key={key}
                    className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5"
                    color="purple"
                    icon={HiExclamation}
                    size="xs"
                  >
                    {config.label}
                  </Badge>
                );
              }
              return (
                <Badge
                  key={key}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5"
                  color="gray"
                  size="xs"
                >
                  {config.label}
                </Badge>
              );
            })}

            {/* Secondary incidencias - shown directly if ≤2 and no primary */}
            {showSecondaryDirectly &&
              secondary.map(({ key, config }) => (
                <Badge
                  key={key}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5"
                  color="gray"
                  size="xs"
                >
                  {config.label}
                </Badge>
              ))}

            {/* Secondary incidencias count - not clickable, only if not showing directly */}
            {!showSecondaryDirectly && secondary.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                (+{secondary.length} más)
              </span>
            )}
          </div>
        )}

        {/* KPIs row */}
        <div className="flex items-center gap-2 text-xs">
          {/* Lead Time */}
          <div className="flex items-center gap-1.5">
            <leadTimeStyles.icon
              className={twMerge("w-3.5 h-3.5", leadTimeStyles.text)}
            />
            <span className={twMerge("font-medium", leadTimeStyles.text)}>
              {formatCompactDate(service.leadTime.deadline)}
            </span>
          </div>

          {/* Divider */}
          <span className="w-px h-3 bg-gray-200 dark:bg-gray-600" />

          {/* Occupancy mini bar */}
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[10px] text-gray-600 dark:text-gray-300 font-medium shrink-0">
              Ocup.
            </span>
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={twMerge(
                  "h-full rounded-full transition-all",
                  getOccupancyColor(service.ocupacion)
                )}
                style={{ width: `${service.ocupacion}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
              {service.ocupacion}%
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
