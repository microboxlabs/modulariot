"use client";

import { useRef, useEffect } from "react";
import { Spinner, TextInput, Select } from "flowbite-react";
import { HiPencil, HiCheck, HiX, HiExclamationCircle } from "react-icons/hi";
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
  label,
  icon,
  onUpdate,
  disabled = false,
  options = [],
  placeholder,
  className = "",
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
    disabled,
  });

  // Focus input when entering edit mode
  useEffect(() => {
    if (state === "editing" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state]);

  const renderDisplayMode = () => (
    <div
      className={`group flex items-center gap-1 ${disabled ? "" : "cursor-pointer"}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
        <button
          type="button"
          onClick={startEditing}
          className={`ml-1 p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-opacity duration-200 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
          aria-label={`Edit ${label}`}
        >
          <HiPencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
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

  return (
    <div className={`editable-field ${className}`}>
      {state === "display" && renderDisplayMode()}
      {state === "editing" && renderEditMode()}
      {state === "saving" && renderSavingMode()}
      {state === "error" && renderErrorMode()}
    </div>
  );
}
