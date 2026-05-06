import {
  SelectOption,
  SelectConfig,
  SelectOptionsConfig,
  TaskFormsConfig,
  TaskFormConfig,
} from "./task-confirm-modal.types";
import {
  OUTCOME_ASSIGN_DRIVER_V2,
  OUTCOME_OVERLORD_CANCELED_SOVOS_V2,
  OUTCOME_OVERLORD_REQUIRED_V2,
  OUTCOME_PREPARE_SERVICE_V2,
  OUTCOME_PRESENT_DRIVER_V2,
  OUTCOME_REDIRECT_TO_MISSION_CONTROL,
  OUTCOME_RETURN_TO_TRANSPORT_VALIDATION,
  TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK,
  TYPE_WFSHIP2_MISSION_CONTROL_TASK,
  TYPE_WFSHIP2_MONITOR_TRIP_TASK,
  TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK,
  OUTCOME_MONITOR_TRIP_V2,
  TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK,
} from "../../services/form.service";
// Import shared ETA form configuration - single source of truth
import { ETA_EDIT_FORM_CONFIG } from "../eta-edit-modal/eta-edit-modal.config";

const option = (value: string, labelKey: string): SelectOption  => ({
  value,
  labelKey,
});

const optionDesc = (value: string, labelKey: string, descriptionKey: string): SelectOption => ({
  value,
  labelKey,
  descriptionKey,
});

const MISSION_CONTROL_OPTIONS: SelectOption[] = [
  ["NO_GPS_VALIDATION", "missionControlTripInitTaskReason1"],
  ["NO_DOCUMENT_CONSOLIDATION", "missionControlTripInitTaskReason2"],
  ["NO_CLIENT_SYSTEM_VALIDATION", "missionControlTripInitTaskReason3"],
  ["OTHER", "missionControlTripInitTaskReason4"],
].map(([value, labelKey]) => option(value, labelKey));

const POD_REJECTION_OPTIONS: SelectOption[] = [
  ["NOT_VALID_DOCUMENT", "PODReason1"],
  ["ID_RECEPTOR_MISSING", "PODReason2"],
  ["INCOMPLETE_POD", "PODReason3"],
  ["OTHER", "PODReason4"],
].map(([value, labelKey]) => option(value, labelKey));

const DIGITAL_SIGNATURE_OPTIONS: SelectOption[] = [
  ["FINGERPRINT_DEVICES_TECH_ISSUES", "reason1"],
  ["COMPUTER_TECH_ISSUES", "reason2"],
  ["DRIVER_FINGERPRINT_NOT_RECOGNIZED", "reason3"],
  ["DISPATCHER_NOT_ENROLLED", "reason4"],
  ["DISPATCHER_FINGERPRINT_NOT_RECOGNIZED", "reason5"],
  ["AUTHORIZED_BY_TRANSPORT_OVERLORD", "reason6"],
  ["OTHER", "reason7"],
].map(([value, labelKey]) => option(value, labelKey));

const PREPARE_SERVICE_OPTIONS: SelectOption[] = [
  // Image rejection reasons
  [ "REJECTED_GUIDE", "rejectedGuide", "rejectedGuideDesc"],
  [ "REJECTED_LEFT_SIDE", "rejectedLeftSide", "rejectedLeftSideDesc"],
  [ "REJECTED_RIGHT_SIDE", "rejectedRightSide", "rejectedRightSideDesc"],
  [ "REJECTED_FRONT", "rejectedFront", "rejectedFrontDesc"],
  [ "REJECTED_BACK", "rejectedBack", "rejectedBackDesc"],
  // Technical reasons
  [ "NO_GPS_VALIDATION", "missionControlTripInitTaskReason1", "noGpsValidationDesc"],
  [ "NO_DOCUMENT_CONSOLIDATION", "missionControlTripInitTaskReason2", "noDocumentConsolidationDesc"],
  [ "NO_CLIENT_SYSTEM_VALIDATION", "missionControlTripInitTaskReason3", "noClientSystemValidationDesc"],
  [ "OTHER", "missionControlTripInitTaskReason4", "otherReasonDesc"],
].map(([value, labelKey, descriptionKey]) => optionDesc(value, labelKey, descriptionKey));

// Helper function to create simple config - keeping it performative
const createConfig = (
  options: SelectOption[],
  defaultValue: string | string[],
  multiSelect = false,
  triggerText?: string
): SelectConfig => ({
  options,
  defaultValue,
  ...(multiSelect && { multiSelect, triggerText }),
});

const commonValidationConfig = createConfig(
  MISSION_CONTROL_OPTIONS,
  "NO_GPS_VALIDATION"
);

