"use client";

import { Label, TextInput, Textarea } from "flowbite-react";

// ============================================================================
// SettingsTextField
// ============================================================================

interface SettingsTextFieldProps {
  /** Unique ID for the field */
  id: string;
  /** Label text */
  label: string;
  /** Current value */
  value: string;
  /** Change callback */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Reusable text input field for dashlet settings.
 */
export function SettingsTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: Readonly<SettingsTextFieldProps>) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-sm">
        {label}
      </Label>
      <TextInput
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        sizing="sm"
      />
    </div>
  );
}

// ============================================================================
// SettingsNumberField
// ============================================================================

interface SettingsNumberFieldProps {
  /** Unique ID for the field */
  id: string;
  /** Label text */
  label: string;
  /** Current value */
  value: number;
  /** Change callback */
  onChange: (value: number) => void;
  /** Step value for number input */
  step?: string;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
}

/**
 * Reusable number input field for dashlet settings.
 */
export function SettingsNumberField({
  id,
  label,
  value,
  onChange,
  step,
  min,
  max,
}: Readonly<SettingsNumberFieldProps>) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-sm">
        {label}
      </Label>
      <TextInput
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        step={step}
        min={min}
        max={max}
        sizing="sm"
      />
    </div>
  );
}

// ============================================================================
// SettingsTextareaField
// ============================================================================

interface SettingsTextareaFieldProps {
  /** Unique ID for the field */
  id: string;
  /** Label text */
  label: string;
  /** Current value */
  value: string;
  /** Change callback */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Number of rows */
  rows?: number;
}

/**
 * Reusable textarea field for dashlet settings.
 */
export function SettingsTextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: Readonly<SettingsTextareaFieldProps>) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-sm">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="text-sm"
      />
    </div>
  );
}

// ============================================================================
// SettingsFieldGrid
// ============================================================================

interface SettingsFieldGridProps {
  /** Number of columns */
  cols?: 2 | 3;
  /** Children fields */
  children: React.ReactNode;
}

/**
 * Grid layout for multiple fields in a row.
 */
export function SettingsFieldGrid({
  cols = 2,
  children,
}: Readonly<SettingsFieldGridProps>) {
  const colsClass = cols === 2 ? "grid-cols-2" : "grid-cols-3";
  return <div className={`grid ${colsClass} gap-2`}>{children}</div>;
}

// ============================================================================
// SettingsPickerRow
// ============================================================================

interface SettingsPickerRowProps {
  /** Children picker components with labels */
  children: React.ReactNode;
}

/**
 * Horizontal row layout for icon/color picker pairs.
 */
export function SettingsPickerRow({
  children,
}: Readonly<SettingsPickerRowProps>) {
  return <div className="flex items-center gap-4">{children}</div>;
}

// ============================================================================
// SettingsPickerItem
// ============================================================================

interface SettingsPickerItemProps {
  /** Label text */
  label: string;
  /** Picker component (e.g., ColorPickerDropdown, IconPickerDropdown) */
  children: React.ReactNode;
}

/**
 * Single picker item with label for use in SettingsPickerRow.
 */
export function SettingsPickerItem({
  label,
  children,
}: Readonly<SettingsPickerItemProps>) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

// ============================================================================
// SettingsTitleValueUnit - Common composite for stat dashlets
// ============================================================================

interface SettingsTitleValueUnitProps {
  /** Title field state */
  title: string;
  onTitleChange: (value: string) => void;
  /** Value field state */
  value: number;
  onValueChange: (value: number) => void;
  /** Unit field state */
  unit: string;
  onUnitChange: (value: string) => void;
  /** Optional ID prefix for fields */
  idPrefix?: string;
  /** Optional step for value input */
  valueStep?: string;
}

/**
 * Composite component for the common Title + Value/Unit pattern.
 * Used by many stat dashlets (stat_icon, stat_gradient, stat_sparkline, etc.)
 */
export function SettingsTitleValueUnit({
  title,
  onTitleChange,
  value,
  onValueChange,
  unit,
  onUnitChange,
  idPrefix = "",
  valueStep,
}: Readonly<SettingsTitleValueUnitProps>) {
  const prefix = idPrefix ? `${idPrefix}-` : "";
  return (
    <>
      <SettingsTextField
        id={`${prefix}title`}
        label="Title"
        value={title}
        onChange={onTitleChange}
      />
      <SettingsFieldGrid cols={2}>
        <SettingsNumberField
          id={`${prefix}value`}
          label="Value"
          value={value}
          onChange={onValueChange}
          step={valueStep}
        />
        <SettingsTextField
          id={`${prefix}unit`}
          label="Unit"
          value={unit}
          onChange={onUnitChange}
        />
      </SettingsFieldGrid>
    </>
  );
}
