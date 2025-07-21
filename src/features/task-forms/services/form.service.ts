import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  MissionControlValidationOutcome,
  MonitoringInCourseTripOutcome,
  ShippingCoordinatorProcessForms,
  ShippingCoordinatorProcessTask,
  SovosDigitalSignatureOutcome,
  OverlordTripInitOutcome,
  ShippingCoordinatorProcessFormsV2,
  ShippingCoordinatorProcessTaskV2,
  TaskOutcomeV2,
  DeliveryProcessForms,
  DeliveryProcessTask,
  TaskOutcomeDelivery,
} from "./form.service.types";
import { HiOutlineArrowLeft, HiTrash } from "react-icons/hi";
import { ElementType } from "react";

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

export const TYPE_WFSHIP_MONITORING_IN_COURSE_TRIP: ShippingCoordinatorProcessForms =
  "wfship:monitoringInCourseTrip";

export const TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_ARRIVAL: ShippingCoordinatorProcessForms =
  "wfship:confirmTripDestinationArrival";

export const TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_DEPARTURE: ShippingCoordinatorProcessForms =
  "wfship:confirmTripDestinationDeparture";

export const TYPE_WFSHIP_CONFIRM_DELIVERY: ShippingCoordinatorProcessForms =
  "wfship:confirmDelivery";

export const TYPE_WFSHIP_CONFIRM_MONITORING_FINALIZATION: ShippingCoordinatorProcessForms =
  "wfship:confirmMonitoringFinalization";

export const TYPE_WFSHIP_MONITORING_FINALIZATION: ShippingCoordinatorProcessForms =
  "wfship:monitoringFinalization";

export const OUTCOME_NORMAL_INITIATION: MissionControlValidationOutcome =
  "Iniciado Normal";

export const OUTCOME_OVERLORD_AUTHORIZED_WITHOUT_GPS: OverlordTripInitOutcome =
  "Autorizado Sin GPS";

export const OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS: OverlordTripInitOutcome =
  "Autorizado Con Reparos";

export const OUTCOME_OVERLORD_ANULLED: OverlordTripInitOutcome =
  "Anulado por Overlord";

export const OUTCOME_OVERLORD_CANCELED: OverlordTripInitOutcome =
  "Cancelado por Overlord";

export const OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION: MonitoringInCourseTripOutcome =
  "Confirmar Arribo a Destino";

export const OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION: MonitoringInCourseTripOutcome =
  "Confirmar Salida del Destino";

export const OUTCOME_CONFIRM_DELIVERY: MonitoringInCourseTripOutcome =
  "Confirmar Entrega";

export const OUTCOME_REDIRECT_TO_MISSION_CONTROL: MonitoringInCourseTripOutcome =
  "Devolver a Torre de Control";

export const OUTCOME_CONFIRM_MONITORING_FINALIZATION: MonitoringInCourseTripOutcome =
  "Confirmar Cierre del Monitoreo";

export const OUTCOME_MONITORING_FINALIZATION: MonitoringInCourseTripOutcome =
  "Cerrar Monitoreo";

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

export const TASK_CONFIRM_MONITORING_FINALIZATION: ShippingCoordinatorProcessTask =
  "confirmMonitoringFinalization";

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
    TASK_CONFIRM_DELIVERY,
    TASK_CONFIRM_TRIP_DESTINATION_DEPARTURE,
    TASK_CONFIRM_MONITORING_FINALIZATION,
    TASK_MONITORING_FINALIZATION,
  ];

/* ------------------------------------------------------------- */
/* Shipping Coordinator Process V2 */
/* ------------------------------------------------------------- */

export const TYPE_WFSHIP2_ASSIGN_DRIVER_TASK: ShippingCoordinatorProcessFormsV2 =
  "wfship2:assignDriverTask";

export const TYPE_WFSHIP2_PRESENT_DRIVER_TASK: ShippingCoordinatorProcessFormsV2 =
  "wfship2:presentDriverTask";

export const TYPE_WFSHIP2_PREPARE_SERVICE_TASK: ShippingCoordinatorProcessFormsV2 =
  "wfship2:prepareServiceTask";

