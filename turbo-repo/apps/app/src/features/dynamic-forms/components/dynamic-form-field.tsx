"use client";

import { Label, TextInput, Textarea, Checkbox, Button, Dropdown, DropdownItem } from "flowbite-react";
import { useState, useEffect } from "react";
import { HiMinus, HiPlus, HiChevronDown } from "react-icons/hi";
import { DynamicFieldConfig } from "../dynamic-form.types";
import { DisplayField } from "./display-field";

/**
 * Props for DynamicFormField component
 */
export interface DynamicFormFieldProps {
  /** Field configuration */
  readonly field: DynamicFieldConfig;
  /** Current field value */
  readonly value: string | boolean | number;
  /** Change handler */
  readonly onChange: (value: string | boolean | number) => void;
  /** Whether field is visible (based on dependsOn) */
  readonly isVisible: boolean;
  /** Translation function */
  readonly translate: (key: string) => string;
  /** All form values (for live fields that need dependencies) */
  readonly allValues?: Record<string, unknown>;
  /** Custom renderer for live fields */
  readonly liveFieldRenderer?: (
    field: DynamicFieldConfig,
    allValues: Record<string, unknown>
  ) => React.ReactNode;
  /** Custom renderer for display fields */
  readonly displayFieldRenderer?: (
    field: DynamicFieldConfig,
    value: string | boolean | number
  ) => React.ReactNode;
}

/**
 * NumberStepper - Wide stepper with square −/+ buttons and centered input
 * Matches the AndenesManager pattern (Flowbite Button + TextInput).
 */
function NumberStepper({
  field,
  value,
  onChange,
}: {
  field: DynamicFieldConfig;
  value: string | boolean | number;
  onChange: (value: string | boolean | number) => void;
}) {
  const min = field.min ?? 0;
  const max = field.max ?? 99;
  const numValue = typeof value === "number" ? value : (Number.parseInt(String(value)) || min);
  const [inputValue, setInputValue] = useState<string>(String(numValue));

  useEffect(() => {
    setInputValue(String(numValue));
  }, [numValue]);

  const commitInputValue = () => {
    const parsed = Number.parseInt(inputValue, 10);
    if (!Number.isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
      setInputValue(String(parsed));
    } else {
      setInputValue(String(numValue));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="xs"
        color="alternative"
        onClick={() => onChange(Math.max(min, numValue - 1))}
        disabled={numValue <= min}
        className="h-9 w-9 p-0 shrink-0"
      >
        <HiMinus className="h-4 w-4" />
      </Button>
      <TextInput
        id={field.name}
        name={field.name}
        type="number"
        min={min}
        max={max}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commitInputValue();
          }
        }}
        onBlur={commitInputValue}
        className="flex-1 [&_input]:text-center"
        sizing="sm"
      />
      <Button
        size="xs"
        color="alternative"
        onClick={() => onChange(Math.min(max, numValue + 1))}
        disabled={numValue >= max}
        className="h-9 w-9 p-0 shrink-0"
      >
        <HiPlus className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * DynamicFormField - Renders a form field based on configuration
 *
 * Supports: text, select, date, datetime-local, textarea, checkbox, display, live
 *
 * @example
 * ```tsx
 * <DynamicFormField
 *   field={field}
 *   value={formValues[field.name]}
 *   onChange={(value) => setFormValue(field.name, value)}
 *   isVisible={isFieldVisible(field)}
 *   translate={(key) => tr(key, dict)}
 * />
 * ```
 */
export function DynamicFormField({
  field,
  value,
  onChange,
  isVisible,
  translate,
  allValues = {},
  liveFieldRenderer,
  displayFieldRenderer,
}: DynamicFormFieldProps) {
  if (!isVisible) return null;

  const labelText = translate(field.labelKey);

  // Handle live fields - requires custom renderer
  if (field.type === "live") {
    if (!liveFieldRenderer) {
      console.warn(
        `DynamicFormField: No liveFieldRenderer provided for live field "${field.name}"`
      );
      return null;
    }
    return (
      <div className="flex flex-col gap-2">
        <Label>
          {labelText}
          {field.required && <span className="text-red-600 ml-1">*</span>}
        </Label>
        {liveFieldRenderer(field, allValues)}
      </div>
    );
  }

  // Handle display fields
  if (field.type === "display") {
    if (displayFieldRenderer) {
      return (
        <div className="flex flex-col gap-2">
          <Label>{labelText}</Label>
          {displayFieldRenderer(field, value)}
        </div>
      );
    }

    // Special layout for "id" format - inline label and value
    if (field.displayFormat === "id") {
      const displayValue =
        typeof value === "boolean" ? value.toString() : value;
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {labelText}
          </span>
          <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white select-none">
            {displayValue || "--"}
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <Label>{labelText}</Label>
        <DisplayField field={field} value={value} />
      </div>
    );
  }

  const renderField = () => {
    switch (field.type) {
      case "text":
      case "date":
      case "datetime-local":
        return (
          <TextInput
            id={field.name}
            name={field.name}
            type={field.type}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            placeholder={field.placeholder}
            readOnly={field.readonly}
            disabled={field.readonly}
          />
        );

      case "select": {
        const selectedOption = field.options?.find((o) => o.value === (value as string));
        const selectedLabel = selectedOption ? translate(selectedOption.labelKey) : "—";
        return (
          <Dropdown
            label=""
            disabled={field.readonly}
            renderTrigger={() => (
              <button
                type="button"
                disabled={field.readonly}
                className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{selectedLabel}</span>
                <HiChevronDown className="ml-2 h-4 w-4 shrink-0" />
              </button>
            )}
          >
            {field.options?.map((option) => (
              <DropdownItem key={option.value} onClick={() => onChange(option.value)}>
                {translate(option.labelKey)}
              </DropdownItem>
            ))}
          </Dropdown>
        );
      }

      case "textarea":
        return (
          <Textarea
            id={field.name}
            name={field.name}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            rows={4}
            placeholder={field.placeholder}
            readOnly={field.readonly}
            disabled={field.readonly}
          />
        );

      case "number":
        return (
          <NumberStepper
            field={field}
            value={value}
            onChange={onChange}
          />
        );

      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.name}
              name={field.name}
              checked={value as boolean}
              onChange={(e) => onChange(e.target.checked)}
              disabled={field.readonly}
            />
            <Label htmlFor={field.name}>{labelText}</Label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {field.type !== "checkbox" && (
        <Label htmlFor={field.name}>
          {labelText}
          {field.required && <span className="text-red-600 ml-1">*</span>}
        </Label>
      )}
      {renderField()}
    </div>
  );
}

// ============================================
// Legacy export for backward compatibility
// ============================================

/** @deprecated Use DynamicFormField instead */
export const CustomFormField = DynamicFormField;
