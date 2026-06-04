"use client";

/**
 * @deprecated This file is kept for backward compatibility.
 * Import from @/features/dynamic-forms instead.
 *
 * This wrapper maintains the original API but uses the new DynamicFormField internally,
 * adding task-specific live field handling for ETA.
 */

import { Label } from "flowbite-react";
import {
  DynamicFormField,
  type DynamicFieldConfig,
} from "@/features/dynamic-forms";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import { LiveFormField } from "./live-form-field";
import { DisplayField } from "./display-field";

type CustomFormFieldProps = {
  field: DynamicFieldConfig;
  value: string | boolean | number;
  onChange: (value: string | boolean | number) => void;
  dict: I18nRecord;
  isVisible: boolean;
  allValues?: Record<string, unknown>;
};

export function CustomFormField({
  field,
  value,
  onChange,
  dict,
  isVisible,
  allValues = {},
}: CustomFormFieldProps) {
  if (!isVisible) return null;

  const labelText = trDynamic(field.labelKey, dict);

  // Handle live fields - task-specific with ETA logic
  if (field.type === "live") {
    return (
      <div className="flex flex-col gap-2">
        <Label>
          {labelText}
          {field.required && <span className="text-red-600 ml-1">*</span>}
        </Label>
        <LiveFormField
          field={field}
          allValues={allValues}
          isVisible={isVisible}
          dict={dict}
        />
      </div>
    );
  }

  // Handle display fields - keep original for compatibility
  if (field.type === "display") {
    return (
      <div className="flex flex-col gap-2">
        <Label>{labelText}</Label>
        <DisplayField field={field} value={value} />
      </div>
    );
  }

  // Use the new DynamicFormField for all other types
  return (
    <DynamicFormField
      field={field}
      value={value}
      onChange={onChange}
      isVisible={isVisible}
      translate={(key) => trDynamic(key, dict)}
      allValues={allValues}
    />
  );
}