export const TYPE_WFSHIP2_MISSION_CONTROL_TASK: ShippingCoordinatorProcessFormsV2 =
  "wfship2:missionControlTask";

export const TYPE_WFSHIP2_MONITOR_TRIP_TASK: ShippingCoordinatorProcessFormsV2 =
  "wfship2:monitorTripTask";

export const TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK: ShippingCoordinatorProcessFormsV2 =
  "wfship2:confirmArrivalTask";

export const TYPE_WFSHIP2_CLOSE_MONITORING_TASK: ShippingCoordinatorProcessFormsV2 =
  "wfship2:closeMonitoringTask";

export const TASK_ASSIGN_DRIVER: ShippingCoordinatorProcessTaskV2 =
  "assignDriver";

export const TASK_PRESENT_DRIVER: ShippingCoordinatorProcessTaskV2 =
  "presentDriver";

export const TASK_PREPARE_SERVICE: ShippingCoordinatorProcessTaskV2 =
  "prepareService";

export const TASK_MISSION_CONTROL: ShippingCoordinatorProcessTaskV2 =
  "missionControl";

export const TASK_MONITOR_TRIP: ShippingCoordinatorProcessTaskV2 =
  "monitorTrip";

export const TASK_CONFIRM_ARRIVAL: ShippingCoordinatorProcessTaskV2 =
  "confirmArrival";

export const TASK_CLOSE_MONITORING: ShippingCoordinatorProcessTaskV2 =
  "closeMonitoring";

export const SHIPPING_COORDINATOR_PROCESS_TASKS_V2: ShippingCoordinatorProcessTaskV2[] =
  [
    TASK_ASSIGN_DRIVER,
    TASK_PRESENT_DRIVER,
    TASK_PREPARE_SERVICE,
    TASK_MISSION_CONTROL,
    TASK_MONITOR_TRIP,
    TASK_CONFIRM_ARRIVAL,
    TASK_CLOSE_MONITORING,
  ];

export const OUTCOME_TO_ASSIGN_DRIVER_V2: TaskOutcomeV2 = "Presentar Conductor";
export const OUTCOME_ASSIGN_DRIVER_V2: TaskOutcomeV2 =
  "Asignar Conductor/Transporte";
export const OUTCOME_TO_PRESENT_DRIVER_V2: TaskOutcomeV2 = "Preparar Servicio";
export const OUTCOME_PRESENT_DRIVER_V2: TaskOutcomeV2 = "Presentar Conductor";
export const OUTCOME_TO_PREPARE_SERVICE_V2: TaskOutcomeV2 =
  "Torre de Control: Iniciar Viaje";
export const OUTCOME_PREPARE_SERVICE_V2: TaskOutcomeV2 = "Preparar Servicio";
export const OUTCOME_TO_MISSION_CONTROL_V2: TaskOutcomeV2 =
  "Monitorear viaje en curso";
export const OUTCOME_MISSION_CONTROL_V2: TaskOutcomeV2 =
  "Torre de Control: Iniciar Viaje";
export const OUTCOME_TO_MONITOR_TRIP_V2: TaskOutcomeV2 =
  "Confirmar Arribo / Entrega";
export const OUTCOME_MONITOR_TRIP_V2: TaskOutcomeV2 =
  "Monitorear viaje en curso";
export const OUTCOME_TO_CONFIRM_ARRIVAL_V2: TaskOutcomeV2 =
  "Confirmar Cierre del Monitoreo";
export const OUTCOME_CONFIRM_ARRIVAL_V2: TaskOutcomeV2 =
  "Confirmar Arribo / Entrega";
export const OUTCOME_TO_CLOSE_MONITORING_V2: TaskOutcomeV2 = "Viaje Finalizado";
export const OUTCOME_CLOSE_MONITORING_V2: TaskOutcomeV2 =
  "Confirmar Cierre del Monitoreo";
export const OUTCOME_OVERLORD_CANCELED_V2: TaskOutcomeV2 = "Viaje Cancelado";
export const OUTCOME_OVERLORD_ANULLED_V2: TaskOutcomeV2 = "Viaje Anulado";

