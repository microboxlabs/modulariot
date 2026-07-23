import type { TaskStage } from "../components/planning/planning-selection-types";
import { isOriginTaskDriven } from "./task-driven-origin";

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
  origin: string | undefined;
  enabledOrigins: ReadonlySet<string>;
  /** Whether a forward workflow transition resolved for this gesture. */
  hasTaskAdvance: boolean;
  /** Whether the presented-service re-assign dance will run instead. */
  hasReassign: boolean;
  /** Whether this is a slot-only move of an existing booking. */
  isReassigning: boolean;
}): string | null {
  const {
    stage,
    origin,
    enabledOrigins,
    hasTaskAdvance,
    hasReassign,
    isReassigning,
  } = input;
  // A slot move carries no stage change; the workflow is already where it
  // belongs and the move route handles the row.
  if (isReassigning) return null;
  if (hasTaskAdvance || hasReassign) return null;
  if (!isOriginTaskDriven(origin, enabledOrigins)) return null;
  if (!stage) return null;
  return (
    `No se puede planificar: el servicio ya avanzó a «${stage}». ` +
    `Use el menú del bloque en el calendario para reasignar o replanificar.`
  );
}
