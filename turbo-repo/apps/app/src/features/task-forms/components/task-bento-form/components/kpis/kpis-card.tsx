"use client";

import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nDictionary } from "@/features/i18n/i18n.service.types";
import {
  type LeadTimeData,
  getLeadTimeStatus,
} from "@/features/common/components/kpi-display";
import { tr } from "@/features/i18n/tr.service";
import { HiCheck, HiX } from "react-icons/hi";

interface KpisCardProps {
  readonly task: TaskResponse;
  readonly dict: I18nDictionary;
}

/**
 * Get lead time compliance metrics from task fields
 */
function getLeadTimeFromTask(task: TaskResponse): LeadTimeData {
  const compliantLines = (task.mintral_compliantOrderLines as number) ?? 0;
  const nonCompliantLines =
    (task.mintral_nonCompliantOrderLines as number) ?? 0;
  const complianceRate = (task.mintral_deliveryComplianceRate as number) ?? 0;

  return {
    total_lineasoc_cumplen: compliantLines,
    total_lineasoc_incumplen: nonCompliantLines,
    lineasoc_pctn_cumplimiento: Math.round(complianceRate * 100),
  };
}

interface CapacityDisplay {
  label: string;
  declared: number;
  total: number;
  unit: string;
  utilization: number;
}

/**
 * Get capacity display data based on load constraint type
 */
function getCapacityDisplay(task: TaskResponse): CapacityDisplay | null {
  const constraint = task.mintral_loadConstraint as string | undefined;
  const maxUtilization =
    100 * ((task.mintral_loadMaxUtilization as number) ?? 0);

  switch (constraint) {
    case "Volumen":
      return {
        label: "Volumen",
        declared: (task.mintral_declaredVolume as number) ?? 0,
        total: (task.mintral_totalVolumeCapacity as number) ?? 0,
        unit: "m³",
        utilization: maxUtilization,
      };

    case "Peso":
      return {
        label: "Peso",
        declared: (task.mintral_declaredWeight as number) ?? 0,
        total: (task.mintral_totalWeightCapacity as number) ?? 0,
        unit: "kg",
        utilization: maxUtilization,
      };

    case "Pallets":
      return {
        label: "Pallets",
        declared: (task.mintral_declaredPalletCount as number) ?? 0,
        total: (task.mintral_totalPalletCapacity as number) ?? 0,
        unit: "pallets",
        utilization: maxUtilization,
      };

    default:
      return null;
  }
}

/**
 * Format number for display (2 decimal places, remove trailing zeros)
 */
function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Get bar color based on percentage
 */
function getBarColor(percentage: number, isError: boolean = false): string {
  if (isError || percentage >= 100) return "bg-yellow-400 dark:bg-yellow-300";
  return "bg-gray-400";
}

const leadTimeStatusColors = {
  success: "text-gray-700 dark:text-gray-300",
  warning: "text-gray-700 dark:text-gray-300",
  error: "text-yellow-500 dark:text-yellow-400",
  unknown: "text-gray-400 dark:text-gray-500",
};

/**
 * A compact KPIs card that displays lead time and occupancy information
 * Both rows share the same grid for alignment
 */
export default function KpisCard({ task, dict }: KpisCardProps) {
  const leadTime = getLeadTimeFromTask(task);
  const capacityDisplay = getCapacityDisplay(task);
  const leadTimeStatus = getLeadTimeStatus(leadTime);
  const totalLines =
    leadTime.total_lineasoc_cumplen + leadTime.total_lineasoc_incumplen;

  return (
    <div className="grid grid-cols-[1fr_5rem_2.5rem_auto] items-center gap-x-2 gap-y-2 p-3">
      {/* Row 1: Lead Time */}
      {/* Column 1: Label with OC count */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-light">
          Lead Time
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          ({tr("pages.planning.sidebar.form.leadTimeLocCount", dict, { count: String(totalLines) })})
        </span>
      </div>
      {/* Column 2: Progress bar — null compliance shows an empty bar (see #238). */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(leadTime.lineasoc_pctn_cumplimiento ?? 0, leadTimeStatus === "error")}`}
          style={{ width: `${leadTime.lineasoc_pctn_cumplimiento ?? 0}%` }}
        />
      </div>
      {/* Column 3: Percentage — render "—" when there's no measured rate. */}
      <span
        className={`text-xs font-medium text-right ${leadTimeStatusColors[leadTimeStatus]}`}
      >
        {leadTime.lineasoc_pctn_cumplimiento == null
          ? "—"
          : `${leadTime.lineasoc_pctn_cumplimiento}%`}
      </span>
      {/* Column 4: Metadata */}
      <span className="text-xs text-gray-500 dark:text-gray-400">
        (<HiCheck className="w-3 h-3 inline" />
        {leadTime.total_lineasoc_cumplen} /{" "}
        <HiX className="w-3 h-3 inline text-yellow-600 dark:text-yellow-400" />
        {leadTime.total_lineasoc_incumplen})
      </span>

      {/* Row 2: Occupancy */}
      {/* Column 1: Label */}
      <span className="text-sm text-gray-500 dark:text-gray-400 font-light">
        {tr("pages.planning.sidebar.form.occupancy", dict)}
      </span>
      {/* Column 2: Progress bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(capacityDisplay?.utilization ?? 0)}`}
          style={{
            width: `${Math.min(100, capacityDisplay?.utilization ?? 0)}%`,
          }}
        />
      </div>
      {/* Column 3: Percentage */}
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-right">
        {Math.round(capacityDisplay?.utilization ?? 0)}%
      </span>
      {/* Column 4: Metadata */}
      {capacityDisplay ? (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          ({capacityDisplay.label}: {formatNumber(capacityDisplay.declared)} /{" "}
          {formatNumber(capacityDisplay.total)} {capacityDisplay.unit})
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}
