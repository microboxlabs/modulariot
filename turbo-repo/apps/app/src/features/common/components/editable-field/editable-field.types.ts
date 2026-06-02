import { ReactNode } from "react";

export type EditableFieldType = "text" | "datetime-local" | "date" | "select";

export type EditableFieldVariant = "form" | "inline";

export type EditableFieldOption = {
  value: string;
  label: string;
};

export type EditableFieldProps = Readonly<{
  /** The task ID this field belongs to (can be empty string when using onSave) */
  taskId: string;
  /** The field name (property key) to update, e.g., "mintral_arrivalDate" */
  fieldName: string;
  /** Current value to display */
  value: string;
  /** Display value (can be different from the actual value, e.g., formatted date) */
  displayValue?: string | ReactNode;
  /** The type of input to show in edit mode */
  type: EditableFieldType;
  /** Label text for the field */
  label?: string;
  /** Optional icon to display before the label */
  icon?: ReactNode;
  /** Callback after successful update */
  onUpdate?: (newValue: string) => void;
  /** Custom save handler — when provided, bypasses the default updateTaskProperties call */
  onSave?: (newValue: string) => Promise<void>;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Options for select type fields */
  options?: EditableFieldOption[];
  /** Placeholder text for the input */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Variant: "form" shows label+pencil, "inline" shows just clickable text */
  variant?: EditableFieldVariant;
  /** Class for the display text when variant="inline" */
  displayClassName?: string;
  /** Class for the input when variant="inline" */
  inputClassName?: string;
}>;

export type EditableFieldState = "display" | "editing" | "saving" | "error";

export type UseEditableFieldReturn = {
  /** Current state of the field */
  state: EditableFieldState;
  /** Current value being edited */
  editValue: string;
  /** Error message if any */
  error: string | null;
  /** Whether the pencil icon is visible (on hover) */
  isHovered: boolean;
  /** Start editing */
  startEditing: () => void;
  /** Cancel editing and revert to original value */
  cancelEditing: () => void;
  /** Save the current value */
  saveValue: () => Promise<void>;
  /** Update the edit value */
  setEditValue: (value: string) => void;
  /** Mouse enter handler */
  handleMouseEnter: () => void;
  /** Mouse leave handler */
  handleMouseLeave: () => void;
  /** Handle key press (Enter to save, Escape to cancel) */
  handleKeyDown: (e: React.KeyboardEvent) => void;
};

export type EditableFieldTriggerProps = Readonly<{
  /** Label text for the field */
  label?: string;
  /** Current value to display */
  value?: string | ReactNode;
  /** Optional icon to display before the label */
  icon?: ReactNode;
  /** Click handler to open modal */
  onClick: () => void;
  /** Whether the trigger is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}>;
