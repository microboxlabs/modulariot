import {
  MissionControlValidationOutcome,
  ShippingCoordinatorProcessForms,
  ShippingCoordinatorProcessTask,
  SovosDigitalSignatureOutcome,
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

export const OUTCOME_INITIATED_WITHOUT_SOVOS_SIGNATURE: MissionControlValidationOutcome =
  "Iniciado sin Firma Sovos";

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

export const TASK_MONITORING_IN_COURSE_TRIP: ShippingCoordinatorProcessTask =
  "monitoringInCourseTrip";

export const TASK_CONFIRM_TRIP_DESTINATION_ARRIVAL: ShippingCoordinatorProcessTask =
  "confirmTripDestinationArrival";

export const TASK_CONFIRM_TRIP_DESTINATION_DEPARTURE: ShippingCoordinatorProcessTask =
  "confirmTripDestinationDeparture";

export const TASK_CONFIRM_DELIVERY: ShippingCoordinatorProcessTask =
  "confirmDelivery";

export const TASK_MONITORING_FINALIZATION: ShippingCoordinatorProcessTask =
  "monitoringFinalization";

export const OUTCOME_RETURN_TO_MISSION_CONTROL: SovosDigitalSignatureOutcome =
  "Devolver a Torre de Control";

export const OUTCOME_RETURN_TO_TRANSPORT_VALIDATION: SovosDigitalSignatureOutcome =
  "Devolver a Validacion de Transporte";

export const OUTCOME_RETURN_TO_OVERLORD: SovosDigitalSignatureOutcome =
  "Devolver a Overlord";

export const OUTCOME_TRIP_INITIATED: SovosDigitalSignatureOutcome =
  "Viaje Iniciado";

export const OUTCOME_TRIP_CANCELED: SovosDigitalSignatureOutcome =
  "Viaje Cancelado";

export const OUTCOME_TRIP_ANNULLED: SovosDigitalSignatureOutcome =
  "Viaje Anulado";

export const SHIPPING_COORDINATOR_PROCESS_TASKS: ShippingCoordinatorProcessTask[] =
  [
    TASK_TRANSPORT_VALIDATION,
    TASK_MISSION_CONTROL_TRIP_INIT,
    TASK_OVERLORD_TRIP_INIT,
    TASK_SOVOS_DIGITAL_SIGNATURE,
    TASK_TRIP_OUTSIDE_INITIATED,
    TASK_MONITORING_IN_COURSE_TRIP,
    TASK_CONFIRM_TRIP_DESTINATION_ARRIVAL,
    TASK_CONFIRM_TRIP_DESTINATION_DEPARTURE,
    TASK_CONFIRM_DELIVERY,
    TASK_MONITORING_FINALIZATION,
  ];
