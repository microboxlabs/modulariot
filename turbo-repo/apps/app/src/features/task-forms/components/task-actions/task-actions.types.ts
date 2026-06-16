import {
  DeliveryProcessForms,
  PlanningProcessForms,
  ShippingCoordinatorProcessFormsV2,
} from "../../services/form.service.types";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

export type TaskActionsProps = {
  taskId: string;
  taskType:
    | ShippingCoordinatorProcessFormsV2
    | DeliveryProcessForms
    | PlanningProcessForms;
  lang: string;
  fluid?: boolean;
  extraData?: Record<string, unknown>;
  enableActions?: boolean;
  fullDict?: I18nDictionary;
};
