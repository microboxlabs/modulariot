import { AlfrescoErrorResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import {
  TaskOutcome,
  TaskOutcomeDelivery,
  TaskOutcomePlanning,
  TaskOutcomeV2,
} from "../../services/form.service.types";
import type { DynamicFormConfig } from "@/features/dynamic-forms";
import type { ApprovedItem, RejectedItem } from "../task-bento-form/bento-review-context";

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
  approvedItems?: ApprovedItem[];
  rejectedItems?: RejectedItem[];
  lang?: string;
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

// Re-export form field types from dynamic-forms module for backward compatibility
export type {
  DynamicFieldType,
  DynamicFieldOption,
  DynamicFieldConfig,
  DynamicFormConfig,
} from "@/features/dynamic-forms";

export type TaskFormConfig = {
  selectConfig?: SelectConfig;
  customFormConfig?: DynamicFormConfig;
};

export type TaskFormsConfig = {
  [taskType: string]: {
    [outcome: string]: TaskFormConfig;
  };
};
