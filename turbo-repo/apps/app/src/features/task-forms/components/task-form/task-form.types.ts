import {
  HistoricalWorkflow,
  TaskResponse,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nDictionary } from "@/features/i18n/i18n.service.types";
import type { Session } from "next-auth";

export interface ExtendedTaskResponse
  extends Partial<TaskResponse & HistoricalWorkflow> {
  mintral_serviceType: string;
  mintral_serviceKind: string;
  mintral_clientAbbreviation: string;
  mintral_supplierName: string;
  mintral_distance: number;
  mintral_speed: number;
  mintral_originDelegateCode: string;
  mintral_destinationDelegateCode: string;
  mintral_expectedDepartureDate: string;
  mintral_estimatedArrivalDate?: string;
  mintral_truckLicensePlate: string;
  mintral_trailerLicensePlate: string;
  mintral_driver1Name: string;
  mintral_driver1Rut: string;
  mintral_driver1Phone: string;
}

export interface ExtendedTaskViewProps {
  task: ExtendedTaskResponse;
  user: string;
  msg: I18nDictionary;
  lang: string;
  session: Session;
  userGroups: string[];
  active?: boolean;
}
