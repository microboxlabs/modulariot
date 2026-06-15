"use client";

/**
 * LiveFormField for Task Confirm Modal (ETA-specific)
 *
 * This is a task-specific wrapper that uses the generic LiveFormField
 * from dynamic-forms but wires up the ETA hook for live calculations.
 *
 * For a completely generic LiveFormField, import from @/features/dynamic-forms
 */

import { useCallback } from "react";
import {
  LiveFormField as GenericLiveFormField,
  type DynamicFieldConfig,
  type LiveDataHookResult,
} from "@/features/dynamic-forms";
import {
  useLiveETA,
  formatETA,
  formatArrivalTime,
  formatDuration,
} from "@/features/common/providers/client-api.provider";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { Badge } from "flowbite-react";
import { CustomBadge } from "@/features/common/components/custom-badge";

interface ETADetailsRendererProps {
  data: ReturnType<typeof useLiveETA>["eta"];
  dict: I18nRecord;
}

function ETADetailsRenderer({
  data: eta,
  dict,
}: Readonly<ETADetailsRendererProps>) {
  if (!eta) return null;
  return (
    <div className="text-xs text-blue-700 dark:text-blue-300 space-x-1">
      {eta.duration && (
        <CustomBadge text={`${tr("duration", dict)}: ${formatDuration(eta)}`} />
      )}
      {eta.distance && (
        <CustomBadge text={`${tr("distance", dict)}: ${eta.distance.toFixed(2)} km`} />
      )}
    </div>
  );
}

interface ETADetailsRendererWrapperProps {
  data: ReturnType<typeof useLiveETA>["eta"];
  dict: I18nRecord;
}

function ETADetailsRendererWrapper({
  data,
  dict,
}: Readonly<ETADetailsRendererWrapperProps>) {
  return <ETADetailsRenderer data={data} dict={dict} />;
}

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
): LiveDataHookResult<ReturnType<typeof useLiveETA>["eta"]> {
  const result = useLiveETA(
    isActive,
    allValues.mintral_originDelegateCode as string,
    allValues.mintral_destinationDelegateCode as string,
    allValues.mintral_etaMode as string
  );

  const normalizeError = (error: unknown): Error | null => {
    if (!error) return null;
    if (error instanceof Error) return error;
    if (typeof error === "string") return new Error(error);
    if (typeof error === "object") {
      const message =
        "message" in error && typeof error.message === "string"
          ? error.message
          : JSON.stringify(error);
      return new Error(message);
    }
    return new Error(JSON.stringify(error));
  };

  return {
    data: result.eta ?? null,
    isLoading: result.isLoading,
    error: normalizeError(result.error),
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

  const etaCustomRenderer = useCallback(
    (data: unknown) => (
      <ETADetailsRendererWrapper
        data={data as ReturnType<typeof useLiveETA>["eta"]}
        dict={dict}
      />
    ),
    [dict]
  );

  if (!isVisible) return null;

  // Use generic component with ETA-specific value formatter and renderer
  return (
    <GenericLiveFormField
      field={field}
      isVisible={isVisible}
      liveDataResult={hookResult}
      formatData={(data) => {
        const eta = data as ReturnType<typeof useLiveETA>["eta"];
        return field.liveField?.displayFormat === "datetime"
          ? formatArrivalTime(eta)
          : formatETA(eta);
      }}
      loadingMessage={tr("calculatingEta", dict)}
      errorMessage={tr("etaCalculationError", dict)}
      notAvailableMessage={tr("etaNotAvailable", dict)}
      customRenderer={
        field.liveField?.displayFormat === "datetime"
          ? etaCustomRenderer
          : undefined
      }
    />
  );
}
