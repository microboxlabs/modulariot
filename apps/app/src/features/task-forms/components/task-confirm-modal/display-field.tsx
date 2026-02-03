"use client";

import { Badge } from "flowbite-react";
import { FormFieldConfig } from "./task-confirm-modal.types";

interface DisplayFieldProps {
  field: FormFieldConfig;
  value: string | boolean;
}

export function DisplayField({ field, value }: DisplayFieldProps) {
  const displayValue = typeof value === "boolean" ? value.toString() : value;

  switch (field.displayFormat || "text") {
    case "badge":
      return (
        <Badge color="gray" size="sm" className="inline-flex">
          {displayValue}
        </Badge>
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
      // Custom component would be rendered here if needed
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