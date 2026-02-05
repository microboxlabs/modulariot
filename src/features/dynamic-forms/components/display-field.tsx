"use client";

import { Badge } from "flowbite-react";
import { DynamicFieldConfig, DisplayFormat } from "../dynamic-form.types";

export interface DisplayFieldProps {
  /** Field configuration */
  field: DynamicFieldConfig;
  /** Current value to display */
  value: string | boolean;
  /** Optional custom renderer for complex displays */
  customRenderer?: (
    value: string | boolean,
    format: DisplayFormat
  ) => React.ReactNode;
}

/**
 * DisplayField - Renders a read-only display value with various formats
 *
 * Supports formats: text, badge, datetime, custom
 */
export function DisplayField({
  field,
  value,
  customRenderer,
}: DisplayFieldProps) {
  const displayValue = typeof value === "boolean" ? value.toString() : value;
  const format = field.displayFormat || "text";

  // Use custom renderer if provided
  if (customRenderer) {
    return <>{customRenderer(value, format)}</>;
  }

  switch (format) {
    case "badge":
      return (
        <Badge color="gray" size="sm" className="inline-flex">
          {displayValue}
        </Badge>
      );

    case "id":
      return (
        <span className="inline-flex items-center font-mono text-sm font-semibold text-gray-800 dark:text-gray-200 select-none">
          {displayValue}
        </span>
      );

    case "datetime":
      if (!displayValue) return <span className="text-gray-500">--</span>;
      return (
        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {new Date(displayValue).toLocaleString()}
          </span>
        </div>
      );

    case "custom":
      // Custom format without renderer - just display as text
      return (
        <span className="text-gray-900 dark:text-white font-medium">
          {displayValue}
        </span>
      );

    case "text":
    default:
      return (
        <span className="text-gray-900 dark:text-white font-medium">
          {displayValue || "--"}
        </span>
      );
  }
}
