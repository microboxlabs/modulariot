import { KanbanBoard, KanbanBoardTask } from "../types/common.types";
import kanbanBoards from "../model/kanban.json";
import {
  FastTasksResponse,
  PersistentState,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";

const taskShippingBoardMap: Record<string, string> = {
  // "wfship:tripOutsideInitiatedTask": "tripInitiatedOutside",
  "wfship:tripOutsideInitiatedTask": "monitoringFinalization",
  "wfship:transportValidationTask": "transportValidation",
  "wfship:missionControlTripInitTask": "missionControlTripInit",
  "wfship:overlordTripInitTask": "overlordTripInit",
  "wfship:sovosDigitalSignature": "sovosDigitalSignature",
  //tripInitiatedWithoutSovos: "tripInitiated",
  tripInitiatedWithoutSovos: "monitoringFinalization",

  "wfship:monitoringInCourseTrip": "monitoringInCourseTrip",
  "wfship:confirmTripDestinationArrival": "confirmTripDestinationArrival",
  "wfship:confirmTripDestinationDeparture": "confirmTripDestinationDeparture",
  "wfship:confirmDelivery": "confirmDelivery",
  "wfship:confirmMonitoringFinalization": "confirmMonitoringFinalization",
  monitoringFinalization: "monitoringFinalization",
  //tripInitiated: "tripInitiated",
  tripInitiated: "monitoringFinalization",
  //endevent1: "tripInitiated",
  endevent1: "monitoringFinalization",

  tripNullified: "tripNullified",
  tripCanceled: "tripCancelled",
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
  const departureDate = task.mintral_departureDate as string;
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
    executionType: task.mintral_executionType as string,
    members: [],
    hoReference: task.mintral_hoReference as string,
    departureDate,
  };
}

export function getStaticData(): KanbanBoard[] {
  return kanbanBoards as unknown as KanbanBoard[];
}

export function toShippingKanban(
  tasks: FastTasksResponse,
  index: Record<string, KanbanBoard>,
): Record<string, KanbanBoard> {
  tasks.tasks.forEach(
    (task: { persistentState?: PersistentState } & Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const taskFormKey =
        task.persistentState?.endStateName ?? (task.taskFormKey as string);
      const boardKey = taskShippingBoardMap[taskFormKey];
      index[boardKey] = index[boardKey] || {
        id: boardKey,
        title: boardKey,
        tasks: [],
      };
      index[boardKey].tasks.push(toKanbanBoardTask(task));
    },
  );

  return index;
}
