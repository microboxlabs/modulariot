"use client";

import { Tooltip } from "flowbite-react";
import { HiExclamation, HiLightningBolt, HiClock } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import {
  usePlanningSelection,
  type SelectedService,
} from "./planning-selection-context";

export interface ServiceEventProps {
  service: SelectedService;
  className?: string;
}

/**
 * Get the color classes for lead time status
 */
function getLeadTimeStyles(status: "on_time" | "warning" | "delayed"): {
  dot: string;
  text: string;
} {
  switch (status) {
    case "on_time":
      return {
        dot: "bg-emerald-500",
        text: "text-emerald-600 dark:text-emerald-400",
      };
    case "warning":
      return {
        dot: "bg-amber-500",
        text: "text-amber-600 dark:text-amber-400",
      };
    case "delayed":
      return { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" };
  }
}

/**
 * Get tooltip text for lead time status
 */
function getLeadTimeTooltip(status: "on_time" | "warning" | "delayed"): string {
  switch (status) {
    case "on_time":
      return "A tiempo";
    case "warning":
      return "En riesgo";
    case "delayed":
      return "Retrasado";
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
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-amber-500";
  return "bg-emerald-500";
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
  const hasFlags =
    service.urgencia || service.shutdown || service.incidencias > 0;

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
      {/* Color accent bar */}
      <div
        className={twMerge(
          "h-1 rounded-t-xl",
          service.urgencia
            ? "bg-gradient-to-r from-red-500 to-orange-500"
            : service.leadTime.status === "delayed"
              ? "bg-gradient-to-r from-red-400 to-red-500"
              : service.leadTime.status === "warning"
                ? "bg-gradient-to-r from-amber-400 to-amber-500"
                : "bg-gradient-to-r from-blue-400 to-blue-500"
        )}
      />

      <div className="p-3 flex flex-col gap-2.5">
        {/* Header: ID + Route + Priority */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
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
          {/* Priority indicator */}
          {service.prioridad === 1 && (
            <span className="shrink-0 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-500/40 flex items-center justify-center">
              <HiLightningBolt className="w-3 h-3 text-purple-600 dark:text-purple-300" />
            </span>
          )}
        </div>

        {/* Client name */}
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate -mt-1">
          {service.cliente}
        </h4>

        {/* Flags row */}
        {hasFlags && (
          <div className="flex flex-wrap items-center gap-1.5">
            {service.urgencia && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <HiExclamation className="w-3 h-3" />
                Urgente
              </span>
            )}
            {service.shutdown && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                Shutdown
              </span>
            )}
            {service.incidencias > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {service.incidencias} incid.
              </span>
            )}
          </div>
        )}

        {/* KPIs row */}
        <div className="flex items-center gap-3 text-xs">
          {/* Lead Time */}
          <Tooltip
            content={
              <span className={leadTimeStyles.text}>
                {getLeadTimeTooltip(service.leadTime.status)}
              </span>
            }
            style="auto"
          >
            <div className="flex items-center gap-1.5">
              <HiClock
                className={twMerge("w-3.5 h-3.5", leadTimeStyles.text)}
              />
              <span className={twMerge("font-medium", leadTimeStyles.text)}>
                {formatCompactDate(service.leadTime.deadline)}
              </span>
            </div>
          </Tooltip>

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
