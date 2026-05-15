import { useState, useEffect, useRef, useCallback } from "react";
import {
  DynamicFormConfig,
  DynamicFieldConfig,
  DynamicFormValues,
} from "../dynamic-form.types";

/**
 * State interface returned by useDynamicFormState hook
 */
export interface DynamicFormState {
  /** Current form values */
  formValues: DynamicFormValues;
  /** Update a single field value */
  setFormValue: (fieldName: string, value: string | boolean | number) => void;
  /** Reset all form values to initial state */
  resetFormValues: () => void;
  /** Check if a field should be visible based on dependsOn config */
  isFieldVisible: (field: DynamicFieldConfig) => boolean;
}

/**
 * Initialize form values from config defaults
 */
function getInitialFormValues(
  config: DynamicFormConfig | undefined
): DynamicFormValues {
  if (!config) return {};

  const values: DynamicFormValues = {};
  config.fields.forEach((field) => {
    if (field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue;
    } else if (field.type === "checkbox") {
      values[field.name] = false;
    } else if (field.type === "number") {
      values[field.name] = field.min ?? 0;
    } else {
      values[field.name] = "";
    }
  });
  return values;
}

/**
 * Hook for managing dynamic form state
 *
 * Handles:
 * - Initializing form values from config defaults
 * - Tracking field visibility based on dependsOn conditions
 * - Resetting form state when isActive transitions from false to true
 *
 * @param isActive - Whether the form is active (e.g., modal open, sidebar visible)
 * @param formConfig - Dynamic form configuration
 * @returns Form state and helper functions
 *
 * @example
 * ```tsx
 * const { formValues, setFormValue, isFieldVisible } = useDynamicFormState(
 *   isModalOpen,
 *   myFormConfig
 * );
 * ```
 */
export function useDynamicFormState(
  isActive: boolean,
  formConfig: DynamicFormConfig | undefined
): DynamicFormState {
  const [formValues, setFormValues] = useState<DynamicFormValues>({});
  const wasActiveRef = useRef(false);

  // Initialize form values only when form becomes active (transitions from inactive to active)
  useEffect(() => {
    if (isActive && !wasActiveRef.current && formConfig) {
      const initialValues = getInitialFormValues(formConfig);
      setFormValues(initialValues);
    }
    wasActiveRef.current = isActive;
  }, [isActive, formConfig]);

  const setFormValue = useCallback(
    (fieldName: string, value: string | boolean | number) => {
      setFormValues((prev) => ({
        ...prev,
        [fieldName]: value,
      }));
    },
    []
  );

  const resetFormValues = useCallback(() => {
    if (formConfig) {
      const initialValues = getInitialFormValues(formConfig);
      setFormValues(initialValues);
    } else {
      setFormValues({});
    }
  }, [formConfig]);

  const isFieldVisible = useCallback(
    (field: DynamicFieldConfig): boolean => {
      if (!field.dependsOn) return true;

      const dependentValue = formValues[field.dependsOn.fieldName];
      return dependentValue === field.dependsOn.value;
    },
    [formValues]
  );

  return {
    formValues,
    setFormValue,
    resetFormValues,
    isFieldVisible,
  };
}

// ============================================
// Legacy export for backward compatibility
// ============================================

