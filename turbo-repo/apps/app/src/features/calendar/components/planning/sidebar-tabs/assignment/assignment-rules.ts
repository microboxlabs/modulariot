import type { AssignmentFormData } from "./assignment-form";
import type { SelectedService } from "../../planning-selection-types";
import type { AccreditedResource } from "@/features/calendar/services/accredited-resources.service";

/**
 * The wire flag → the form's `truckTrailerNeed`. The upstream fn emits
 * `0 | 1`; booleans are admitted too so an fn change can't flip the rule
 * silently. Absent/null stays `null` — "unknown", which `trailerRequired`
 * treats as required.
 */
export function normalizeTrailerNeed(
  value: AccreditedResource["trailer_need"] | undefined
): boolean | null {
  return value == null ? null : Boolean(value);
}

/**
 * Whether the current selection makes the trailer slot mandatory — which is
 * also when the trailer selector is shown at all (no checkbox: the truck's
 * own `trailer_need` decides, not the operator).
 *
 * The picked truck's accredited row carries `trailer_need`: `false` means the
 * vehicle runs trailerless (camioneta, furgón) and the slot is hidden;
 * `true` means it never runs a service without its trailer, so the slot is
 * shown and required. Absent/`null` — a row from an fn deployment that
 * predates the flag, or a rehydrated assignment whose row hasn't loaded yet —
 * is treated as required: failing closed beats shipping an assignment whose
 * empty trailer slot downstream bindings fill with a placeholder.
 */
export function trailerRequired(
  data: Pick<AssignmentFormData, "truck" | "truckTrailerNeed">
): boolean {
  return Boolean(data.truck) && data.truckTrailerNeed !== false;
}

/**
 * Build the service-override patch that travels with `confirmService` so the
 * booking payload reflects the user's current selections. A slot the user
 * filled is written; a slot that is merely *not yet* filled (trailer still
 * pending on a trailer-needing truck, second-driver section open but empty)
 * is left untouched — partial assignments shouldn't wipe previously-saved
 * fields.
 *
 * Two empties are statements, not partial fills, and are written as explicit
 * `""` clears (ECM's `strVar` reads `""` as absent, so the process variable
 * and the outbound `trailer_id`/`driver2_id` become null end-to-end):
 *
 * - a picked truck whose `trailer_need` says it runs trailerless — otherwise
 *   the previous assignment's trailer rides the merged service state into the
 *   dispatch, and the partner rejects a transport-type truck that indicates a
 *   remolque (prod job 2123fcea);
 * - a closed second-driver section — otherwise a removed conductor2 keeps
 *   being re-sent.
 */
export function assignmentOverrides(
  data: AssignmentFormData
): Partial<SelectedService> {
  const out: Partial<SelectedService> = {};
  if (data.carrier) {
    out.assignedCarrier = data.carrier;
    // Carry the upstream prve_codigo alongside the UUID so the binding
    // extractor can ship `carrier_external_id` for the partner's `proveedor`.
    // `null` is a real value (carrier with no upstream code on file) and
    // must be preserved — don't gate this on truthiness.
    out.assignedCarrierExternalId = data.carrierExternalId;
    // Same lifecycle for the accreditation level the calendar card renders:
    // `null` (unknown) is a real value too.
    out.assignedCarrierAccreditation = data.carrierAccreditation;
  }
  if (data.driver) {
    out.assignedDriver = data.driver;
    out.assignedDriverAccreditation = data.driverAccreditation;
  }
  if (data.hasSecondDriver && data.secondDriver) {
    out.assignedDriver2 = data.secondDriver;
    out.assignedDriver2Accreditation = data.secondDriverAccreditation;
  } else if (!data.hasSecondDriver) {
    out.assignedDriver2 = "";
    out.assignedDriver2Accreditation = null;
  }
  if (data.truck) {
    out.assignedTruck = data.truck;
    out.assignedTruckAccreditation = data.truckAccreditation;
  }
  if (data.trailer) {
    out.assignedTrailer = data.trailer;
    out.assignedTrailerAccreditation = data.trailerAccreditation;
  } else if (data.truck && !trailerRequired(data)) {
    out.assignedTrailer = "";
    out.assignedTrailerAccreditation = null;
  }
  return out;
}

/**
 * The submit gate for the Asignar button: carrier, driver and truck are always
 * required, and a truck that needs a trailer additionally requires one.
 */
export function assignmentIncomplete(
  data: Pick<
    AssignmentFormData,
    "carrier" | "driver" | "truck" | "trailer" | "truckTrailerNeed"
  >
): boolean {
  return (
    !data.carrier ||
    !data.driver ||
    !data.truck ||
    (trailerRequired(data) && !data.trailer)
  );
}