export const getTransitionIdV2 = (
  taskType: ShippingCoordinatorProcessFormsV2 | DeliveryProcessForms,
  outcome: TaskOutcomeV2,
): TaskOutcomeV2 | TaskOutcomeDelivery => {
  switch (taskType) {
    case TYPE_WFSHIP2_ASSIGN_DRIVER_TASK:
      return OUTCOME_TO_ASSIGN_DRIVER_V2;
    case TYPE_WFSHIP2_PRESENT_DRIVER_TASK:
      return OUTCOME_TO_PRESENT_DRIVER_V2;
    case TYPE_WFSHIP2_PREPARE_SERVICE_TASK:
      return OUTCOME_TO_PREPARE_SERVICE_V2;
    case TYPE_WFSHIP2_MISSION_CONTROL_TASK:
      return OUTCOME_TO_MISSION_CONTROL_V2;
    case TYPE_WFSHIP2_MONITOR_TRIP_TASK:
      return OUTCOME_TO_MONITOR_TRIP_V2;
    case TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK:
      return OUTCOME_TO_CONFIRM_ARRIVAL_V2;
    case TYPE_WFSHIP2_CLOSE_MONITORING_TASK:
      return OUTCOME_TO_CLOSE_MONITORING_V2;
    case TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK:
      return OUTCOME_TO_CONFIRM_DELIVERY_V2;
    case TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK:
      return OUTCOME_TO_RECEIVE_DELIVERY_V2;
    case TYPE_WFDELIVERY_NOTIFY_TMS_ARRIVAL_TASK:
      return OUTCOME_TO_NOTIFY_TMS_ARRIVAL_V2;
    case TYPE_WFDELIVERY_NOTIFY_TMS_DELIVERY_TASK:
      return OUTCOME_TO_CLOSE_MONITORING_V2;
    default:
      return outcome;
  }
};

export const getSecondaryTransitionIdV2 = (
  taskType: ShippingCoordinatorProcessFormsV2 | DeliveryProcessForms,
  dict: I18nRecord,
): {
  id: TaskOutcomeV2;
  label: string;
  icon: ElementType;
}[] => {
  const otherOptions = [];
  if (taskType === TYPE_WFSHIP2_PRESENT_DRIVER_TASK) {
    otherOptions.push(
      ...[
        {
          id: OUTCOME_ASSIGN_DRIVER_V2,
          label: (dict.outcome as I18nRecord)[
            OUTCOME_ASSIGN_DRIVER_V2
          ] as string,
          icon: HiOutlineArrowLeft,
        },
      ],
    );
  } else if (taskType === TYPE_WFSHIP2_PREPARE_SERVICE_TASK) {
    otherOptions.push(
      ...[
        {
          id: OUTCOME_PRESENT_DRIVER_V2,
          label: (dict.outcome as I18nRecord)[
            OUTCOME_PRESENT_DRIVER_V2
          ] as string,
          icon: HiOutlineArrowLeft,
        },
      ],
    );
  } else if (taskType === TYPE_WFSHIP2_MISSION_CONTROL_TASK) {
    otherOptions.push(
      ...[
        {
          id: OUTCOME_ASSIGN_DRIVER_V2,
          label: (dict.outcome as I18nRecord)[
            OUTCOME_ASSIGN_DRIVER_V2
          ] as string,
          icon: HiOutlineArrowLeft,
        },
        {
          id: OUTCOME_PRESENT_DRIVER_V2,
          label: (dict.outcome as I18nRecord)[
            OUTCOME_PRESENT_DRIVER_V2
          ] as string,
          icon: HiOutlineArrowLeft,
        },
        {
          id: OUTCOME_PREPARE_SERVICE_V2,
          label: (dict.outcome as I18nRecord)[
            OUTCOME_PREPARE_SERVICE_V2
          ] as string,
          icon: HiOutlineArrowLeft,
        },
      ],
    );
  } else if (taskType === TYPE_WFSHIP2_MONITOR_TRIP_TASK) {
    otherOptions.push(
      ...[
        {
          id: OUTCOME_MISSION_CONTROL_V2,
          label: (dict.outcome as I18nRecord)[
            OUTCOME_MISSION_CONTROL_V2
          ] as string,
          icon: HiOutlineArrowLeft,
        },
      ],
    );
  } else if (
    taskType === TYPE_WFSHIP2_CLOSE_MONITORING_TASK ||
    taskType === TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK
  ) {
    otherOptions.push(
      ...[
        {
          id: OUTCOME_MONITOR_TRIP_V2,
          label: (dict.outcome as I18nRecord)[
            OUTCOME_MONITOR_TRIP_V2
          ] as string,
          icon: HiOutlineArrowLeft,
        },
      ],
    );
  } /* else if (taskType === TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK) {
    otherOptions.push(
      ...[
        {
          id: OUTCOME_CONFIRM_DELIVERY_V2,
          label: (dict.outcome as I18nRecord)[
            OUTCOME_RECEIVE_DELIVERY_V2
          ] as string,
          icon: HiOutlineArrowLeft,
        },
      ],
    );
  } else if (taskType === TYPE_WFDELIVERY_NOTIFY_TMS_ARRIVAL_TASK) {
    otherOptions.push(
      ...[
        {
          id: OUTCOME_NOTIFY_TMS_ARRIVAL_V2,
          label: (dict.outcome as I18nRecord)[
            OUTCOME_NOTIFY_TMS_ARRIVAL_V2
          ] as string,
          icon: HiOutlineArrowLeft,
        },
      ],
    );
  } */
  otherOptions.push(
    ...[
      {
        id: OUTCOME_OVERLORD_CANCELED_V2,
        label: (dict.outcome as I18nRecord).canceled as string,
        icon: HiOutlineArrowLeft,
      },
      {
        id: OUTCOME_OVERLORD_ANULLED_V2,
        label: (dict.outcome as I18nRecord).annulled as string,
        icon: HiTrash,
      },
    ],
  );
  return otherOptions;
};

