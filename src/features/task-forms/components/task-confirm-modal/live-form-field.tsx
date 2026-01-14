"use client";

/**
 * LiveFormField for Task Confirm Modal (ETA-specific)
 *
 * This is a task-specific wrapper that uses the generic LiveFormField
 * from dynamic-forms but wires up the ETA hook for live calculations.
 *
 * For a completely generic LiveFormField, import from @/features/dynamic-forms
 */

import {
  LiveFormField as GenericLiveFormField,
  type DynamicFieldConfig,
} from "@/features/dynamic-forms";
import {
  useLiveETA,
  formatETA,
  formatArrivalTime,
  formatDuration,
} from "@/features/common/providers/client-api.provider";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface LiveFormFieldProps {
  field: DynamicFieldConfig;
  allValues: Record<string, unknown>;
  isVisible: boolean;
  dict: I18nRecord;
}

/**
 * Hook wrapper that adapts useLiveETA to the generic LiveDataHookResult interface
 */
function useETAData(
  isActive: boolean,
  allValues: Record<string, unknown>
): {
  data: typeof eta;
  isLoading: boolean;
  error: unknown;
} & { eta: ReturnType<typeof useLiveETA>["eta"] } {
  const result = useLiveETA(
    isActive,
    allValues.mintral_originDelegateCode as string,
    allValues.mintral_destinationDelegateCode as string,
    allValues.mintral_etaMode as string
  );

  return {
    data: result.eta,
    isLoading: result.isLoading,
    error: result.error,
    eta: result.eta,
  };
}

export function LiveFormField({
  field,
  allValues,
  isVisible,
  dict,
}: LiveFormFieldProps) {
  const isETAField = field.liveField?.dataKey === "eta";
  const hookResult = useETAData(isETAField && isVisible, allValues);

  if (!isVisible) return null;

  // Use generic component with ETA-specific value formatter and renderer
  return (
    <GenericLiveFormField
      field={field}
      dataHookResult={hookResult}
      formatValue={(data) => {
        const eta = data as ReturnType<typeof useLiveETA>["eta"];
        return field.liveField?.displayFormat === "datetime"
          ? formatArrivalTime(eta)
          : formatETA(eta);
      }}
      loadingText={tr("calculatingEta", dict)}
      errorText={tr("etaCalculationError", dict)}
      emptyText={tr("etaNotAvailable", dict)}
      detailRenderer={
        field.liveField?.displayFormat === "datetime"
          ? (data) => {
              const eta = data as ReturnType<typeof useLiveETA>["eta"];
              if (!eta) return null;
              return (
                <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6 space-y-0.5">
                  {eta.duration && (
                    <div>
                      {tr("duration", dict)}: {formatDuration(eta)}
                    </div>
                  )}
                  {eta.distance && (
                    <div>
                      {tr("distance", dict)}: {eta.distance.toFixed(2)} km
                    </div>
                  )}
                </div>
              );
            }
          : undefined
      }
    />
  );
}
