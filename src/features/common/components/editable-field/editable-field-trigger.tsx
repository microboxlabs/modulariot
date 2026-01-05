"use client";

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
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`group flex items-center gap-1 ${!disabled ? "cursor-pointer" : ""} ${className}`}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? undefined : 0}
      role={disabled ? undefined : "button"}
      aria-disabled={disabled}
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="ml-1 p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-opacity duration-200 opacity-0 group-hover:opacity-100"
          aria-label={`Edit ${label || "field"}`}
        >
          <HiPencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
