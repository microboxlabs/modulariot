import type { AssignmentFormData } from "./assignment-form";
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
