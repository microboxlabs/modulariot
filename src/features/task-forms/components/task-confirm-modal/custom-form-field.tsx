"use client";

import { Label, TextInput, Select, Textarea, Checkbox } from "flowbite-react";
import { FormFieldConfig } from "./task-confirm-modal.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { LiveFormField } from "./live-form-field";
import { DisplayField } from "./display-field";

type CustomFormFieldProps = {
  field: FormFieldConfig;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  dict: I18nRecord;
  isVisible: boolean;
  allValues?: Record<string, unknown>; // For live fields that need other form values
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

  const labelText = tr(field.labelKey, dict);

  // Handle live fields
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

  // Handle display fields
  if (field.type === "display") {
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
          />
        );

      case "select":
        return (
          <Select
            id={field.name}
            name={field.name}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {tr(option.labelKey, dict)}
              </option>
            ))}
          </Select>
        );

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
