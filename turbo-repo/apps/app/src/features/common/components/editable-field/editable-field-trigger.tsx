"use client";

import { Button } from "flowbite-react";
import { HiPencil } from "react-icons/hi";
import { EditableFieldTriggerProps } from "./editable-field.types";

/**
 * EditableFieldTrigger - A simple trigger component that displays a pencil icon
 * on hover and opens a modal on click.
 *
 * Uses pure CSS (Tailwind) for hover effects - no complex state management needed.
 */
export default function EditableFieldTrigger({
  label,
  value,
  icon,
  onClick,
  disabled = false,
  className = "",
}: EditableFieldTriggerProps) {
  return (
    <Button
      color="light"
      size="sm"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label ? `Edit ${label}` : "Edit field"}
      className={`group border-0 bg-transparent p-0 shadow-none hover:bg-transparent focus:ring-0 ${className}`}
    >
      {icon && (
        <div className="flex items-center mr-1 text-gray-400">{icon}</div>
      )}
      {label && (
        <span className="text-gray-600 dark:text-gray-400 text-sm font-light">
          {label}:
        </span>
      )}
      <span className="text-gray-800 dark:text-gray-200 text-sm font-normal">
        {value ?? "-"}
      </span>
      {!disabled && (
        <span className="ml-1 p-1 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 rounded transition-opacity duration-200 opacity-0 group-hover:opacity-100 pointer-events-none">
          <HiPencil className="w-3.5 h-3.5" />
        </span>
      )}
    </Button>
  );
}
