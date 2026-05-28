import {
  KanbanBoard,
  KanbanBoardTask,
  KanbanTaskGroup,
} from "../types/common.types";
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

/**
 * Best-effort resolution of a pooled task's candidate group from the raw task
 * record. The exact key depends on the backend surfacing the candidate group;
 * we read the known/likely fields defensively and return undefined otherwise so
 * the card simply omits the group marker until the proxy provides it.
 *
 * TODO(backend): have the task proxy expose the candidate group explicitly
 * (id + display name) rather than relying on these fallbacks.
 */
function toCandidateGroup(
  task: Record<string, unknown>
): KanbanTaskGroup | undefined {
  const raw =
    (task.mintral_candidateGroup as string | undefined) ??
    (task.bpm_groupAssignee as string | undefined) ??
    (task.bpm_pooledActors as string | undefined);
  if (!raw || typeof raw !== "string") {
    return undefined;
  }
  // Alfresco group authorities look like "GROUP_<name>"; show the bare name.
  const id = raw.split(",")[0].trim();
  const name = id.replace(/^GROUP_/, "");
  return id ? { id, name } : undefined;
}

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
    mintral_serviceCode:
      task.mintral_serviceCode == null ? undefined : String(serviceCode),
    description: task.bpm_description as string,
    completed: task.state === "COMPLETED",
    daysLeft: 2,
    origin,
    destination,
    clientCode,
    client,
    mintral_clientRut: task.mintral_clientRut as string,
    mintral_delegacionOrigen: task.mintral_delegacionOrigen as string,
    expectedDepartureDate,
    serviceKind: task.mintral_serviceKind as string,
    serviceType,
    executionType: task.mintral_executionType as string,
    members: [],
    candidateGroup: toCandidateGroup(task),
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
    mintral_incidents: Object.entries(task)
      .filter(([key]) => key.startsWith("mintral_incident"))
      .map(([key, value]) => [key, String(value)] as [string, string]),
    mintral_loadConstraint: task.mintral_loadConstraint as string,
    mintral_loadVolumeUtilization: task.mintral_loadVolumeUtilization as number,
    mintral_loadWeightUtilization: task.mintral_loadWeightUtilization as number,
    mintral_loadPalletUtilization: task.mintral_loadPalletUtilization as number,
    mintral_loadMaxUtilization: task.mintral_loadMaxUtilization as number,
    mintral_deliveryComplianceRate:
      task.mintral_deliveryComplianceRate as number,
    mintral_compliantOrderLines: task.mintral_compliantOrderLines as number,
    mintral_nonCompliantOrderLines:
      task.mintral_nonCompliantOrderLines as number,
    mintral_serviceCategory: task.mintral_serviceCategory as string,
    mintral_creationDate: task.mintral_creationDate as string,
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
  index: Record<string, KanbanBoard>,
  ordered?: KanbanBoardTask[]
): Record<string, KanbanBoard> {
  const collect = (
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
    const kanbanTask = toKanbanBoardTask(task);
    index[boardKey].tasks.push(kanbanTask);
    if (ordered) ordered.push(kanbanTask);
  };
  if ("tasks" in tasks) {
    tasks.tasks.forEach(collect);
  } else {
    tasks.workflows.forEach(collect);
  }
  return index;
}
