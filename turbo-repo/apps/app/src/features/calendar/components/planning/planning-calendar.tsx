"use client";

import { useCallback } from "react";
import { twMerge } from "tailwind-merge";
import {
  PlanningCalendar as CalendarViews,
  type BuildShellPropsArgs,
} from "@microboxlabs/miot-calendar-ui";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { usePlanningGrid } from "./use-planning-grid";
import { buildPlanningGridShellProps } from "./planning-grid-shell";
import {
  getPlannedServiceChipClassName,
  hasUrgenciaIncidencia,
} from "./planned-service-chip";
import type { PlannedService } from "./planning-selection-context";
import type { SelectedService } from "./planning-selection-types";

interface PlanningCalendarProps {
  lang: string;
  dict: I18nDictionary;
}

/**
 * Freight-domain wrapper around the generic package `PlanningCalendar`. Owns the
 * domain glue the package keeps host-side: the planning-grid controller
 * (`usePlanningGrid`), the shell-props builder that binds the domain chip +
 * permission/nav context menu + translated copy (`buildPlanningGridShellProps`),
 * and the month-view day-cell chip. The package switches day/week/month off the
 * `useCalendar()` active view and reads the date from that state too.
 */
export default function PlanningCalendar({
  lang,
  dict,
}: Readonly<PlanningCalendarProps>) {
  const grid = usePlanningGrid({ startHour: 8, endHour: 22 });

  // Bind the view-computed overlay inputs to the domain glue + i18n dict.
  const buildShellProps = (args: BuildShellPropsArgs<SelectedService>) =>
    buildPlanningGridShellProps({ planningGrid: grid, dict, ...args });

  // Month-view day-cell chip — keeps the domain urgency color + service label.
  const renderDayChip = useCallback(
    (ps: PlannedService) => (
      <div
        className={twMerge(
          "rounded px-2 py-1",
          "text-xs font-medium truncate text-left",
          "border-l-4",
          getPlannedServiceChipClassName(hasUrgenciaIncidencia(ps.service))
        )}
        title={ps.service.id}
      >
        {ps.service.id}
      </div>
    ),
    []
  );

  return (
    <CalendarViews<SelectedService>
      lang={lang}
      grid={grid}
      buildShellProps={buildShellProps}
      renderDayChip={renderDayChip}
    />
  );
}
