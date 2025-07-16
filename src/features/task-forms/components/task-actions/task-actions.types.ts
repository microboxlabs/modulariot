import {
  ShippingCoordinatorProcessForms,
  ShippingCoordinatorProcessFormsV2,
} from "../../services/form.service.types";

export type TaskActionsProps = {
  taskId: string;
  taskType: ShippingCoordinatorProcessForms | ShippingCoordinatorProcessFormsV2;
  lang: string;
  fluid?: boolean;
  extraData?: Record<string, any>;
  enableActions?: boolean;
};
