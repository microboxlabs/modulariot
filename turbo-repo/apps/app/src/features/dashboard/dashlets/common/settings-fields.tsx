"use client";

import { useMemo, useState } from "react";
import { Label, TextInput, Textarea, Select, Tooltip, ToggleSwitch, Button } from "flowbite-react";
import { HiQuestionMarkCircle, HiChevronDown } from "react-icons/hi2";
import Markdown from "react-markdown";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { getHandlebarsStatus, getFlowbiteColor } from "./handlebars-helpers";
import { useHbAutocomplete } from "./use-hb-autocomplete";
import { DropdownList } from "./dropdown-list";

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
      <Label htmlFor={id} className="mb-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(e.target.value);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
  };

  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
        {label}
      </Label>
      <TextInput
        id={id}
        type="number"
        value={value}
        onChange={handleChange}
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
      <Label htmlFor={id} className="mb-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="text-xs font-normal text-gray-500 dark:text-gray-400"
      />
    </div>
  );
}

// ============================================================================
// SettingsFieldGrid
// ============================================================================

interface SettingsSelectOption {
  value: string;
  label: string;
}

interface SettingsSelectFieldProps {
  /** Unique ID for the field */
  id: string;
  /** Label text */
  label: string;
  /** Current value */
  value: string;
  /** Change callback */
  onChange: (value: string) => void;
  /** Available options */
  options: SettingsSelectOption[];
}

/**
 * Reusable select field for dashlet settings.
 */
export function SettingsSelectField({
  id,
  label,
  value,
  onChange,
  options,
}: Readonly<SettingsSelectFieldProps>) {
  return (
    <div className="w-full">
      <Label htmlFor={id} className="mb-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
        {label}
      </Label>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sizing="sm"
        className="[&>select]:cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

// ============================================================================
// SettingsFieldGrid (renamed section header)
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
      <Label className="text-xs font-normal text-gray-500 dark:text-gray-400">{label}</Label>
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
  /** Dictionary for i18n */
  dictionary: I18nRecord;
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
  dictionary,
}: Readonly<SettingsTitleValueUnitProps>) {
  const prefix = idPrefix ? `${idPrefix}-` : "";
  return (
    <>
      <SettingsTextField
        id={`${prefix}title`}
        label={tr("common.title", dictionary)}
        value={title}
        onChange={onTitleChange}
      />
      <SettingsFieldGrid cols={2}>
        <SettingsNumberField
          id={`${prefix}value`}
          label={tr("common.value", dictionary)}
          value={value}
          onChange={onValueChange}
          step={valueStep}
        />
        <SettingsTextField
          id={`${prefix}unit`}
          label={tr("common.unit", dictionary)}
          value={unit}
          onChange={onUnitChange}
        />
      </SettingsFieldGrid>
    </>
  );
}

// ============================================================================
// HbAutoInput — Shared Handlebars-aware TextInput with autocomplete dropdown
// ============================================================================

interface HbAutoInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  schemaSuggestions?: string[];
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

/**
 * Core Handlebars-aware TextInput with autocomplete dropdown.
 * Shared by HbTextField (with label) and HbInlineInput (without label).
 */
function HbAutoInput({
  value,
  onChange,
  placeholder,
  schemaSuggestions,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  className,
}: Readonly<HbAutoInputProps>) {
  const status = useMemo(() => getHandlebarsStatus(value), [value]);

  const ac = useHbAutocomplete({
    value,
    onChange,
    prefix: "row",
    suggestions: schemaSuggestions,
  });

  return (
    <div ref={ac.containerRef} className={`relative ${className ?? ""}`}>
      <TextInput
        ref={ac.inputRef}
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        value={value}
        onChange={ac.handleChange}
        onClick={ac.handleClick}
        onKeyDown={ac.handleKeyDownCombined}
        placeholder={placeholder}
        sizing="sm"
        color={getFlowbiteColor(status)}
        autoComplete="off"
      />
      {ac.isOpen && (
        <DropdownList
          items={ac.filtered}
          selectedIndex={ac.selectedIndex}
          onSelect={ac.handleSelect}
          onHover={ac.setSelectedIndex}
          dropdownRef={ac.dropdownRef}
          getKey={(s) => s}
          renderItem={(s) => (
            <span className="font-mono text-xs">
              {"{{row."}
              <span className="font-semibold">{s}</span>
              {"}}"}
            </span>
          )}
        />
      )}
    </div>
  );
}

// Stable markdown component overrides for the tooltip — defined outside
// HbTextField so React never treats them as new references on each render.
const MD_P = ({ children }: React.HTMLAttributes<HTMLParagraphElement>) => <p className="mb-2 last:mb-0">{children}</p>;
const MD_STRONG = ({ children }: React.HTMLAttributes<HTMLElement>) => <strong className="font-semibold">{children}</strong>;
const MD_EM = ({ children }: React.HTMLAttributes<HTMLElement>) => <em className="italic opacity-80">{children}</em>;
const MD_CODE = ({ children }: React.HTMLAttributes<HTMLElement>) => (
  <code className="rounded bg-white/20 px-1 py-0.5 font-mono">{children}</code>
);
const MARKDOWN_COMPONENTS = { p: MD_P, strong: MD_STRONG, em: MD_EM, code: MD_CODE };

