import { AlfrescoErrorResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { TaskOutcome } from "../../services/form.service.types";

export type TaskConfirmModalProps = {
  taskId: string;
  openModal: boolean;
  setOpenModal: (openModal: boolean) => void;
  commentsFieldEnabled: boolean;
  outcome?: TaskOutcome;
  outcomeLabel?: string;
  taskType?: string;
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
