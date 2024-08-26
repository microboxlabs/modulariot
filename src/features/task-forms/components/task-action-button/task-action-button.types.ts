import { TaskOutcome } from "../../services/form.service.types";

export type TaskActionButtonProps = {
  label: string;
  taskId: string;
  transitionId: TaskOutcome;
  onClick: () => void;
};
