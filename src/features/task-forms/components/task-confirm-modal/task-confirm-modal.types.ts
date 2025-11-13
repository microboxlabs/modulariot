import { AlfrescoErrorResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import {
  TaskOutcome,
  TaskOutcomeDelivery,
  TaskOutcomePlanning,
  TaskOutcomeV2,
} from "../../services/form.service.types";

export type TaskConfirmModalProps = {
  taskId: string;
  openModal: boolean;
  setOpenModal: (openModal: boolean) => void;
  commentsFieldEnabled: boolean;
  outcome?:
    | TaskOutcome
    | TaskOutcomeV2
    | TaskOutcomeDelivery
    | TaskOutcomePlanning;
  outcomeLabel?: string;
  taskType?: string;
  extraData?: Record<string, any>;
};

export type ErrorWithAlfrescoError = Error & {
  info: {
    error: AlfrescoErrorResponse;
  };
};

export type AlerceInvolvedObject = {
  numero_servicio?: string;
  respuesta?: string;
};

export type SovosDigitalSignatureOutputReasonType =
  | "FINGERPRINT_DEVICES_TECH_ISSUES"
  | "COMPUTER_TECH_ISSUES"
  | "DRIVER_FINGERPRINT_NOT_RECOGNIZED"
  | "DISPATCHER_NOT_ENROLLED"
  | "DISPATCHER_FINGERPRINT_NOT_RECOGNIZED"
  | "AUTHORIZED_BY_TRANSPORT_OVERLORD"
  | "OTHER";

export type MissionControlTripInitTaskOutputReasonType =
  | "NO_GPS_VALIDATION"
  | "NO_DOCUMENT_CONSOLIDATION"
  | "NO_CLIENT_SYSTEM_VALIDATION"
  | "OTHER";

export type SelectOption = {
  value: string;
  labelKey: string;
  descriptionKey?: string; // Optional: supporting text key for branded multi-select
};

export type SelectConfig = {
  options: SelectOption[];
  defaultValue: string | string[];
  multiSelect?: boolean; // Flag to enable multi-select mode
  triggerText?: string; // Text shown in collapsed multi-select state
};

export type SelectOptionsConfig = {
  [taskType: string]: {
    [outcome: string]: SelectConfig;
  };
};

// Custom form field types
export type FormFieldType =
  | "text"
  | "select"
  | "date"
  | "datetime-local"
  | "textarea"
  | "checkbox"
  | "display"
  | "live";

export type FormFieldOption = {
  value: string;
  labelKey: string;
};

export type FormFieldConfig = {
  name: string; // Property name to send to backend (e.g., "prop_mintral_estimatedArrivalDate")
  labelKey: string; // i18n key for the label
  type: FormFieldType;
  required?: boolean;
  defaultValue?: string | boolean;
  options?: FormFieldOption[]; // For select fields
  dependsOn?: {
    fieldName: string; // Name of the field this depends on
    value: string | boolean; // Value that makes this field visible
  };
  placeholder?: string;
  readonly?: boolean; // Makes any field read-only
  displayFormat?: "text" | "badge" | "datetime" | "custom"; // Display format for display/live fields
  liveField?: {
    dataKey: string; // Key to identify what data to fetch
    displayFormat?: "text" | "badge" | "datetime";
    dependencies?: string[]; // Fields that affect this value
  };
  customComponent?: string; // Name of custom component to use
};

export type CustomFormConfig = {
  fields: FormFieldConfig[];
};

export type TaskFormConfig = {
  selectConfig?: SelectConfig;
  customFormConfig?: CustomFormConfig;
};

export type TaskFormsConfig = {
  [taskType: string]: {
    [outcome: string]: TaskFormConfig;
  };
};
