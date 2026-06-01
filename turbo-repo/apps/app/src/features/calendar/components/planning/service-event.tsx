"use client";

import { Badge } from "flowbite-react";
import { HiExclamation, HiCheck, HiX, HiMinus } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { usePlanningSelection } from "@microboxlabs/miot-calendar-ui";
import {
  type SelectedService,
  type LeadTimeData,
  getLeadTimeStatus,
} from "./planning-selection-types";
import { categorizeIncidencias } from "./incidencias.types";
import { formatPercent } from "@microboxlabs/miot-calendar-ui";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ServiceCategoryBadge } from "@/features/common/components/service-category-badge/service-category-badge";

// Set Spanish locale for dayjs
dayjs.locale("es");

export interface ServiceEventProps {
  readonly service: SelectedService;
  readonly dict: I18nRecord;
  readonly className?: string;
}

/**
 * Get the icon and styles for lead time based on compliance percentage.
 *  unknown (null) → — Minus (no data — distinct from 0%)
 *  100% → ✓ CheckMark (success)
 *  > 0% and < 100% → ⚠ Warning
 *  0% → ✗ Error
 */
function getLeadTimeStyles(leadTime: LeadTimeData): {
  text: string;
  icon: typeof HiCheck | typeof HiExclamation | typeof HiX | typeof HiMinus;
} {
  const status = getLeadTimeStatus(leadTime);
  switch (status) {
    case "success":
      return {
        text: "text-gray-600 dark:text-gray-400",
        icon: HiCheck,
      };
    case "warning":
      return {
        text: "text-gray-600 dark:text-gray-400",
        icon: HiExclamation,
      };
    case "error":
      return {
        text: "text-yellow-400 dark:text-yellow-300",
        icon: HiX,
      };
    case "unknown":
      return {
        text: "text-gray-400 dark:text-gray-500",
        icon: HiMinus,
      };
  }
}

/**
 * Get occupancy color based on percentage
 */
function getOccupancyColor(percentage: number): string {
  if (percentage >= 100) return "bg-yellow-400 dark:bg-yellow-300";
  return "bg-gray-400";
}

/**
 * A clickable service event card for the calendar grid
 * Displays data following priority order from issue #949:
 * 1. Flags (Urgencia, Shutdown, Incidencias)
 * 2. KPIs (Lead Time, Ocupación)
 * 3. Static (Cliente, Origen → Destino)
 */
export function ServiceEvent({ service, dict, className }: ServiceEventProps) {
  const { selectedService, selectService } =
    usePlanningSelection<SelectedService>();

  const isSelected = selectedService?.id === service.id;
  const leadTimeStyles = getLeadTimeStyles(service.leadTime);

  // Extract incident codes and create code-to-label map for tooltips
  const codeToLabelMap = new Map<string, string>();
  const incidentCodes = service.mintral_incidents
    ? service.mintral_incidents.map((incident) => {
        const rawCode = incident[0];
        const label = incident[1];
        // Remove "mintral_incident_" prefix to get just the code (e.g., "C307")
        const code = rawCode.replace(/^mintral_incident_/i, "");
        codeToLabelMap.set(code, label);
        return code;
      })
    : [];

  // Categorize using the codes - the dictionary will map C307/C309 to their configs
  const { primary, secondary } = categorizeIncidencias(incidentCodes);
  const hasFlags = primary.length > 0 || secondary.length > 0;
  // Always reserve up to INLINE_BUDGET inline slots: primary first, then top up with secondary.
  const INLINE_BUDGET = 2;
  const inlineSecondaryCount = Math.max(
    0,
    Math.min(secondary.length, INLINE_BUDGET - primary.length)
  );
  const inlineSecondary = secondary.slice(0, inlineSecondaryCount);
  const collapsedSecondaryCount = secondary.length - inlineSecondaryCount;

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
        {(hasFlags || service.serviceCategory) && (
          <div className="flex flex-wrap items-center gap-1 pointer-events-auto">
            {/* Service category - shown alongside incidencia flags */}
            <ServiceCategoryBadge
              code={service.serviceCategory}
              variant="soft"
              className="px-2 py-0.5 text-xs cursor-help"
            />

            {/* Primary incidencias - always visible */}
            {primary.map(({ key, config }) => {
              const tooltip =
                codeToLabelMap.get(key) || codeToLabelMap.get(config.label);
              // Use the config color, with special handling for urgencia/C309 (purple with icon)
              if (
                config.color === "purple" ||
                key === "urgencia" ||
                key === "C309"
              ) {
                return (
                  <Badge
                    key={key}
                    className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 cursor-help"
                    color="purple"
                    icon={HiExclamation}
                    size="xs"
                    title={tooltip}
                  >
                    {config.label}
                  </Badge>
                );
              }
              return (
                <Badge
                  key={key}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 cursor-help"
                  color={config.color}
                  size="xs"
                  title={tooltip}
                >
                  {config.label}
                </Badge>
              );
            })}

            {/* Inline secondary incidencias - always visible */}
            {inlineSecondary.map(({ key, config }) => {
              const tooltip =
                codeToLabelMap.get(key) || codeToLabelMap.get(config.label);
              return (
                <Badge
                  key={key}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 cursor-help"
                  color="gray"
                  size="xs"
                  title={tooltip}
                >
                  {config.label}
                </Badge>
              );
            })}

            {/* Collapsed count for remaining secondary incidencias */}
            {collapsedSecondaryCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("pages.planning.sidebar.form.showMore", dict, {
                  count: String(collapsedSecondaryCount),
                })}
              </span>
            )}
          </div>
        )}

        {/* KPIs row */}
        <div className="flex items-center gap-2 text-xs">
          {/* Lead time percentage with status icon */}
          <div className="flex items-center gap-1.5">
            <leadTimeStyles.icon
              className={twMerge("w-3.5 h-3.5", leadTimeStyles.text)}
            />
            <span className={twMerge("font-medium", leadTimeStyles.text)}>
              {service.leadTime.lineasoc_pctn_cumplimiento == null
                ? "—"
                : `${service.leadTime.lineasoc_pctn_cumplimiento}%`}
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
              {formatPercent(service.ocupacion)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
