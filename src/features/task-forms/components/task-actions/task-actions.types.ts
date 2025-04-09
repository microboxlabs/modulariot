import { ShippingCoordinatorProcessForms } from "../../services/form.service.types";

export type TaskActionsProps = {
  taskId: string;
  taskType: ShippingCoordinatorProcessForms;
  lang: string;
  fluid?: boolean;
  extraData?: Record<string, any>;
};
