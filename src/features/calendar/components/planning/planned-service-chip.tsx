"use client";

import { twMerge } from "tailwind-merge";
import type { PlannedService } from "./planning-selection-context";

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
 */
export function hasUrgenciaIncidencia(service: PlannedService["service"]): boolean {
  return service.incidencias.includes("urgencia");
}

interface PlannedServiceChipProps {
  readonly plannedService: PlannedService;
  readonly isBeingReassigned?: boolean;
  readonly onContextMenu: (e: React.MouseEvent, ps: PlannedService) => void;
  /** Additional size/layout classes to apply */
  readonly className?: string;
}

/**
 * Shared PlannedServiceChip component for calendar views
 * Displays a service ID with urgencia-aware styling
 */
export function PlannedServiceChip({
  plannedService,
  isBeingReassigned = false,
  onContextMenu,
  className,
}: PlannedServiceChipProps) {
  const hasUrgencia = hasUrgenciaIncidencia(plannedService.service);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ContextMenu" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const syntheticEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      } as React.MouseEvent;
      onContextMenu(syntheticEvent, plannedService);
    }
  };

  return (
    <button
      type="button"
      onContextMenu={(e) => onContextMenu(e, plannedService)}
      onKeyDown={handleKeyDown}
      className={twMerge(
        "m-0 border-0 bg-transparent p-0 text-left font-inherit min-w-0",
        "rounded flex items-center justify-start cursor-context-menu",
        "text-xs font-medium truncate px-1 border-l-4",
        getPlannedServiceChipClassName(hasUrgencia),
        isBeingReassigned && "ring-2 ring-amber-500 ring-offset-1 animate-pulse",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
        className
      )}
      title={`${plannedService.service.id} - Clic derecho para opciones`}
    >
      {plannedService.service.id}
    </button>
  );
}
