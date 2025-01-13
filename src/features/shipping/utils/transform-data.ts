import { KanbanBoard, KanbanBoardTask } from "../types/common.types";

export function transformBoardsToTableData(
  boards: Record<string, KanbanBoard>,
): KanbanBoardTask[] {
  return Object.values(boards).reduce<KanbanBoardTask[]>((acc, board) => {
    return [...acc, ...board.tasks];
  }, []);
}
