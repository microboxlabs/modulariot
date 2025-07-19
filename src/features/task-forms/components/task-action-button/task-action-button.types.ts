import {
  TaskOutcome,
  TaskOutcomeDelivery,
  TaskOutcomeV2,
} from "../../services/form.service.types";

export type TaskActionButtonProps = {
  label: string;
  taskId: string;
  transitionId: TaskOutcome | TaskOutcomeV2 | TaskOutcomeDelivery;
  fluid?: boolean;
  onClick: () => void;
};
