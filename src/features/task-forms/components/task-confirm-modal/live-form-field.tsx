"use client";

import { Badge, Spinner } from "flowbite-react";
import { useLiveETA, formatETA, formatArrivalTime } from "@/features/common/providers/client-api.provider";
import { FormFieldConfig } from "./task-confirm-modal.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface LiveFormFieldProps {
  field: FormFieldConfig;
  allValues: Record<string, any>;
  isVisible: boolean;
  dict: I18nRecord;
}

export function LiveFormField({
  field,
  allValues,
  isVisible,
  dict,
}: LiveFormFieldProps) {
  // For ETA field specifically
  const isETAField = field.liveField?.dataKey === "eta";

  const { eta, isLoading, error } = useLiveETA(
    isETAField && isVisible,
    allValues.prop_mintral_origin,
    allValues.prop_mintral_destination,
    allValues.prop_mintral_etaMode
  );

  if (!isVisible) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Spinner size="sm" color="info" />
        <span className="text-gray-500 dark:text-gray-400 text-sm">
          {tr("modal.calculatingEta", dict) || "Calculating ETA..."}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 text-sm p-2">
        {tr("modal.etaCalculationError", dict) || "Unable to calculate ETA"}
      </div>
    );
  }

  if (!eta && !isLoading) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm p-2">
        {tr("etaNotAvailable", dict) || "ETA not available"}
      </div>
    );
  }

  // Format the display based on configuration
  const formattedValue =
    field.liveField?.displayFormat === "datetime"
      ? formatArrivalTime(eta)
      : formatETA(eta);

  switch (field.liveField?.displayFormat || "text") {
    case "badge":
      return (
        <Badge color="info" size="sm" className="inline-flex">
          {formattedValue}
        </Badge>
      );

    case "datetime":
      return (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {formattedValue}
            </span>
          </div>
          {eta?.distance && (
            <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6">
              {tr("modal.distance", dict) || "Distance"}: {eta.distance} km
            </div>
          )}
        </div>
      );

    default:
      return (
        <span className="text-gray-900 dark:text-white font-medium">
          {formattedValue}
        </span>
      );
  }
}
