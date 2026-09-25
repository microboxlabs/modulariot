import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { GetEntityInfoResponse } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export type GpsValidationModalProps = {
  openModal: boolean;
  setOpenModal: (openModal: boolean) => void;
  msg?: I18nRecord;
  entityInfo?: GetEntityInfoResponse;
  lang: string;
  task: TaskResponse;
  userGroups: string[];
};

export type MapComponentProps = {
  readonly pointer: { lat: number; lng: number };
  readonly msg?: I18nRecord;
};
