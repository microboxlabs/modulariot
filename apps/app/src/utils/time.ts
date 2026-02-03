import { KanbanBoardTask } from "@/features/shipping/types/common.types";

export function duration(kanbanBoardTask: KanbanBoardTask) {
  if (kanbanBoardTask.departureDate) {
    if (kanbanBoardTask.arrivalDate) {
      return new Date(
        new Date(kanbanBoardTask.departureDate).getTime() -
          new Date(kanbanBoardTask.arrivalDate).getTime()
      );
    } else if (kanbanBoardTask.estimatedArrivalDate) {
      return new Date(
        new Date(kanbanBoardTask.departureDate).getTime() -
          new Date(kanbanBoardTask.estimatedArrivalDate).getTime()
      );
    }
  }

  return "-";
}
