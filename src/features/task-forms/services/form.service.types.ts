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
  | "Requiere Overlord"
  | "Anulado"
  | "Cancelado";

export type TaskOutcome = MissionControlValidationOutcome;

export type ShippingCoordinatorProcessTask =
  | "transportValidation"
  | "missionControlTripInit"
  | "overlordTripInit"
  | "overlordTripInit"
  | "sovosDigitalSignature"
  | "tripOutsideInitiated";
