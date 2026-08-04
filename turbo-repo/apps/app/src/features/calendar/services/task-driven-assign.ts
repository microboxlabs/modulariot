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
  mintral_serviceType?: string;
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
 * `carrier_external_id`. `tipo_servicio` is uppercased to match the
 * coordinator's wire shape.
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
  const tipoServicioRaw = input.mintral_serviceType;
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
 * Returns the planner's ASSIGN-move parameters when the forward transition
 * is the BPMN's `assignDriver → presentDriver` flow
 * (`"Presentar Conductor"`).
 *
 * Returns `null` for every other case — including a live task at
 * `planService` (the PLAN move; no resource tuple required yet) — and the
 * caller proceeds with a plain GET task advance.
 */
export function decideAssignTaskAdvance(
  transitionId: string | undefined,
  service: AssignTupleInput
): AssignProcessVariables | null {
  if (transitionId !== "Presentar Conductor") return null;
  return buildAssignProcessVariables(service);
}

/**
 * Returns the planner's UNASSIGN-move transition for the live task stage —
 * `"Asignar Conductor/Transporte"` for a service at `presentDriver` (the
 * BPMN's `presentDriver → assignDriver` outcome, so the ECM
 * `OnCreateAssignDriverBinding` listener fires and reconciles the binding
 * to `unassigned`).
 *
 * Returns `undefined` for any other stage — the caller falls through to
 * the `getUnassignTransition` stage map.
 */
export function getTaskDrivenUnassignTransition(
  stage: string | undefined
): string | undefined {
  if (stage !== "presentDriver") return undefined;
  return "Asignar Conductor/Transporte";
}

/**
 * Returns the assign tuple to RE-PUSH when the planner changes the assigned
 * driver/transport on a service whose live task is already at `presentDriver`
 * — i.e. past the initial `assignDriver → presentDriver` assign.
 *
 * The assign tuple only rides that one forward edge (see
 * {@link decideAssignTaskAdvance}), so a resource change on an already-presented
 * service has no forward transition to carry it to Alerce, and a plain booking
 * update would silently diverge the calendar from Alerce. The caller instead
 * runs the tested step-back/step-forward dance — `presentDriver → assignDriver`
 * (`"Asignar Conductor/Transporte"`, the same edge "Eliminar Asignación" uses)
 * then `assignDriver → presentDriver` (`"Presentar Conductor"`) carrying THIS
 * tuple — which re-enqueues the Alerce assign chain and re-stamps the booking
 * `sync_status`.
 *
 * Returns `null` unless the live stage is `presentDriver` and the full
 * assign tuple is present — so a first-time assign (task at `assignDriver`)
 * or a partial tuple falls through unchanged.
 */
export function decidePresentedReassign(
  stage: string | undefined,
  service: AssignTupleInput
): AssignProcessVariables | null {
  if (stage !== "presentDriver") return null;
  return buildAssignProcessVariables(service);
}
