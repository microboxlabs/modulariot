import { useState, useEffect, useRef } from "react";
import { CustomFormConfig, FormFieldConfig } from "../task-confirm-modal.types";

export type CustomFormValues = Record<string, string | boolean>;

export interface CustomFormState {
  formValues: CustomFormValues;
  setFormValue: (fieldName: string, value: string | boolean) => void;
  resetFormValues: () => void;
  isFieldVisible: (field: FormFieldConfig) => boolean;
}

function getInitialFormValues(
  config: CustomFormConfig | undefined
): CustomFormValues {
  if (!config) return {};

  const values: CustomFormValues = {};
  config.fields.forEach((field) => {
    if (field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue;
    } else if (field.type === "checkbox") {
      values[field.name] = false;
    } else {
      values[field.name] = "";
    }
  });
  return values;
}

export function useCustomFormState(
  openModal: boolean,
  customFormConfig: CustomFormConfig | undefined
): CustomFormState {
  const [formValues, setFormValues] = useState<CustomFormValues>({});
  const wasOpenRef = useRef(false);

  // Initialize form values only when modal opens (transitions from closed to open)
  useEffect(() => {
    if (openModal && !wasOpenRef.current && customFormConfig) {
      const initialValues = getInitialFormValues(customFormConfig);
      setFormValues(initialValues);
    }
    wasOpenRef.current = openModal;
  }, [openModal, customFormConfig]);

  const setFormValue = (fieldName: string, value: string | boolean) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const resetFormValues = () => {
    setFormValues({});
  };

  const isFieldVisible = (field: FormFieldConfig): boolean => {
    if (!field.dependsOn) return true;

    const dependentValue = formValues[field.dependsOn.fieldName];
    return dependentValue === field.dependsOn.value;
  };

  return {
    formValues,
    setFormValue,
    resetFormValues,
    isFieldVisible,
  };
}