// Simplified configuration structure - performative and DRY
export const SELECT_OPTIONS_CONFIG: SelectOptionsConfig = {
  [TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK]: {
    [OUTCOME_OVERLORD_CANCELED_SOVOS_V2]: createConfig(
      POD_REJECTION_OPTIONS,
      "NOT_VALID_DOCUMENT"
    ),
  },
  [TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK]: {
    [OUTCOME_OVERLORD_CANCELED_SOVOS_V2]: createConfig(
      POD_REJECTION_OPTIONS,
      "NOT_VALID_DOCUMENT"
    ),
  },
  [TYPE_WFSHIP2_MISSION_CONTROL_TASK]: {
    [OUTCOME_ASSIGN_DRIVER_V2]: commonValidationConfig,
    [OUTCOME_PRESENT_DRIVER_V2]: commonValidationConfig,
    [OUTCOME_OVERLORD_REQUIRED_V2]: commonValidationConfig,
    [OUTCOME_PREPARE_SERVICE_V2]: createConfig(
      PREPARE_SERVICE_OPTIONS,
      [],
      true,
      "Seleccionar motivos de rechazo"
    ),
  },
};

// Utility function to get select configuration
export function getSelectConfig(
  taskType?: string,
  outcome?: string
): SelectConfig | null {
  if (!taskType || !outcome) return null;
  return SELECT_OPTIONS_CONFIG[taskType]?.[outcome] || null;
}

/* ------------------------------------------------------------- */
/* Task Forms Configuration (with custom form fields) */
/* ------------------------------------------------------------- */

// ETA form configuration is imported from eta-edit-modal.config.ts
// This ensures the ETA form is consistent across all places it's used:
// - ETAEditModal (standalone ETA editing)
// - TaskConfirmModal (Monitor Trip transition)

// New unified configuration that supports both select configs and custom forms
export const TASK_FORMS_CONFIG: TaskFormsConfig = {
  // Existing select-only configs migrated
  [TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK]: {
    [OUTCOME_OVERLORD_CANCELED_SOVOS_V2]: {
      selectConfig: SELECT_OPTIONS_CONFIG[TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK]?.[OUTCOME_OVERLORD_CANCELED_SOVOS_V2],
    },
  },
  "wfship:sovosDigitalSignature": {
    [OUTCOME_REDIRECT_TO_MISSION_CONTROL]: {
      selectConfig: SELECT_OPTIONS_CONFIG["wfship:sovosDigitalSignature"]?.[OUTCOME_REDIRECT_TO_MISSION_CONTROL],
    },
  },
  "wfship:missionControlTripInitTask": {
    [OUTCOME_RETURN_TO_TRANSPORT_VALIDATION]: {
      selectConfig: SELECT_OPTIONS_CONFIG["wfship:missionControlTripInitTask"]?.[OUTCOME_RETURN_TO_TRANSPORT_VALIDATION],
    },
  },
  [TYPE_WFSHIP2_MISSION_CONTROL_TASK]: {
    [OUTCOME_ASSIGN_DRIVER_V2]: {
      selectConfig: SELECT_OPTIONS_CONFIG[TYPE_WFSHIP2_MISSION_CONTROL_TASK]?.[OUTCOME_ASSIGN_DRIVER_V2],
    },
    [OUTCOME_PRESENT_DRIVER_V2]: {
      selectConfig: SELECT_OPTIONS_CONFIG[TYPE_WFSHIP2_MISSION_CONTROL_TASK]?.[OUTCOME_PRESENT_DRIVER_V2],
    },
    [OUTCOME_OVERLORD_REQUIRED_V2]: {
      selectConfig: SELECT_OPTIONS_CONFIG[TYPE_WFSHIP2_MISSION_CONTROL_TASK]?.[OUTCOME_OVERLORD_REQUIRED_V2],
    },
    [OUTCOME_PREPARE_SERVICE_V2]: {
      selectConfig: SELECT_OPTIONS_CONFIG[TYPE_WFSHIP2_MISSION_CONTROL_TASK]?.[OUTCOME_PREPARE_SERVICE_V2],
    },
    [OUTCOME_MONITOR_TRIP_V2]: {
      customFormConfig: ETA_EDIT_FORM_CONFIG,
    },
  },
  [TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK]: {
    [OUTCOME_MONITOR_TRIP_V2]: {
      customFormConfig: ETA_EDIT_FORM_CONFIG,
    },
  },
  // New Monitor Trip Task with custom form
  // [TYPE_WFSHIP2_MISSION_CONTROL_TASK]: {
  //   [OUTCOME_MONITOR_TRIP_V2]: {
  //     customFormConfig: MONITOR_TRIP_CUSTOM_FORM,
  //   },
  // },
};

// Utility function to get task form configuration
export function getTaskFormConfig(
  taskType?: string,
  outcome?: string
): TaskFormConfig | null {
  if (!taskType || !outcome) return null;
  return TASK_FORMS_CONFIG[taskType]?.[outcome];
}
