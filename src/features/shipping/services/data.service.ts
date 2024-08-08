import { KanbanBoard, KanbanBoardTask } from "../types/common.types";
import kanbanBoards from "../model/kanban.json";
import {
  Task,
  TaskResponse,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";

const taskShippingBoardMap: Record<string, string> = {
  "wfship:tripOutsideInitiatedTask": "tripInitiatedOutside",
  "wfship:transportValidationTask": "transportValidation",
  "wfship:missionControlTripInitTask": "missionControlTripInit",
  "wfship:overlordTripInitTask": "overlordTripInit",
  "wfship:sovosDigitalSignature": "sovosDigitalSignature",
};

function toKanbanBoardTask(task: Task): KanbanBoardTask {
  const serviceCode = task.properties.mintral_serviceCode as number;
  const serviceType = task.properties.mintral_serviceType as string;
  const name = `${serviceCode}-${serviceType.toUpperCase()}`;
  const origin = task.properties.mintral_originDelegateCode as string;
  const destination = task.properties.mintral_destinationDelegateCode as string;
  return {
    id: task.id,
    name,
    description: task.description,
    completed: task.state === "COMPLETED",
    daysLeft: 2,
    origin,
    destination,
    members: [],
  };
}

export function getStaticData(): KanbanBoard[] {
  return kanbanBoards as unknown as KanbanBoard[];
}

export function toShippingKanban(
  tasks: TaskResponse,
): Record<string, KanbanBoard> {
  let index: Record<string, KanbanBoard> = {};
  tasks.data.forEach((task) => {
    const boardKey = taskShippingBoardMap[task.name];
    index[boardKey] = index[boardKey] || {
      id: boardKey,
      title: boardKey,
      tasks: [],
    };
    index[boardKey].tasks.push(toKanbanBoardTask(task));
  });

  return index;
}
