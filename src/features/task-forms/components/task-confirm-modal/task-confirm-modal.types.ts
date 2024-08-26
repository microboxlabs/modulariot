import { TaskOutcome } from "../../services/form.service.types";

export type TaskConfirmModalProps = {
  taskId: string;
  openModal: boolean;
  setOpenModal: (openModal: boolean) => void;
  outcome?: TaskOutcome;
  outcomeLabel?: string;
};
