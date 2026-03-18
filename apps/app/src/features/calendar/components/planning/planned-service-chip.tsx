"use client";

import { twMerge } from "tailwind-merge";
import { IoPerson, IoPeople } from "react-icons/io5";
import type { PlannedService } from "./planning-selection-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/**
 * Get the CSS classes for a planned service chip based on urgencia status
 */
export function getPlannedServiceChipClassName(hasUrgencia: boolean): string {
  return hasUrgencia
    ? "bg-purple-100 text-purple-800 border-purple-600 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-400"
    : "bg-blue-100 text-blue-800 border-blue-600 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-400";
}

/**
 * Check if a planned service has urgencia incidencia
 * Checks incidencias array and mintral_incidents for C309/DESPACHO URGENTE
 */
export function hasUrgenciaIncidencia(
  service: PlannedService["service"]
): boolean {
  // Check incidencias array for direct "urgencia" match
  if (service.incidencias.some((inc) => inc.toLowerCase() === "urgencia")) {
    return true;
  }

  // Check mintral_incidents for urgencia codes (C309, DESPACHO URGENTE)
  if (service.mintral_incidents) {
    return service.mintral_incidents.some(([code, label]) => {
      const cleanCode = code.replace(/^mintral_incident_/i, "").toUpperCase();
      return cleanCode === "C309" || label.toUpperCase() === "DESPACHO URGENTE";
    });
  }

  return false;
}

/**
 * Get the number of assigned drivers for a service
 */
export function getDriverCount(service: PlannedService["service"]): 0 | 1 | 2 {
  const hasDriver1 = Boolean(service.assignedDriver);
  const hasDriver2 = Boolean(service.assignedDriver2);
  if (hasDriver1 && hasDriver2) return 2;
  if (hasDriver1 || hasDriver2) return 1;
  return 0;
}

interface PlannedServiceChipProps {
  readonly plannedService: PlannedService;
  readonly isBeingReassigned?: boolean;
  readonly onContextMenu: (e: React.MouseEvent, ps: PlannedService) => void;
  /** Additional size/layout classes to apply */
  readonly className?: string;
  readonly dict: I18nRecord;
}

/**
 * Shared PlannedServiceChip component for calendar views
 * Displays a service ID with urgencia-aware styling and route information
 */
export function PlannedServiceChip({
  plannedService,
  isBeingReassigned = false,
  onContextMenu,
  className,
  dict,
}: PlannedServiceChipProps) {
  const hasUrgencia = hasUrgenciaIncidencia(plannedService.service);
  const driverCount = getDriverCount(plannedService.service);
  const { origen, destino } = plannedService.service;

  return (
    <div
      role="presentation"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, plannedService);
      }}
      className={twMerge(
        "min-w-0 w-full",
        "rounded flex items-center cursor-context-menu",
        "text-xs font-medium px-1.5 py-1 border-l-4",
        getPlannedServiceChipClassName(hasUrgencia),
        isBeingReassigned &&
          "ring-2 ring-amber-500 ring-offset-1 animate-pulse",
        className
      )}
      title={`${plannedService.service.id} - ${tr("pages.planning.sidebar.contextMenu.chipTitle", dict)}`}
    >
      {/* Left: Service ID + Route stacked */}
      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-bold truncate">{plannedService.service.id}</span>
        <div className="flex items-center gap-0.5 text-[10px] font-normal opacity-80 truncate">
          <span className="truncate">{origen}</span>
          <span className="shrink-0">→</span>
          <span className="truncate">{destino}</span>
        </div>
      </div>
      {/* Right: Driver icon centered vertically */}
      {driverCount === 1 && (
        <IoPerson
          className={twMerge(
            "ml-1 shrink-0 w-4 h-4",
            hasUrgencia
              ? "text-purple-700 dark:text-purple-300"
              : "text-blue-700 dark:text-blue-300"
          )}
        />
      )}
      {driverCount === 2 && (
        <IoPeople
          className={twMerge(
            "ml-1 shrink-0 w-4 h-4",
            hasUrgencia
              ? "text-purple-700 dark:text-purple-300"
              : "text-blue-700 dark:text-blue-300"
          )}
        />
      )}
    </div>
  );
}
