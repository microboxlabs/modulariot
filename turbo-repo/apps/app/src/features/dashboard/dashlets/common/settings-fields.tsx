"use client";

import { useMemo, useState } from "react";
import {
  Label,
  TextInput,
  Textarea,
  Select,
  Tooltip,
  ToggleSwitch,
  Button,
} from "flowbite-react";
import { HiQuestionMarkCircle, HiChevronDown } from "react-icons/hi2";
import Markdown from "react-markdown";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { getHandlebarsStatus, getFlowbiteColor } from "./handlebars-helpers";
import { useHbAutocomplete } from "./use-hb-autocomplete";
import { DropdownList } from "./dropdown-list";

const LABEL_CLS = "text-xs font-normal text-gray-500 dark:text-gray-400";
const LABEL_BLOCK_CLS = `mb-1 block ${LABEL_CLS}`;

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
      <Label
        htmlFor={id}
        className={LABEL_BLOCK_CLS}
      >
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
      <Label
        htmlFor={id}
        className={LABEL_BLOCK_CLS}
      >
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
      <Label
        htmlFor={id}
        className={LABEL_BLOCK_CLS}
      >
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
      <Label
        htmlFor={id}
        className={LABEL_BLOCK_CLS}
      >
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
      <Label className="text-xs font-normal text-gray-500 dark:text-gray-400">
        {label}
      </Label>
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
  /** Sample values keyed by column name, shown next to each suggestion */
  schemaSampleRow?: Record<string, string>;
  filterSuggestions?: string[];
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  dictionary?: I18nRecord;
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
  schemaSampleRow,
  filterSuggestions,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  className,
  dictionary,
}: Readonly<HbAutoInputProps>) {
  const status = useMemo(() => getHandlebarsStatus(value), [value]);

  const namespaces = useMemo(() => {
    const ns = [];
    if (schemaSuggestions?.length) ns.push({ prefix: "row", suggestions: schemaSuggestions });
    if (filterSuggestions?.length) ns.push({ prefix: "filter", suggestions: filterSuggestions });
    return ns;
  }, [schemaSuggestions, filterSuggestions]);

  const ac = useHbAutocomplete({ value, onChange, namespaces });

  return (
    <div ref={ac.containerRef} className={`relative ${className ?? ""}`}>
      <TextInput
        ref={ac.inputRef as React.RefObject<HTMLInputElement>}
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
      <HbAutocompleteDropdown ac={ac} schemaSampleRow={schemaSampleRow} dictionary={dictionary} />
    </div>
  );
}

// Shared autocomplete dropdown — renders namespace groups or suggestion items
function HbAutocompleteDropdown({ ac, schemaSampleRow, dictionary }: Readonly<{
  ac: ReturnType<typeof useHbAutocomplete>;
  schemaSampleRow?: Record<string, string>;
  dictionary?: I18nRecord;
}>) {
  if (!ac.isOpen) return null;
  if (ac.hasNoSuggestions) return <HbNoSuggestionsHint dictionary={dictionary} />;
  return (
    <DropdownList
      items={ac.filtered}
      selectedIndex={ac.selectedIndex}
      onSelect={ac.handleSelect}
      onHover={ac.setSelectedIndex}
      dropdownRef={ac.dropdownRef}
      getKey={(item) => item.kind === "namespace" ? `ns:${item.prefix}` : `${item.prefix}.${item.key}`}
      renderItem={(item) =>
        item.kind === "namespace"
          ? <HbNamespaceItem prefix={item.prefix} count={item.count} />
          : <HbSuggestionItem prefix={item.prefix} col={item.key} sampleValue={item.prefix === "row" ? schemaSampleRow?.[item.key] : undefined} />
      }
    />
  );
}

// Namespace group header — e.g. "{{row.*}}" with count badge
function HbNamespaceItem({ prefix, count }: Readonly<{ prefix: string; count: number }>) {
  return (
    <span className="flex w-full items-center justify-between gap-3">
      <span className="font-mono text-xs">
        {"{{"}
        <span className="font-semibold">{prefix}</span>
        {".*}}"}
      </span>
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        {count}
      </span>
    </span>
  );
}