// ============================================================================
// HbTextField — Handlebars-aware TextInput with label
// ============================================================================

interface HbTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Column keys for Handlebars autocomplete (e.g. ["total", "status"]) */
  schemaSuggestions?: string[];
  /** Markdown string shown in a ? tooltip next to the label */
  tooltip?: string;
}

/**
 * Text input that shows Handlebars validation status via Flowbite color.
 * When `schemaSuggestions` are provided, shows a dropdown when typing `{{row.`
 * with matching column key suggestions.
 */
export function HbTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  schemaSuggestions,
  tooltip,
}: Readonly<HbTextFieldProps>) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <Label htmlFor={id} className="text-xs font-normal text-gray-500 dark:text-gray-400">
          {label}
        </Label>
        {tooltip && (
          <Tooltip
            content={
              <div className="max-w-64 text-left text-xs">
                <Markdown components={MARKDOWN_COMPONENTS}>
                  {tooltip}
                </Markdown>
              </div>
            }
            placement="top"
          >
            <HiQuestionMarkCircle className="h-3.5 w-3.5 cursor-help text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
          </Tooltip>
        )}
      </div>
      <HbAutoInput
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        schemaSuggestions={schemaSuggestions}
      />
    </div>
  );
}

// ============================================================================
// HbTextFieldList — renders a list of HbTextField from a field config array
// ============================================================================

interface HbTextFieldListField {
  id: string;
  labelKey: string;
  state: string;
  hbPlaceholder: string;
  staticPlaceholder: string;
}

interface HbTextFieldListProps {
  fields: readonly HbTextFieldListField[];
  fieldValues: Record<string, string>;
  fieldSetters: Record<string, (v: string) => void>;
  isPgrest: boolean;
  dictionary: I18nRecord;
  /** Column keys for Handlebars autocomplete in dynamic modes */
  schemaSuggestions?: string[];
}

export function HbTextFieldList({
  fields,
  fieldValues,
  fieldSetters,
  isPgrest,
  dictionary,
  schemaSuggestions,
}: Readonly<HbTextFieldListProps>) {
  return (
    <>
      {fields.map((f) => (
        <HbTextField
          key={f.id}
          id={f.id}
          label={tr(f.labelKey, dictionary)}
          value={fieldValues[f.state]}
          onChange={fieldSetters[f.state]}
          placeholder={isPgrest ? f.hbPlaceholder : f.staticPlaceholder}
          schemaSuggestions={isPgrest ? schemaSuggestions : undefined}
        />
      ))}
    </>
  );
}

// ============================================================================
// HbInlineInput — Compact Handlebars-aware input without label (for lists)
// ============================================================================

interface HbInlineInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Column keys for Handlebars autocomplete */
  schemaSuggestions?: string[];
  /** HTML id for the input element */
  id?: string;
  /** Accessible label for assistive technology (use when no visible label exists) */
  "aria-label"?: string;
  /** ID of the element that labels this input */
  "aria-labelledby"?: string;
}

/**
 * Compact Handlebars-aware TextInput without a label.
 * Designed for use in list rows (e.g. category items, detail rows).
 * Shows autocomplete when typing `{{row.` and color-codes Handlebars syntax.
 */
export function HbInlineInput(props: Readonly<HbInlineInputProps>) {
  return <HbAutoInput {...props} />;
}

// ============================================================================
// HbTextareaField — Handlebars-aware Textarea
// ============================================================================

interface HbTextareaFieldProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

/**
 * Textarea that shows Handlebars validation status via Flowbite color.
 */
export function HbTextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: Readonly<HbTextareaFieldProps>) {
  const status = useMemo(() => getHandlebarsStatus(value), [value]);

  return (
    <div>
      {label && (
        <Label htmlFor={id} className="mb-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
          {label}
        </Label>
      )}
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="text-xs font-normal text-gray-500 dark:text-gray-400"
        color={getFlowbiteColor(status)}
      />
    </div>
  );
}

// ============================================================================
// ExpandableSection — collapsible card for grouping settings
// ============================================================================

interface ExpandableSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/**
 * Collapsible card section for grouping related settings fields.
 * Used by dashlet settings panels to organise options into logical groups.
 */
export function ExpandableSection({
  title,
  children,
  defaultOpen = true,
}: Readonly<ExpandableSectionProps>) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-600">
      <Button
        type="button"
        color="light"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className={`w-full border-0 ring-0 focus:ring-0 flex justify-between ${open ? "rounded-t-lg rounded-b-none" : "rounded-lg"}`}
      >
        {title}
        <HiChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div className="space-y-2 px-3 pb-3 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SettingsToggleRow — label + toggle switch in a single row
// ============================================================================

interface SettingsToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

/**
 * Single-row setting with a text label on the left and a toggle switch on the right.
 * Use for boolean options inside settings panels.
 */
export function SettingsToggleRow({
  label,
  checked,
  onChange,
}: Readonly<SettingsToggleRowProps>) {
  return (
    <div className="flex items-center gap-2">
      <ToggleSwitch checked={checked} onChange={onChange} sizing="sm" />
      <Label className="text-xs font-normal text-gray-500 dark:text-gray-400">{label}</Label>
    </div>
  );
}
