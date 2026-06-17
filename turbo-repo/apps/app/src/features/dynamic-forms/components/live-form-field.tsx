"use client";

import { ReactNode } from "react";
import { Badge, Spinner } from "flowbite-react";
import { DynamicFieldConfig, DisplayFormat } from "../dynamic-form.types";

/**
 * Props for the live data fetching hook
 */
export interface LiveDataHookResult<T = unknown> {
  /** The fetched data */
  data: T | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
}

export interface LiveFormFieldProps {
  /** Field configuration */
  field: DynamicFieldConfig;
  /** Whether field is visible */
  isVisible: boolean;
  /** Loading message */
  loadingMessage?: string;
  /** Error message */
  errorMessage?: string;
  /** Not available message */
  notAvailableMessage?: string;
  /** Result from live data hook */
  liveDataResult: LiveDataHookResult;
  /** Format the data for display */
  formatData: (data: unknown) => string;
  /** Optional custom renderer for the data */
  customRenderer?: (data: unknown, format: DisplayFormat) => ReactNode;
}

/**
 * LiveFormField - Generic live data field component
 *
 * This component handles the rendering of live data fields.
 * The actual data fetching is done by the parent component using
 * a custom hook appropriate for the data type.
 *
 * @example
 * ```tsx
 * // Parent component handles the hook
 * const etaResult = useLiveETA(isVisible, origin, destination, mode);
 *
 * <LiveFormField
 *   field={field}
 *   isVisible={isFieldVisible(field)}
 *   liveDataResult={etaResult}
 *   formatData={(data) => formatETA(data as ETAResponse)}
 *   loadingMessage={tr("calculatingEta", dict)}
 *   errorMessage={tr("etaCalculationError", dict)}
 * />
 * ```
 */
export function LiveFormField({
  field,
  isVisible,
  loadingMessage = "Loading...",
  errorMessage = "Error loading data",
  notAvailableMessage = "Not available",
  liveDataResult,
  formatData,
  customRenderer,
}: Readonly<LiveFormFieldProps>) {
  const { data, isLoading, error } = liveDataResult;

  if (!isVisible) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Spinner size="sm" color="info" />
        <span className="text-gray-500 dark:text-gray-400 text-sm">
          {loadingMessage}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 text-sm">
        {errorMessage}
      </div>
    );
  }

  if (!data && !isLoading) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm p-2">
        {notAvailableMessage}
      </div>
    );
  }

  const format = field.liveField?.displayFormat || "text";

  // Use custom renderer if provided
  if (customRenderer && data) {
    return <>{customRenderer(data, format)}</>;
  }

  const formattedValue = formatData(data);

  switch (format) {
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
