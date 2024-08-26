import {
  MissionControlValidationOutcome,
  ShippingCoordinatorProcessForms,
} from "./form.service.types";

export const TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK: ShippingCoordinatorProcessForms =
  "wfship:transportValidationTask";

export const TYPE_WFSHIP_MISSION_CONTROL_TRIP_INIT_TASK: ShippingCoordinatorProcessForms =
  "wfship:missionControlTripInitTask";

export const TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK: ShippingCoordinatorProcessForms =
  "wfship:overlordTripInitTask";

export const TYPE_WFSHIP_SOVOS_DIGITAL_SIGNATURE: ShippingCoordinatorProcessForms =
  "wfship:sovosDigitalSignature";

export const TYPE_WFSHIP_TRIP_OUTSIDE_INITIATED_TASK: ShippingCoordinatorProcessForms =
  "wfship:tripOutsideInitiatedTask";

export const OUTCOME_NORMAL_INITIATION: MissionControlValidationOutcome =
  "Iniciado Normal";

export const OUTCOME_INITIATION_WITH_OBJECTIONS: MissionControlValidationOutcome =
  "Iniciado Con Reparos";

export const OUTCOME_OVERLORD_REQUIRED: MissionControlValidationOutcome =
  "Requiere Overlord";

export const OUTCOME_CANCELED: MissionControlValidationOutcome = "Cancelado";

export const OUTCOME_ANNULLED: MissionControlValidationOutcome = "Anulado";
