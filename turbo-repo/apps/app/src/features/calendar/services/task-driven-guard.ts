import type { TaskStage } from "../components/planning/planning-selection-types";

/**
 * Guard for the one thing that must never happen on a task-driven service:
 * writing a booking row without moving the workflow.
 *
 * ECM owns the booking lifecycle for a task-driven origin — its task listeners
 * write and reconcile `cld_bookings` and enqueue the Alerce chain. So a booking
 * written by the BFF with no accompanying transition is not a lesser version of
 * planning; it is a divergence. The calendar says planned, the workflow says
 * otherwise, no async job exists, and nobody finds out until someone asks why
 * Alerce is stale days later (dev service 78265602 sat that way for six
 * months).
 *
 * That state was reachable because the pool advertised five stages while
 * `task-stage-transitions.ts` can only act on two, and a stage with no entry
 * silently fell through to the legacy write. #977 phase 1 closed the entry
 * point by scoping the queue to `planService`; this closes the hole itself, so
 * a future entry point cannot reopen it.
 *
 * Deliberately narrow. It refuses only what is provably wrong: a task-driven
 * origin whose live task sits at a stage no transition covers. A service with
 * no live task at all is left alone — we cannot prove it is workflow-backed,
 * and refusing would block planning for services whose workflow is genuinely
 * missing, which is a different bug (see #977).
 */
export function refuseWorkflowlessPlan(input: {
  /** The live Alfresco task's stage, or undefined when there is no live task. */
  stage: TaskStage | undefined;
  /** Whether a forward workflow transition resolved for this gesture. */
  hasTaskAdvance: boolean;
  /** Whether the presented-service re-assign dance will run instead. */
  hasReassign: boolean;
  /** Whether this is a slot-only move of an existing booking. */
  isReassigning: boolean;
}): string | null {
  const { stage, hasTaskAdvance, hasReassign, isReassigning } = input;
  // A slot move carries no stage change; the workflow is already where it
  // belongs and the move route handles the row.
  if (isReassigning) return null;
  if (hasTaskAdvance || hasReassign) return null;
  if (!stage) return null;
  return (
    `No se puede planificar: el servicio ya avanzó a «${stage}». ` +
    `Use el menú del bloque en el calendario para reasignar o replanificar.`
  );
}

/**
 * Assigning IS the `assignDriver → presentDriver` edge: a task at
 * `assignDriver` takes it forward, one at `presentDriver` re-drives it through
 * the step-back dance (`decidePresentedReassign`). No other stage has an edge
 * to carry the resource tuple.
 */
const ASSIGNABLE_STAGES: ReadonlySet<string> = new Set([
  "assignDriver",
  "presentDriver",
]);

/**
 * Whether the assign gesture has anywhere to go — the menu gate. Planning and
 * assigning are separate steps, so being planned does not make a service
 * assignable. Fail-open on what we cannot prove (unknown stage) so a
 * still-loading task index never hides a legitimate action. Takes the loose
 * `workflowStage` a planned item carries, which may hold a terminal value
 * such as `finished` — not assignable either.
 */
export function canAssignAtStage(stage: string | undefined): boolean {
  if (!stage) return true;
  return ASSIGNABLE_STAGES.has(stage);
}

/**
 * Stages the calendar may still re-plan from. Planning is the calendar's job
 * right up until the trip starts — `missionControl` is that start, so it and
 * everything after belong to the process, not the planner.
 *
 * Re-planning past `presentDriver` costs the assignment: the only way back into
 * `assignDriver` is the same edge "Eliminar Asignación" uses, so the driver is
 * dropped and the planner re-assigns. That is the intended trade, not a side
 * effect — moving the date means re-confirming who drives it.
 */
const REPLANNABLE_STAGES: ReadonlySet<string> = new Set([
  "planService",
  "assignDriver",
  "presentDriver",
  "prepareService",
]);

/**
 * Whether the calendar may still re-plan (or un-plan) this service — the menu
 * gate for "Volver a planificar" / "Eliminar planificación". Same fail-open
 * stance as {@link canAssignAtStage}: an unknown stage answers `true`, so a
 * loading task index never hides a legitimate action.
 */
export function canReplanAtStage(stage: string | undefined): boolean {
  if (!stage) return true;
  return REPLANNABLE_STAGES.has(stage);
}

/**
 * Persist-boundary backstop for a re-plan whose stage the menu should already
 * have refused. Reaching this means the gate was bypassed.
 */
export function refuseReplan(input: {
  stage: TaskStage | undefined;
}): string | null {
  const { stage } = input;
  if (canReplanAtStage(stage)) return null;
  return (
    `No se puede replanificar: el viaje ya inició («${stage}»). ` +
    `Gestione el cambio desde el proceso.`
  );
}

/**
 * Persist-boundary counterpart of {@link canAssignAtStage}: the assign gesture
 * must move the workflow, or it must not write. Reaching a refusal here means
 * the menu gate was bypassed — or the tuple is incomplete for a stage that
 * otherwise accepts one.
 */
export function refuseAssign(input: {
  /** The live Alfresco task's stage, or undefined when there is no live task. */
  stage: TaskStage | undefined;
  /** Whether a forward workflow transition resolved for this gesture. */
  hasTaskAdvance: boolean;
  /** Whether the presented-service re-assign dance will run instead. */
  hasReassign: boolean;
}): string | null {
  const { stage, hasTaskAdvance, hasReassign } = input;
  if (!stage) return null;
  if (!ASSIGNABLE_STAGES.has(stage)) {
    return (
      `No se puede asignar: el servicio ya avanzó a «${stage}». ` +
      `La asignación de recursos se gestiona desde el proceso.`
    );
  }
  if (hasTaskAdvance || hasReassign) return null;
  // Assignable stage, nothing to fire: the tuple is incomplete
  // (`buildAssignProcessVariables` also needs the service type, which is not a
  // form field), so a write would change the calendar and not the workflow.
  return (
    `No se puede asignar: faltan datos de la asignación ` +
    `(transportista, conductor, camión o tipo de servicio).`
  );
}
