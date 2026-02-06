"use client";

import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nDictionary } from "@/features/i18n/i18n.service.types";
import {
  LeadTimeDisplay,
  ProgressBar,
  type LeadTimeData,
} from "@/features/common/components/kpi-display";
import { tr } from "@/features/i18n/tr.service";

interface KpisCardProps {
  readonly task: TaskResponse;
  readonly dict: I18nDictionary;
}

/**
 * Calculate lead time compliance metrics from ICU condition
 */
function calculateLeadTimeFromTask(task: TaskResponse): LeadTimeData {
  const icuCondition = (task.mintral_icuCondition as number) ?? 0;
  const totalLines = 4; // Default total lines for calculation

  const compliantLines =
    icuCondition >= 0
      ? Math.min(totalLines, Math.abs(icuCondition) + 2)
      : Math.max(0, totalLines - Math.abs(icuCondition));
  const nonCompliantLines = totalLines - compliantLines;
  const compliancePercentage = Math.round((compliantLines / totalLines) * 100);

  return {
    total_lineasoc_cumplen: compliantLines,
    total_lineasoc_incumplen: nonCompliantLines,
    lineasoc_pctn_cumplimiento: compliancePercentage,
  };
}

/**
 * Calculate occupation percentage based on load constraint type.
 */
function calculateOccupancy(task: TaskResponse): number {
  const constraint = task.mintral_loadConstraint as string | undefined;

  if (!constraint) {
    return 0;
  }

  switch (constraint) {
    case "Volumen":
      return (task.mintral_loadVolumeUtilization as number) ?? 0;
    case "Weight":
      return (task.mintral_loadWeightUtilization as number) ?? 0;
    case "Pallet":
      return (task.mintral_loadPalletUtilization as number) ?? 0;
    default:
      return 0;
  }
}

/**
 * A compact KPIs card that displays lead time and occupancy information
 * in a narrow horizontal row format
 */
export default function KpisCard({ task, dict }: KpisCardProps) {
  const leadTime = calculateLeadTimeFromTask(task);
  const occupancy = calculateOccupancy(task);

  return (
    <div className="flex flex-col gap-2 p-3">
      <LeadTimeDisplay leadTime={leadTime} compact />
      <ProgressBar
        label={tr("pages.planning.sidebar.form.occupancy", dict)}
        value={occupancy}
      />
    </div>
  );
}
