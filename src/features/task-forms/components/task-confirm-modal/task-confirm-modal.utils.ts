import { SelectConfig } from "./task-confirm-modal.types";

export type CustomFormValues = Record<string, string | boolean>;

export interface FormDataParams {
  taskId: string;
  outcome: string;
  comments: string;
  taskType: string;
  selectedValues: string[];
  selectConfig: SelectConfig | null;
  extraData?: Record<string, any>;
  customFormValues?: CustomFormValues;
}

export function prepareFormData({
  taskId,
  outcome,
  comments,
  taskType,
  selectedValues,
  selectConfig,
  extraData,
  customFormValues,
}: FormDataParams): FormData {
  const formData = new FormData();

  // Basic form data
  formData.append("taskId", taskId);
  formData.append("transitionId", outcome);
  formData.append("comments", comments);
  formData.append("reasonId", taskType);

  // Handle reasons based on select configuration
  if (selectConfig) {
    if (selectConfig.multiSelect) {
      // Multi-select mode: send array of reasons
      const reasonsToSend = getReasonValues(selectedValues, selectConfig);
      formData.append("reasons", JSON.stringify(reasonsToSend));
      formData.append("isMultiReason", "true");
    } else {
      // Single-select mode: send single reason
      const reasonToSend = getSingleReason(selectedValues, selectConfig);
      formData.append("reason", reasonToSend);
    }
  }

  // Add custom form values if provided
  if (customFormValues) {
    Object.entries(customFormValues).forEach(([key, value]) => {
      if (typeof value === "boolean") {
        formData.append(key, value.toString());
      } else {
        formData.append(key, value);
      }
    });
  }

  // Add extra data if provided
  if (extraData) {
    Object.entries(extraData).forEach(([key, value]) => {
      formData.append(key, value as string);
    });
  }

  return formData;
}

function getReasonValues(
  selectedValues: string[],
  selectConfig: SelectConfig
): string[] {
  if (selectedValues.length > 0) {
    return selectedValues;
  }

  const defaultReasons = Array.isArray(selectConfig.defaultValue)
    ? selectConfig.defaultValue
    : [];
  return defaultReasons;
}

function getSingleReason(
  selectedValues: string[],
  selectConfig: SelectConfig
): string {
  if (selectedValues.length > 0) {
    return selectedValues[0];
  }

  return typeof selectConfig.defaultValue === "string"
    ? selectConfig.defaultValue
    : "";
}
