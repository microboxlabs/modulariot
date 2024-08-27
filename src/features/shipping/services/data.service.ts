import { KanbanBoard, KanbanBoardTask } from "../types/common.types";
import kanbanBoards from "../model/kanban.json";
import { FastTasksResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";

const taskShippingBoardMap: Record<string, string> = {
  "wfship:tripOutsideInitiatedTask": "tripInitiatedOutside",
  "wfship:transportValidationTask": "transportValidation",
  "wfship:missionControlTripInitTask": "missionControlTripInit",
  "wfship:overlordTripInitTask": "overlordTripInit",
  "wfship:sovosDigitalSignature": "sovosDigitalSignature",
};

function toKanbanBoardTask(task: Record<string, unknown>): KanbanBoardTask {
  const serviceCode = task.mintral_serviceCode as number;
  const serviceType = task.mintral_serviceType as string;
  const name = `${serviceCode}-${serviceType.toUpperCase()}`;
  const origin = task.mintral_originDelegateCode as string;
  const destination = task.mintral_destinationDelegateCode as string;
  const clientCode = task.mintral_customerCode as string;
  const client = task.mintral_clientAbbreviation as string;
  const expectedDepartureDate = task.mintral_expectedDepartureDate as string;
  return {
    id: task.id as string,
    name,
    description: task.bpm_description as string,
    completed: task.state === "COMPLETED",
    daysLeft: 2,
    origin,
    destination,
    clientCode,
    client,
    expectedDepartureDate,
    serviceKind: task.mintral_serviceKind as string,
    members: [],
  };
}

export function getStaticData(): KanbanBoard[] {
  return kanbanBoards as unknown as KanbanBoard[];
}

export function toShippingKanban(
  tasks: FastTasksResponse,
  index: Record<string, KanbanBoard>,
): Record<string, KanbanBoard> {
  tasks.tasks.forEach((task) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const boardKey = taskShippingBoardMap[task.taskFormKey as string];
    index[boardKey] = index[boardKey] || {
      id: boardKey,
      title: boardKey,
      tasks: [],
    };
    index[boardKey].tasks.push(toKanbanBoardTask(task));
  });

  return index;
}
