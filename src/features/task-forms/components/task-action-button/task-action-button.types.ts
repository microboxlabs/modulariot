import { TaskOutcome, TaskOutcomeV2 } from "../../services/form.service.types";

export type TaskActionButtonProps = {
  label: string;
  taskId: string;
  transitionId: TaskOutcome | TaskOutcomeV2;
  fluid?: boolean;
  onClick: () => void;
};
