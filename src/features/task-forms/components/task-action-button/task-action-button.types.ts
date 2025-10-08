import {
  TaskOutcome,
  TaskOutcomeDelivery,
  TaskOutcomePlanning,
  TaskOutcomeV2,
} from "../../services/form.service.types";

export type TaskActionButtonProps = {
  label: string;
  taskId: string;
  transitionId:
    | TaskOutcome
    | TaskOutcomeV2
    | TaskOutcomeDelivery
    | TaskOutcomePlanning;
  fluid?: boolean;
  onClick: () => void;
};
