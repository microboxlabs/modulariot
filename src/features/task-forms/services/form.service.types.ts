export type TaskNextActionState = {
  success?: boolean;
};

export type ShippingCoordinatorProcess = "shippingCoordinatorProcess";

export type ShippingCoordinatorProcessForms =
  | "wfship:transportValidationTask"
  | "wfship:missionControlTripInitTask"
  | "wfship:overlordTripInitTask"
  | "wfship:sovosDigitalSignature"
  | "wfship:tripOutsideInitiatedTask";

export type MissionControlValidationOutcome =
  | "Iniciado Normal"
  | "Iniciado Con Reparos"
  | "Iniciado sin Firma Sovos"
  | "Requiere Overlord"
  | "Anulado"
  | "Cancelado";

export type SovosDigitalSignatureOutcome =
  | "Devolver a Torre de Control"
  | "Devolver a Validacion de Transporte"
  | "Devolver a Overlord"
  | "Viaje Iniciado"
  | "Viaje Cancelado"
  | "Viaje Anulado";

export type TaskOutcome =
  | MissionControlValidationOutcome
  | SovosDigitalSignatureOutcome;

export type ShippingCoordinatorProcessTask =
  | "transportValidation"
  | "missionControlTripInit"
  | "overlordTripInit"
  | "overlordTripInit"
  | "sovosDigitalSignature"
  | "tripOutsideInitiated";

export type GPSValidityType = "ok" | "warning" | "error";