/* ------------------------------------------------------------- */
/* Delivery Process */
/* ------------------------------------------------------------- */

export const TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK: DeliveryProcessForms =
  "wfship2:confirmDeliveryTask";

export const TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK: DeliveryProcessForms =
  "wfship2:receiveDeliveryTask";

export const TYPE_WFDELIVERY_NOTIFY_TMS_ARRIVAL_TASK: DeliveryProcessForms =
  "wfship2:notifyTMSArrivalTask";

export const TYPE_WFDELIVERY_NOTIFY_TMS_DELIVERY_TASK: DeliveryProcessForms =
  "wfship2:notifyTMSDeliveryTask";

export const TASK_CONFIRM_DELIVERY_V2: DeliveryProcessTask = "confirmDelivery";

export const TASK_RECEIVE_DELIVERY: DeliveryProcessTask = "receiveDelivery";

export const TASK_NOTIFY_TMS_ARRIVAL: DeliveryProcessTask = "notifyTMSArrival";

export const TASK_NOTIFY_TMS_DELIVERY: DeliveryProcessTask =
  "notifyTMSDelivery";

export const OUTCOME_TO_CONFIRM_DELIVERY_V2: TaskOutcomeDelivery =
  "Recibir Entrega";

export const OUTCOME_CONFIRM_DELIVERY_V2: TaskOutcomeDelivery =
  "Confirmar Entrega";

export const OUTCOME_TO_RECEIVE_DELIVERY_V2: TaskOutcomeDelivery =
  "Notificar Arribo (4.7)";

export const OUTCOME_RECEIVE_DELIVERY_V2: TaskOutcomeDelivery =
  "Recibir Entrega";

export const OUTCOME_TO_NOTIFY_TMS_ARRIVAL_V2: TaskOutcomeDelivery =
  "Notificar Entrega (5.11)";

export const OUTCOME_NOTIFY_TMS_ARRIVAL_V2: TaskOutcomeDelivery =
  "Notificar Arribo (4.7)";

export const OUTCOME_NOTIFY_TMS_DELIVERY_V2: TaskOutcomeDelivery =
  "Notificar Entrega (5.11)";

export const DELIVERY_COORDINATOR_PROCESS_TASKS: DeliveryProcessTask[] = [
  TASK_CONFIRM_DELIVERY_V2,
  TASK_RECEIVE_DELIVERY,
  TASK_NOTIFY_TMS_ARRIVAL,
  TASK_NOTIFY_TMS_DELIVERY,
];
