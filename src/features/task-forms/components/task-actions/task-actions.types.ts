import {
  DeliveryProcessForms,
  PlanningProcessForms,
  ShippingCoordinatorProcessForms,
  ShippingCoordinatorProcessFormsV2,
} from "../../services/form.service.types";

export type TaskActionsProps = {
  taskId: string;
  taskType:
    | ShippingCoordinatorProcessForms
    | ShippingCoordinatorProcessFormsV2
    | DeliveryProcessForms
    | PlanningProcessForms;
  lang: string;
  fluid?: boolean;
  extraData?: Record<string, any>;
  enableActions?: boolean;
};
