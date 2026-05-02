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
 * Workflow transition fired when "Eliminar Planificación" cancels a booking.
 * Mirrors the forward `planService → assignDriver` transition so the task
 * returns to the planService column. Only valid from the assignDriver stage —
 * a planned service in a later stage would need to be unassigned first.
 */
export const UNPLAN_TRANSITION = "Planificar Servicio";
