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
  | "Cancelado"
  | "Anulado";

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
  | "monitoringFinalization"
  | "finished";

export type ShippingFinishedCoordinatorProcessTask =
  | "monitoringFinalization"
  | "finished"
  | "tripCancelled"
  | "tripCanceledByOverlord"
  | "canceled"
  | "tripNullified"
  | "tripNullifiedByOverlord"
  | "nullified";

export type OverlordTripInitOutcome =
  | "Autorizado Sin GPS"
  | "Autorizado Con Reparos"
  | "Anulado por Overlord"
  | "Cancelado por Overlord";

export type GPSValidityType = "ok" | "warning" | "error";

/* ------------------------------------------------------------- */
/* Shipping Coordinator Process V2 */
/* ------------------------------------------------------------- */

export type ShippingCoordinatorProcessV2 = "shipping_coordination";

export type ShippingCoordinatorProcessFormsV2 =
  | "wfship2:assignDriverTask"
  | "wfship2:presentDriverTask"
  | "wfship2:prepareServiceTask"
  | "wfship2:missionControlTask"
  | "wfship2:monitorTripTask"
  | "wfship2:confirmArrivalTask"
  | "wfship2:closeMonitoringTask";

export type AssignDriverTaskOutcome =
  | "Presentar Conductor"
  | "Preparar Servicio"
  | "Torre de Control: Iniciar Viaje"
  | "Monitorear viaje en curso"
  | "Viaje Cancelado"
  | "Viaje Anulado";

export type PresentDriverTaskOutcome =
  | "Preparar Servicio"
  | "Torre de Control: Iniciar Viaje"
  | "Monitorear viaje en curso"
  | "Asignar Conductor/Transporte"
  | "Viaje Cancelado"
  | "Viaje Anulado";

export type PrepareServiceTaskOutcome =
  | "Torre de Control: Iniciar Viaje"
  | "Monitorear viaje en curso"
  | "Presentar Conductor"
  | "Asignar Conductor/Transporte"
  | "Viaje Cancelado"
  | "Viaje Anulado";

export type MissionControlTaskOutcome =
  | "Monitorear viaje en curso"
  | "Torre de Control: Iniciar Viaje sin firma"
  | "Preparar Servicio"
  | "Presentar Conductor"
  | "Asignar Conductor/Transporte"
  | "Viaje Cancelado"
  | "Viaje Anulado";

export type MissionControlTaskOutcomeWithoutSignature =
  | "Preparar Servicio"
  | "Presentar Conductor"
  | "Asignar Conductor/Transporte"
  | "Viaje Cancelado"
  | "Viaje Anulado";

export type MonitorTripTaskOutcome =
  | "Confirmar Arribo / Entrega"
  | "Torre de Control: Iniciar Viaje"
  | "Viaje Cancelado"
  | "Viaje Anulado";

export type ConfirmArrivalTaskOutcome =
  | "Confirmar Cierre del Monitoreo"
  | "Monitorear viaje en curso"
  | "Viaje Cancelado"
  | "Viaje Anulado";

export type CloseMonitoringTaskOutcome =
  | "Viaje Finalizado"
  | "Monitorear viaje en curso"
  | "Viaje Cancelado"
  | "Viaje Anulado";

export type TaskOutcomeV2 =
  | AssignDriverTaskOutcome
  | PresentDriverTaskOutcome
  | PrepareServiceTaskOutcome
  | MissionControlTaskOutcome
  | MissionControlTaskOutcomeWithoutSignature
  | ConfirmArrivalTaskOutcome
  | MonitorTripTaskOutcome
  | CloseMonitoringTaskOutcome;

export type ShippingCoordinatorProcessTaskV2 =
  | "assignDriver"
  | "presentDriver"
  | "prepareService"
  | "missionControl"
  | "monitorTrip"
  | "confirmArrival"
  | "closeMonitoring"
  | "finished";

/* ------------------------------------------------------------- */
/* Delivery Process */
/* ------------------------------------------------------------- */

export type DeliveryProcess = "delivery_coordination";

export type DeliveryProcessForms =
  | "wfship2:confirmDeliveryTask"
  | "wfship2:receiveDeliveryTask"
  | "wfship2:notifyTMSArrivalTask"
  | "wfship2:notifyTMSDeliveryTask";

export type ConfirmDeliveryOutcome = "Recibir Entrega" | "Viaje Rechazado";

export type ReceiveDeliveryOutcome =
  | "Confirmar Entrega"
  | "Notificar Arribo (4.7)";

export type NotifyTMSArrivalOutcome =
  | "Recibir Entrega"
  | "Notificar Entrega (5.11)";

export type NotifyTMSDeliveryOutcome =
  | "Notificar Entrega (5.11)"
  | "Viaje Finalizado";

export type TaskOutcomeDelivery =
  | ConfirmDeliveryOutcome
  | ReceiveDeliveryOutcome
  | NotifyTMSArrivalOutcome
  | NotifyTMSDeliveryOutcome;

export type DeliveryProcessTask =
  | "confirmDelivery"
  | "receiveDelivery"
  | "notifyTMSArrival"
  | "notifyTMSDelivery";
