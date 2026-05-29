"use client";

import { useRef, useEffect } from "react";
import { Button, Spinner, TextInput, Select } from "flowbite-react";
import { HiPencil, HiCheck, HiX, HiExclamationCircle } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { useEditableField } from "./use-editable-field";
import { EditableFieldProps } from "./editable-field.types";

/**
 * EditableField - A generic inline editable field component with pencil icon hover.
 *
 * Inspired by Alfresco's form service architecture, this component provides
 * a seamless inline editing experience for task properties in bento components.
 *
 * Features:
 * - Hover to reveal edit icon (pencil)
 * - Click pencil to enter edit mode
 * - Enter to save, Escape to cancel
 * - Loading and error states
 * - Supports text, date, datetime-local, and select inputs
 */
export default function EditableField({
  taskId,
  fieldName,
  value,
  displayValue,
  type,
  label = "",
  icon,
  onUpdate,
  onSave,
  disabled = false,
  options = [],
  placeholder,
  className = "",
  variant = "form",
  displayClassName,
  inputClassName,
}: EditableFieldProps) {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const {
    state,
    editValue,
    error,
    isHovered,
    startEditing,
    cancelEditing,
    saveValue,
    setEditValue,
    handleMouseEnter,
    handleMouseLeave,
    handleKeyDown,
  } = useEditableField({
    taskId,
    fieldName,
    initialValue: value,
    onUpdate,
    onSave,
    disabled,
  });

  // Focus input when entering edit mode
  useEffect(() => {
    if (state === "editing" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state]);

  const renderDisplayMode = () => (
    <Button
      color="light"
      size="sm"
      onClick={disabled ? undefined : startEditing}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={`Edit ${label}`}
      className="group border-0 bg-transparent p-0 shadow-none hover:bg-transparent focus:ring-0"
    >
      {icon && (
        <div className="flex items-center mr-1 text-gray-400">{icon}</div>
      )}
      <span className="text-gray-600 dark:text-gray-400 text-sm font-light">
        {label}:
      </span>
      <span className="text-gray-800 dark:text-gray-200 text-sm font-normal">
        {displayValue ?? value}
      </span>
      {!disabled && (
        <span
          className={twMerge(
            // Spacing & shape
            "ml-1 p-1 rounded",
            // Colors
            "text-gray-400",
            "group-hover:text-primary-600 dark:group-hover:text-primary-400",
            // Animation
            "transition-opacity duration-200",
            // Interaction
            "pointer-events-none",
            // Visibility
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <HiPencil className="w-3.5 h-3.5" />
        </span>
      )}
    </Button>
  );

  const renderEditMode = () => (
    <div className="flex items-center gap-2">
      {icon && <div className="flex items-center text-gray-400">{icon}</div>}
      <span className="text-gray-600 dark:text-gray-400 text-sm font-light whitespace-nowrap">
        {label}:
      </span>
      <div className="flex items-center gap-1">
        {type === "select" ? (
          <Select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            sizing="sm"
            className="min-w-[150px]"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        ) : (
          <TextInput
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => void saveValue()}
            placeholder={placeholder}
            sizing="sm"
            className="min-w-[180px]"
          />
        )}
        <button
          type="button"
          onClick={() => void saveValue()}
          className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 rounded"
          aria-label="Save"
        >
          <HiCheck className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          aria-label="Cancel"
        >
          <HiX className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderSavingMode = () => (
    <div className="flex items-center gap-2">
      {icon && <div className="flex items-center text-gray-400">{icon}</div>}
      <span className="text-gray-600 dark:text-gray-400 text-sm font-light">
        {label}:
      </span>
      <span className="text-gray-800 dark:text-gray-200 text-sm font-normal">
        {editValue}
      </span>
      <Spinner size="sm" className="ml-1" />
    </div>
  );

  const renderErrorMode = () => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {icon && <div className="flex items-center text-gray-400">{icon}</div>}
        <span className="text-gray-600 dark:text-gray-400 text-sm font-light">
          {label}:
        </span>
        <span className="text-gray-800 dark:text-gray-200 text-sm font-normal">
          {displayValue ?? value}
        </span>
        <button
          type="button"
          onClick={startEditing}
          className="ml-1 p-1 text-red-500 hover:text-red-600 rounded"
          aria-label="Retry"
        >
          <HiExclamationCircle className="w-4 h-4" />
        </button>
      </div>
      {error && <span className="text-xs text-red-500 ml-6">{error}</span>}
    </div>
  );

  if (variant === "inline") {
    if (state === "editing") {
      return (
        <div className={className}>
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => void saveValue()}
            onKeyDown={handleKeyDown}
            className={inputClassName}
          />
        </div>
      );
    }

    if (state === "saving") {
      return (
        <div className={twMerge(className, "flex items-center gap-1")}>
          <span className={displayClassName}>{editValue}</span>
          <Spinner size="xs" />
        </div>
      );
    }

    return (
      <div className={className}>
        <span
          role="button"
          tabIndex={0}
          onClick={disabled ? undefined : startEditing}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") startEditing();
          }}
          className={displayClassName}
        >
          {displayValue ?? value}
        </span>
      </div>
    );
  }

  return (
    <div className={`editable-field ${className}`}>
      {state === "display" && renderDisplayMode()}
      {state === "editing" && renderEditMode()}
      {state === "saving" && renderSavingMode()}
      {state === "error" && renderErrorMode()}
    </div>
  );
}
