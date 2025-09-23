import { AlfrescoErrorResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import {
  TaskOutcome,
  TaskOutcomeDelivery,
  TaskOutcomeV2,
} from "../../services/form.service.types";

export type TaskConfirmModalProps = {
  taskId: string;
  openModal: boolean;
  setOpenModal: (openModal: boolean) => void;
  commentsFieldEnabled: boolean;
  outcome?: TaskOutcome | TaskOutcomeV2 | TaskOutcomeDelivery;
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