// Suggestion item — shows {{prefix.col}} with optional sample value on the right
function HbSuggestionItem({ prefix, col, sampleValue }: Readonly<{ prefix: string; col: string; sampleValue?: string }>) {
  return (
    <span className="flex w-full items-center justify-between gap-3">
      <span className="font-mono text-xs">
        {"{{"}
        <span className="text-gray-400 dark:text-gray-500">{prefix}.</span>
        <span className="font-semibold">{col}</span>
        {"}}"}
      </span>
      {sampleValue !== undefined && (
        <span className="max-w-25 truncate text-xs text-gray-400 dark:text-gray-500">
          {sampleValue}
        </span>
      )}
    </span>
  );
}

// Shared empty-state hint shown when {{ is detected but no columns are available
function HbNoSuggestionsHint({ dictionary }: Readonly<{ dictionary?: I18nRecord }>) {
  const prefix = dictionary
    ? trDynamic("dashboard.hbNoSuggestionsPrefix", dictionary)
    : "No data available. In the";
  const label = dictionary
    ? trDynamic("dashboard.dataProvider", dictionary)
    : "Data Provider";
  const suffix = dictionary
    ? trDynamic("dashboard.hbNoSuggestionsSuffix", dictionary)
    : "tab, add a static JSON or configure a pgrest/planner source.";
  return (
    <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {prefix}{" "}
        <span className="font-medium text-gray-500 dark:text-gray-400">{label}</span>{" "}
        {suffix}
      </p>
    </div>
  );
}

// ============================================================================
// HbAutoTextarea — same autocomplete UX as HbAutoInput but for <Textarea>
// ============================================================================

interface HbAutoTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  schemaSuggestions?: string[];
  schemaSampleRow?: Record<string, string>;
  filterSuggestions?: string[];
  id?: string;
  rows?: number;
  "aria-label"?: string;
  dictionary?: I18nRecord;
}

function HbAutoTextarea({
  value,
  onChange,
  placeholder,
  schemaSuggestions,
  schemaSampleRow,
  filterSuggestions,
  id,
  rows = 3,
  "aria-label": ariaLabel,
  dictionary,
}: Readonly<HbAutoTextareaProps>) {
  const status = useMemo(() => getHandlebarsStatus(value), [value]);

  const namespaces = useMemo(() => {
    const ns = [];
    if (schemaSuggestions?.length) ns.push({ prefix: "row", suggestions: schemaSuggestions });
    if (filterSuggestions?.length) ns.push({ prefix: "filter", suggestions: filterSuggestions });
    return ns;
  }, [schemaSuggestions, filterSuggestions]);

  const ac = useHbAutocomplete({ value, onChange, namespaces });

  return (
    <div ref={ac.containerRef} className="relative">
      <Textarea
        ref={ac.inputRef as React.RefObject<HTMLTextAreaElement>}
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={ac.handleChange}
        onClick={ac.handleClick}
        onKeyDown={ac.handleKeyDownCombined}
        placeholder={placeholder}
        rows={rows}
        className="text-xs"
        color={getFlowbiteColor(status)}
        autoComplete="off"
      />
      <HbAutocompleteDropdown ac={ac} schemaSampleRow={schemaSampleRow} dictionary={dictionary} />
    </div>
  );
}

// Stable markdown component overrides for the tooltip — defined outside
// HbTextField so React never treats them as new references on each render.
const MD_P = ({ children }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className="mb-2 last:mb-0">{children}</p>
);
const MD_STRONG = ({ children }: React.HTMLAttributes<HTMLElement>) => (
  <strong className="font-semibold">{children}</strong>
);
const MD_EM = ({ children }: React.HTMLAttributes<HTMLElement>) => (
  <em className="italic opacity-80">{children}</em>
);
const MD_CODE = ({ children }: React.HTMLAttributes<HTMLElement>) => (
  <code className="rounded bg-white/20 px-1 py-0.5 font-mono">{children}</code>
);
const MARKDOWN_COMPONENTS = {
  p: MD_P,
  strong: MD_STRONG,
  em: MD_EM,
  code: MD_CODE,
};

// ============================================================================
// HbTextField — Handlebars-aware TextInput with label
// ============================================================================

