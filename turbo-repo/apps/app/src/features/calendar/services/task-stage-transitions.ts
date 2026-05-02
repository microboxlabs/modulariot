import type { TaskStage } from "../components/planning/planning-selection-context";

/**
 * Default Alfresco workflow transitions to fire when the user completes the
 * action that the kanban stage represents. Strings match the transition names
 * declared in `WorkflowShippingCoordinationModel` (ecm-coordinator):
 *   - VAL_ASSIGN_DRIVER_TRANSPORT = "Asignar Conductor/Transporte"
 *   - VAL_PRESENT_DRIVER          = "Presentar Conductor"
 *
 * Stages without an entry (presentDriver, prepareService, missionControl) do
 * not auto-advance from the calendar.
 */
const NEXT_TRANSITION: Partial<Record<TaskStage, string>> = {
  planService: "Asignar Conductor/Transporte",
  assignDriver: "Presentar Conductor",
};

export function getNextTransition(
  stage: TaskStage | undefined
): string | undefined {
  return stage ? NEXT_TRANSITION[stage] : undefined;
}

/**
 * Workflow transitions fired when "Eliminar Planificación" cancels a booking,
 * keyed by the task's *live* kanban stage. Each entry steps the workflow one
 * stage back toward `planService`. Stages omitted produce no transition
 * (either already at planService, or removing the planning from there is
 * not a single backward step and requires unassigning first).
 */
const UNPLAN_TRANSITIONS: Partial<Record<TaskStage, string>> = {
  assignDriver: "Planificar Servicio",
};

export function getUnplanTransition(
  stage: TaskStage | undefined
): string | undefined {
  return stage ? UNPLAN_TRANSITIONS[stage] : undefined;
}

/**
 * Kanban column keys that the planning calendar cares about. The kanban
 * board API returns tasks grouped by these keys, which double as our
 * `TaskStage` identifiers everywhere in the planning UI.
 */
const KNOWN_TASK_STAGES = new Set<TaskStage>([
  "planService",
  "assignDriver",
  "presentDriver",
  "prepareService",
  "missionControl",
]);

/**
 * Narrow a kanban column key (the string the board API uses) to a
 * `TaskStage`, or undefined for columns the calendar doesn't track.
 */
export function asTaskStageFromColumn(
  columnKey: string
): TaskStage | undefined {
  return KNOWN_TASK_STAGES.has(columnKey as TaskStage)
    ? (columnKey as TaskStage)
    : undefined;
}
