import { KanbanBoard, KanbanBoardTask } from "../types/common.types";
import kanbanBoards from "../model/kanban.json";
import kanbanPickingBoards from "../model/picking-kanban.json";
import kanbanShippingV2Boards from "../model/kanban-shipping-v2.json";
import kanbanDeliverBoards from "../model/kanban-deliver.json";
import kanbanPlanningBoards from "../model/kanban-planning.json";
import {
  FastTasksResponse,
  FinishedWorkflowsResponse,
  PersistentState,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";

export const taskShippingBoardMap: Record<string, string> = {
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
  // v2
  "wfship2:assignDriverTask": "assignDriver",
  "wfship2:presentDriverTask": "presentDriver",
  "wfship2:prepareServiceTask": "prepareService",
  "wfship2:missionControlTask": "missionControl",
  "wfship2:monitorTripTask": "monitorTrip",
  "wfship2:confirmArrivalTask": "confirmArrival",
  "wfship2:closeMonitoringTask": "closeMonitoring",
  "wfship2:confirmDeliveryTask": "confirmDelivery",
  "wfship2:receiveDeliveryTask": "receiveDelivery",
  "wfship2:notifyTMSArrivalTask": "notifyTMSArrival",
  "wfship2:notifyTMSDeliveryTask": "notifyTMSDelivery",
  //Planning
  "wfship2:consolidateLoadTask": "consolidateLoad",
  "wfship2:separateDocumentsTask": "separateDocuments",
  "wfship2:planServiceTask": "planService",
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
    arrivalDate: task.mintral_arrivalDate as string,
    estimatedArrivalDate: (task?.mintral_estimatedArrivalDate as string) ?? "-",
    mintral_truckLicensePlate: task.mintral_truckLicensePlate as string,
    mintral_supplierName: task.mintral_supplierName as string,
    mintral_priorityCode: task.mintral_priorityCode as string,
    mintral_icuCondition: task.mintral_icuCondition as number,
    isEditable: task.isEditable as boolean,
    cm_created: task.cm_created as string,
  };
}

export function getStaticData(): KanbanBoard[] {
  return kanbanBoards as unknown as KanbanBoard[];
}
export function getStaticPickingData(): KanbanBoard[] {
  return kanbanPickingBoards as unknown as KanbanBoard[];
}
export function getStaticShippingV2Data(): KanbanBoard[] {
  return kanbanShippingV2Boards as unknown as KanbanBoard[];
}
export function getStaticDeliverData(): KanbanBoard[] {
  return kanbanDeliverBoards as unknown as KanbanBoard[];
}
export function getStaticPlanningData(): KanbanBoard[] {
  return kanbanPlanningBoards as unknown as KanbanBoard[];
}

export function toShippingKanban(
  tasks: FastTasksResponse | FinishedWorkflowsResponse,
  index: Record<string, KanbanBoard>
): Record<string, KanbanBoard> {
  if ("tasks" in tasks) {
    tasks.tasks.forEach(
      (
        task: { persistentState?: PersistentState } & Record<string, unknown>
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const taskFormKey =
          task.persistentState?.endStateName ?? (task.taskFormKey as string);
        const boardKey = taskShippingBoardMap[taskFormKey] ?? taskFormKey;
        index[boardKey] = index[boardKey] || {
          id: boardKey,
          title: boardKey,
          tasks: [],
        };
        index[boardKey].tasks.push(toKanbanBoardTask(task));
      }
    );
  } else {
    tasks.workflows.forEach(
      (
        task: { persistentState?: PersistentState } & Record<string, unknown>
      ) => {
        const taskFormKey =
          task.persistentState?.endStateName ?? (task.taskFormKey as string);
        const boardKey = taskShippingBoardMap[taskFormKey] ?? taskFormKey;
        index[boardKey] = index[boardKey] || {
          id: boardKey,
          title: boardKey,
          tasks: [],
        };
        index[boardKey].tasks.push(toKanbanBoardTask(task));
      }
    );
  }
  return index;
}
