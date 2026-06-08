"use client";

import {
  Button,
  Label,
  Dropdown,
  DropdownItem,
  ToggleSwitch,
} from "flowbite-react";
import { HiChevronDown, HiTrash, HiPlus } from "react-icons/hi2";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import type { PresetColor } from "@/features/common/components/advanced-color-picker";
import type { ColorRuleOperator } from "./color-rule-types";
import { COLOR_RULE_OPERATORS, OPERATOR_LABELS } from "./color-rule-types";

// ============================================================================
// Shared constants
// ============================================================================

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export const DEFAULT_COLOR_PRESETS: PresetColor[] = [
  { value: "ef4444", label: "Red" },
  { value: "f97316", label: "Orange" },
  { value: "eab308", label: "Yellow" },
  { value: "22c55e", label: "Green" },
  { value: "3b82f6", label: "Blue" },
  { value: "8b5cf6", label: "Purple" },
  { value: "6b7280", label: "Gray" },
];

// ============================================================================
// ToggleSectionHeader - reusable header with label and toggle
// ============================================================================

interface ToggleSectionHeaderProps {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ToggleSectionHeader({
  label,
  enabled,
  onToggle,
}: Readonly<ToggleSectionHeaderProps>) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-medium">{label}</Label>
      <ToggleSwitch checked={enabled} onChange={onToggle} sizing="sm" />
    </div>
  );
}

// ============================================================================
// AddRuleButton - reusable add button
// ============================================================================

interface AddRuleButtonProps {
  onClick: () => void;
  label: string;
  className?: string;
}

export function AddRuleButton({
  onClick,
  label,
  className = "",
}: Readonly<AddRuleButtonProps>) {
  return (
    <Button
      color="light"
      size="xs"
      onClick={onClick}
      onMouseDown={stopPropagation}
      className={`no-drag w-full ${className}`}
    >
      <HiPlus className="mr-1 h-3 w-3" />
      {label}
    </Button>
  );
}

// ============================================================================
// ColumnDropdown - reusable column selector dropdown
// ============================================================================

export interface ColumnDropdownOption {
  key: string;
  label: string;
  _id?: string;
}

interface ColumnDropdownProps {
  value: string;
  options: ColumnDropdownOption[];
  onChange: (key: string) => void;
  className?: string;
}

export function ColumnDropdown({
  value,
  options,
  onChange,
  className = "min-w-0 flex-1",
}: Readonly<ColumnDropdownProps>) {
  const displayLabel = options.find((c) => c.key === value)?.label || value;

  return (
    <Dropdown
      label=""
      dismissOnClick
      renderTrigger={() => (
        <button
          type="button"
          className={`flex h-7 ${className} cursor-pointer items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-gray-50 px-1.5 text-xs text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600`}
        >
          <span className="truncate">{displayLabel}</span>
          <HiChevronDown className="h-3 w-3 shrink-0" />
        </button>
      )}
    >
      {options.map((col) => (
        <DropdownItem
          key={col._id ?? col.key}
          onClick={() => onChange(col.key)}
          className="text-xs"
        >
          {col.label || col.key}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

// ============================================================================
// Operator Dropdown - extracted for reuse
// ============================================================================

interface OperatorDropdownProps {
  value: ColorRuleOperator;
  onChange: (op: ColorRuleOperator) => void;
  className?: string;
}

export function OperatorDropdown({
  value,
  onChange,
  className = "w-16",
}: Readonly<OperatorDropdownProps>) {
  return (
    <Dropdown
      label=""
      dismissOnClick
      renderTrigger={() => (
        <button
          type="button"
          className={`flex h-7 ${className} shrink-0 cursor-pointer items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-gray-50 px-1.5 text-xs text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600`}
        >
          <span className="truncate">{OPERATOR_LABELS[value]}</span>
          <HiChevronDown className="h-3 w-3 shrink-0" />
        </button>
      )}
    >
      {COLOR_RULE_OPERATORS.map((op) => (
        <DropdownItem key={op} onClick={() => onChange(op)} className="text-xs">
          {OPERATOR_LABELS[op]}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

// ============================================================================
// Value Input - extracted for reuse
// ============================================================================

interface ValueInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ValueInput({
  value,
  onChange,
  placeholder = "Value",
  className = "min-w-0 flex-1",
}: Readonly<ValueInputProps>) {
  return (
    <input
      type="text"
      className={`no-drag h-7 ${className} rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ============================================================================
// Delete Button - extracted for reuse
// ============================================================================

interface DeleteButtonProps {
  onClick: () => void;
  ariaLabel?: string;
}

export function DeleteButton({
  onClick,
  ariaLabel = "Delete rule",
}: Readonly<DeleteButtonProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={stopPropagation}
      className="no-drag flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
      aria-label={ariaLabel}
    >
      <HiTrash className="h-4 w-4" />
    </button>
  );
}

// ============================================================================
// ColorRuleRow - complete row component
// ============================================================================

interface ColorRuleRowProps {
  operator: ColorRuleOperator;
  value: string;
  color: string;
  onOperatorChange: (op: ColorRuleOperator) => void;
  onValueChange: (value: string) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
  valuePlaceholder?: string;
  colorPickerTitle?: string;
  colorPresets?: PresetColor[];
  deleteAriaLabel?: string;
  /** Optional prefix element (e.g., column selector) */
  prefixElement?: React.ReactNode;
  /** Custom value input className */
  valueInputClassName?: string;
}

export function ColorRuleRow({
  operator,
  value,
  color,
  onOperatorChange,
  onValueChange,
  onColorChange,
  onDelete,
  valuePlaceholder = "Value",
  colorPickerTitle = "Select rule color",
  colorPresets = DEFAULT_COLOR_PRESETS,
  deleteAriaLabel = "Delete rule",
  prefixElement,
  valueInputClassName,
}: Readonly<ColorRuleRowProps>) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1.5 dark:border-gray-600 dark:bg-gray-700/50">
      {prefixElement}
      <OperatorDropdown value={operator} onChange={onOperatorChange} />
      <ValueInput
        value={value}
        onChange={onValueChange}
        placeholder={valuePlaceholder}
        className={valueInputClassName}
      />
      <AdvancedColorPicker
        value={color}
        onChange={onColorChange}
        presets={colorPresets}
        title={colorPickerTitle}
      />
      <DeleteButton onClick={onDelete} ariaLabel={deleteAriaLabel} />
    </div>
  );
}
