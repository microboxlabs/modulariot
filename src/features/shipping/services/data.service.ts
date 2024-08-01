import { KanbanPageData } from "../types/common.types";
import kanbanBoards from "../model/kanban.json";

export function getData() {
  return { kanbanBoards } as KanbanPageData;
}
