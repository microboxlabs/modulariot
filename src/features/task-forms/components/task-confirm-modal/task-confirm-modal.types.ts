import { AlfrescoErrorResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { TaskOutcome } from "../../services/form.service.types";

export type TaskConfirmModalProps = {
  taskId: string;
  openModal: boolean;
  setOpenModal: (openModal: boolean) => void;
  outcome?: TaskOutcome;
  outcomeLabel?: string;
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
