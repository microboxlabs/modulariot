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
  | "wfship:monitoringFinalization";

export type MissionControlValidationOutcome =
  | "Iniciado Normal"
  | "Iniciado Con Reparos"
  | "Iniciado sin Firma Sovos"
  | "Requiere Overlord"
  | "Anulado"
  | "Cancelado";

export type MonitoringInCourseTripOutcome =
  | "Confirmar Arribo a Destino"
  | "Confirmar Salida del Destino"
  | "Confirmar Entrega"
  | "Cierre de Monitoreo";

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
  | MonitoringInCourseTripOutcome;

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
  | "monitoringFinalization";

export type GPSValidityType = "ok" | "warning" | "error";
