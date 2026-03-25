import { KanbanBoardTask } from "../../types/common.types";

export type KanBanCardProps = {
  task: KanbanBoardTask;
  table_name: string;
  compactKanbanView: boolean;
  showFinishedTasks?: boolean;
  isLoading?: boolean;
};
