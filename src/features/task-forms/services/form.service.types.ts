export type TaskNextActionState = {
  success?: boolean;
  error?: string;
};

export type ShippingCoordinatorProcess = "shippingCoordinatorProcess";

export type ShippingCoordinatorProcessForms =
  | "wfship:transportValidationTask"
  | "wfship:missionControlTripInitTask"
  | "wfship:overlordTripInitTask"
  | "wfship:sovosDigitalSignature"
  | "wfship:tripOutsideInitiatedTask"
  | "wfship:monitoringInCourseTrip"
  | "wfship:confirmTripDestinationArrival"
  | "wfship:confirmTripDestinationDeparture"
  | "wfship:confirmDelivery"
  | "wfship:confirmMonitoringFinalization"
  | "wfship:monitoringFinalization";

export type MissionControlValidationOutcome =
  | "Iniciado Normal"
  | "Iniciado Con Reparos"
  | "Iniciado sin Firma Sovos"
  | "Requiere Overlord"
  | "Viaje Anulado"
  | "Viaje Cancelado"; //"Cancelado";

export type MonitoringInCourseTripOutcome =
  | "Confirmar Arribo a Destino"
  | "Confirmar Salida del Destino"
  | "Confirmar Entrega"
  | "Devolver a Torre de Control"
  | "Confirmar Cierre del Monitoreo"
  | "Cerrar Monitoreo";

export type SovosDigitalSignatureOutcome =
  | "Devolver a Torre de Control"
  | "Devolver a Validacion de Transporte"
  | "Devolver a Overlord"
  | "Viaje Iniciado"
  | "Viaje Cancelado"
  | "Viaje Anulado";

export type TaskOutcome =
  | MissionControlValidationOutcome
  | SovosDigitalSignatureOutcome
  | MonitoringInCourseTripOutcome
  | OverlordTripInitOutcome;

export type ShippingCoordinatorProcessTask =
  | "transportValidation"
  | "missionControlTripInit"
  | "overlordTripInit"
  | "sovosDigitalSignature"
  | "tripOutsideInitiated"
  | "monitoringInCourseTrip"
  | "confirmTripDestinationArrival"
  | "confirmTripDestinationDeparture"
  | "confirmDelivery"
  | "confirmMonitoringFinalization"
  | "monitoringFinalization";

export type OverlordTripInitOutcome =
  | "Autorizado Sin GPS"
  | "Autorizado Con Reparos"
  | "Anulado por Overlord"
  | "Cancelado por Overlord";

export type GPSValidityType = "ok" | "warning" | "error";
