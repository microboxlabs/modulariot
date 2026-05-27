import { isOriginTaskDriven } from "./task-driven-origin";
import type { AssignProcessVariables } from "@/features/common/providers/client-api.provider";

/**
 * Snake-case input shape the helper consumes — a structural subset of
 * `SelectedService`. Declared locally to keep this helper free of any
 * dependency on `planning-selection-context.tsx` (which would pull the
 * React/import graph into worker tests).
 */
export type AssignTupleInput = {
  assignedCarrier?: string;
  assignedDriver?: string;
  assignedDriver2?: string;
  assignedTruck?: string;
  assignedTrailer?: string;
  assignedCarrierExternalId?: string | null;
  mintral_serviceKind?: string;
};

/**
 * Build the snake-case `processVariables` payload that the planner sends on
 * the task-driven ASSIGN move (`assignDriver → presentDriver`). Returns
 * `null` when the required fields are missing — the caller falls back to a
 * plain GET task move (no variables set), matching the planner's existing
 * "Asignar"-button enable rule which only triggers an assign with the full
 * tuple set.
 *
 * Required (non-empty): `carrier_id`, `driver_id`, `truck_id`, `tipo_servicio`.
 * Nullable (string or JSON `null`): `driver2_id`, `trailer_id`,
 * `carrier_external_id`. `tipo_servicio` is uppercased to mirror the
 * binding payload's stage-assigned shape (see `binding-extractor.ts:61`).
 *
 * See `docs/plans/calendar-task-driven-frontend-P0-spike.md` §2.2–§2.4 for
 * the wire contract and the FE → process-variable field mapping.
 */
export function buildAssignProcessVariables(
  input: AssignTupleInput
): AssignProcessVariables | null {
  const carrierId = input.assignedCarrier;
  const driverId = input.assignedDriver;
  const truckId = input.assignedTruck;
  const tipoServicioRaw = input.mintral_serviceKind;
  if (!carrierId || !driverId || !truckId || !tipoServicioRaw) {
    return null;
  }
  return {
    carrier_id: carrierId,
    driver_id: driverId,
    driver2_id: input.assignedDriver2 || null,
    truck_id: truckId,
    trailer_id: input.assignedTrailer || null,
    carrier_external_id: input.assignedCarrierExternalId ?? null,
    tipo_servicio: tipoServicioRaw.toUpperCase(),
  };
}

/**
 * Returns the planner's task-driven ASSIGN-move parameters when the origin
 * is task-driven AND the forward transition is the BPMN's
 * `assignDriver → presentDriver` flow (`"Presentar Conductor"`).
 *
 * Returns `null` for every other case — including a task-driven origin
 * whose live task is at `planService` (the PLAN move; no resource tuple
 * required yet) or any flag-off origin — and the caller proceeds with a
 * plain GET task advance, preserving today's behavior byte-for-byte.
 */
export function decideAssignTaskAdvance(
  transitionId: string | undefined,
  origin: string | undefined,
  service: AssignTupleInput,
  enabledOrigins: ReadonlySet<string>
): AssignProcessVariables | null {
  if (transitionId !== "Presentar Conductor") return null;
  if (!isOriginTaskDriven(origin, enabledOrigins)) return null;
  return buildAssignProcessVariables(service);
}

/**
 * Returns the planner's task-driven UNASSIGN-move transition for the live
 * task stage when the origin is task-driven — `"Asignar Conductor/Transporte"`
 * for a service at `presentDriver` (the BPMN's `presentDriver → assignDriver`
 * outcome, so the ECM `OnCreateAssignDriverBinding` listener fires and
 * reconciles the binding to `unassigned`).
 *
 * Returns `undefined` for every other case — flag-off origins, missing
 * origins, and stages other than `presentDriver` — and the caller falls
 * through to the legacy `getUnassignTransition` map, preserving today's
 * behavior byte-for-byte for un-migrated origins.
 */
export function getTaskDrivenUnassignTransition(
  stage: string | undefined,
  origin: string | undefined,
  enabledOrigins: ReadonlySet<string>
): string | undefined {
  if (!isOriginTaskDriven(origin, enabledOrigins)) return undefined;
  if (stage !== "presentDriver") return undefined;
  return "Asignar Conductor/Transporte";
}
