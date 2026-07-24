import type { PlanProcessVariables } from "@/features/common/providers/client-api.provider";
import type { TaskStage } from "../components/planning/planning-selection-types";
import { canReplanAtStage } from "./task-driven-guard";
import { isOriginTaskDriven } from "./task-driven-origin";
import {
  buildPlanProcessVariables,
  type PlanSlotInput,
} from "./task-driven-plan";

/** Transition names declared in `WorkflowShippingCoordinationModel` (ecm-coordinator). */
const TO_ASSIGN_DRIVER = "Asignar Conductor/Transporte";
const TO_PLAN_SERVICE = "Planificar Servicio";

/** One workflow move in a re-plan, with the stage it must fire from. */
export type ReplanEdge = {
  /** Stage the task must be sitting at before this edge fires. */
  fromStage: TaskStage;
  transition: string;
  processVariables?: PlanProcessVariables;
};

export type ReplanPlan = { edges: ReplanEdge[] };

/**
 * The workflow moves that re-plan a task-driven service into a new slot.
 *
 * ECM has no move listener — by design. Its re-plan mechanism is an
 * `assignDriver` **re-entry carrying the new slot vars**, which enqueues
 * `ensure(PLANNED, <new slot>)` and lets the worker re-slot the existing
 * booking (idempotent by `(calendarId, <serviceCode>-V)`). So re-planning is
 * not a booking write with a transition bolted on: driving these edges IS the
 * re-plan, and the caller must skip its own booking write entirely.
 *
 * Two shapes, because only one stage has a direct edge back:
 * - `presentDriver` → a single `"Asignar Conductor/Transporte"`, the same edge
 *   "Eliminar Asignación" uses. It lands on `assignDriver` **unassigned** —
 *   moving the date means re-confirming the driver.
 * - `assignDriver` / `prepareService` → out to `planService` first, then back
 *   in carrying the slot.
 *
 * Returns `null` when this is not a task-driven re-plan we can drive: a
 * flag-off origin, a stage past the trip start (see {@link canReplanAtStage}),
 * `planService` (nothing planned yet to re-plan), or a missing calendar. The
 * caller then keeps its legacy behaviour.
 */
export function decideReplan(input: {
  stage: TaskStage | undefined;
  origin: string | undefined;
  calendarId: string | undefined;
  slot: PlanSlotInput;
  enabledOrigins: ReadonlySet<string>;
  serviceCategory?: string;
}): ReplanPlan | null {
  const { stage, origin, calendarId, slot, enabledOrigins, serviceCategory } =
    input;
  if (!stage) return null;
  if (!isOriginTaskDriven(origin, enabledOrigins)) return null;
  if (!canReplanAtStage(stage, origin, enabledOrigins)) return null;

  const slotVars = buildPlanProcessVariables(calendarId, slot, serviceCategory);
  if (!slotVars) return null;

  // The edge that re-enters assignDriver; carrying the slot is what makes the
  // ECM listener re-slot the booking rather than assert the old slot.
  const reenter: ReplanEdge = {
    fromStage: "planService",
    transition: TO_ASSIGN_DRIVER,
    processVariables: slotVars,
  };

  if (stage === "presentDriver") {
    return {
      edges: [
        {
          fromStage: "presentDriver",
          transition: TO_ASSIGN_DRIVER,
          processVariables: slotVars,
        },
      ],
    };
  }

  if (stage === "assignDriver" || stage === "prepareService") {
    return {
      edges: [{ fromStage: stage, transition: TO_PLAN_SERVICE }, reenter],
    };
  }

  return null;
}
