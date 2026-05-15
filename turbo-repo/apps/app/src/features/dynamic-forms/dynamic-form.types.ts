/**
 * Dynamic Forms - Type Definitions
 *
 * Configuration-driven form field system that can be used across
 * different parts of the application (task modals, sidebars, etc.)
 */

/**
 * Supported field types for dynamic forms
 */
export type DynamicFieldType =
  | "text"
  | "number"
  | "select"
  | "date"
  | "datetime-local"
  | "textarea"
  | "checkbox"
  | "display" // Read-only display field
  | "live"; // Field that fetches live data

/**
 * Option for select fields
 */
export type DynamicFieldOption = {
  value: string;
  labelKey: string;
};

/**
 * Display format options for display/live fields
 */
export type DisplayFormat = "text" | "badge" | "id" | "datetime" | "custom";

/**
 * Configuration for live data fields
 */
export type LiveFieldConfig = {
  /** Key to identify what data to fetch */
  dataKey: string;
  /** Display format for the fetched value */
  displayFormat?: DisplayFormat;
  /** Names of other fields that affect this value (triggers refetch) */
  dependencies?: string[];
};

/**
 * Conditional visibility configuration
 */
export type FieldDependency = {
  /** Name of the field this depends on */
  fieldName: string;
  /** Value that makes this field visible */
  value: string | boolean;
};

/**
 * Configuration for a single dynamic form field
 */
export type DynamicFieldConfig = {
  /** Property name for form data / backend submission */
  name: string;
  /** i18n key for the field label */
  labelKey: string;
  /** Field type */
  type: DynamicFieldType;
  /** Whether field is required */
  required?: boolean;
  /** Default value */
  defaultValue?: string | boolean | number;
  /** Minimum value for number fields */
  min?: number;
  /** Maximum value for number fields */
  max?: number;
  /** Options for select fields */
  options?: DynamicFieldOption[];
  /** Conditional visibility based on another field's value */
  dependsOn?: FieldDependency;
  /** Placeholder text */
  placeholder?: string;
  /** Makes any field read-only */
  readonly?: boolean;
  /** Display format for display/live fields */
  displayFormat?: DisplayFormat;
  /** Configuration for live data fields */
  liveField?: LiveFieldConfig;
  /** Name of custom component to use for rendering */
  customComponent?: string;
  /** Name of another field to use as default value */
  useCalculatedValueFrom?: string;
};

/**
 * Configuration for a dynamic form
 */
export type DynamicFormConfig = {
  /** Array of field configurations */
  fields: DynamicFieldConfig[];
};

/**
 * Form values record type
 */
export type DynamicFormValues = Record<string, string | boolean | number>;

