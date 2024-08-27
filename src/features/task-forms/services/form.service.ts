import {
  MissionControlValidationOutcome,
  ShippingCoordinatorProcessForms,
  ShippingCoordinatorProcessTask,
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

export const TASK_TRANSPORT_VALIDATION: ShippingCoordinatorProcessTask =
  "transportValidation";

export const TASK_MISSION_CONTROL_TRIP_INIT: ShippingCoordinatorProcessTask =
  "missionControlTripInit";

export const TASK_OVERLORD_TRIP_INIT: ShippingCoordinatorProcessTask =
  "overlordTripInit";

export const TASK_SOVOS_DIGITAL_SIGNATURE: ShippingCoordinatorProcessTask =
  "sovosDigitalSignature";

export const TASK_TRIP_OUTSIDE_INITIATED: ShippingCoordinatorProcessTask =
  "tripOutsideInitiated";

export const SHIPPING_COORDINATOR_PROCESS_TASKS: ShippingCoordinatorProcessTask[] =
  [
    TASK_TRANSPORT_VALIDATION,
    TASK_MISSION_CONTROL_TRIP_INIT,
    TASK_OVERLORD_TRIP_INIT,
    TASK_SOVOS_DIGITAL_SIGNATURE,
    TASK_TRIP_OUTSIDE_INITIATED,
  ];