interface HbTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  schemaSuggestions?: string[];
  schemaSampleRow?: Record<string, string>;
  filterSuggestions?: string[];
  /** Markdown string shown in a ? tooltip next to the label */
  tooltip?: string;
  dictionary?: I18nRecord;
}

/**
 * Text input that shows Handlebars validation status via Flowbite color.
 * When suggestions are provided, shows a grouped dropdown on `{{` with
 * namespace headers (row, filter) and drills into matching keys on `{{prefix.`.
 */
export function HbTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  schemaSuggestions,
  schemaSampleRow,
  filterSuggestions,
  tooltip,
  dictionary,
}: Readonly<HbTextFieldProps>) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <Label
          htmlFor={id}
          className="text-xs font-normal text-gray-500 dark:text-gray-400"
        >
          {label}
        </Label>
        {tooltip && (
          <Tooltip
            content={
              <div className="max-w-64 text-left text-xs">
                <Markdown components={MARKDOWN_COMPONENTS}>{tooltip}</Markdown>
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
        schemaSampleRow={schemaSampleRow}
        filterSuggestions={filterSuggestions}
        dictionary={dictionary}
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
  /** Render as a multi-line textarea instead of a single-line input */
  multiline?: boolean;
  /** Number of rows when multiline is true */
  rows?: number;
}

interface HbTextFieldListProps {
  fields: readonly HbTextFieldListField[];
  fieldValues: Record<string, string>;
  fieldSetters: Record<string, (v: string) => void>;
  isPgrest: boolean;
  dictionary: I18nRecord;
  schemaSuggestions?: string[];
  schemaSampleRow?: Record<string, string>;
  filterSuggestions?: string[];
}

export function HbTextFieldList({
  fields,
  fieldValues,
  fieldSetters,
  isPgrest,
  dictionary,
  schemaSuggestions,
  schemaSampleRow,
  filterSuggestions,
}: Readonly<HbTextFieldListProps>) {
  return (
    <>
      {fields.map((f) => {
        const placeholder = isPgrest ? f.hbPlaceholder : f.staticPlaceholder;

        return f.multiline ? (
          <HbTextareaField
            key={f.id}
            id={f.id}
            label={trDynamic(f.labelKey, dictionary)}
            value={fieldValues[f.state]}
            onChange={fieldSetters[f.state]}
            placeholder={placeholder}
            rows={f.rows ?? 3}
            schemaSuggestions={schemaSuggestions}
            schemaSampleRow={schemaSampleRow}
            filterSuggestions={filterSuggestions}
            dictionary={dictionary}
          />
        ) : (
          <HbTextField
            key={f.id}
            id={f.id}
            label={trDynamic(f.labelKey, dictionary)}
            value={fieldValues[f.state]}
            onChange={fieldSetters[f.state]}
            placeholder={placeholder}
            schemaSuggestions={schemaSuggestions}
            schemaSampleRow={schemaSampleRow}
            filterSuggestions={filterSuggestions}
            dictionary={dictionary}
          />
        );
      })}
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
  filterSuggestions?: string[];
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
 * Shows grouped autocomplete on `{{` across all available namespaces.
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
  schemaSuggestions?: string[];
  schemaSampleRow?: Record<string, string>;
  filterSuggestions?: string[];
  dictionary?: I18nRecord;
}

/**
 * Textarea that shows Handlebars validation status via Flowbite color.
 * When schemaSuggestions are provided, shows available {{row.<key>}} chips below.
 */
export function HbTextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
  schemaSuggestions,
  schemaSampleRow,
  filterSuggestions,
  dictionary,
}: Readonly<HbTextareaFieldProps>) {
  return (
    <div>
      {label && (
        <Label
          htmlFor={id}
          className={LABEL_BLOCK_CLS}
        >
          {label}
        </Label>
      )}
      <HbAutoTextarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        schemaSuggestions={schemaSuggestions}
        schemaSampleRow={schemaSampleRow}
        filterSuggestions={filterSuggestions}
        dictionary={dictionary}
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
        <HiChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Button>
      {open && <div className="space-y-2 px-3 pb-3 pt-1">{children}</div>}
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
      <Label className="text-xs font-normal text-gray-500 dark:text-gray-400">
        {label}
      </Label>
    </div>
  );
}
