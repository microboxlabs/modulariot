import {
  SelectOption,
  SelectConfig,
  SelectOptionsConfig,
  TaskFormsConfig,
  TaskFormConfig,
  CustomFormConfig,
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
  OUTCOME_MONITOR_TRIP_V2,
} from "../../services/form.service";

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
  "wfship:sovosDigitalSignature": {
    [OUTCOME_REDIRECT_TO_MISSION_CONTROL]: createConfig(
      DIGITAL_SIGNATURE_OPTIONS,
      "FINGERPRINT_DEVICES_TECH_ISSUES"
    ),
  },
  "wfship:missionControlTripInitTask": {
    [OUTCOME_RETURN_TO_TRANSPORT_VALIDATION]: commonValidationConfig,
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

// ETA Mode options for Monitor Trip Task
const ETA_MODE_OPTIONS = [
  { value: "calculated", labelKey: "etaModeCalculated" },
  { value: "manual", labelKey: "etaModeManual" },
];

// Manual ETA Reasons
const MANUAL_ETA_REASON_OPTIONS = [
  { value: "DESTINATION_SCHEDULE_RESTRICTIONS", labelKey: "manualEtaReasonDestinationSchedule" },
  { value: "WEEKEND_OR_HOLIDAY", labelKey: "manualEtaReasonWeekendHoliday" },
  { value: "AUTHORIZED_OVERNIGHT_WITH_CARGO", labelKey: "manualEtaReasonAuthorizedOvernight" },
  { value: "OTHER", labelKey: "manualEtaReasonOther" },
];

// Custom form configuration for Monitor Trip Task
const MONITOR_TRIP_CUSTOM_FORM: CustomFormConfig = {
  fields: [
    {
      name: "mintral_etaMode",
      labelKey: "etaModeLabel",
      type: "select",
      required: true,
      defaultValue: "calculated",
      options: ETA_MODE_OPTIONS,
    },
    {
      name: "mintral_calculatedEta",
      labelKey: "calculatedEtaLabel",
      type: "live",
      dependsOn: {
        fieldName: "mintral_etaMode",
        value: "calculated",
      },
      liveField: {
        dataKey: "eta",
        displayFormat: "datetime",
        dependencies: ["mintral_originDelegateCode", "mintral_destinationDelegateCode"],
      },
    },
    {
      name: "mintral_estimatedArrivalDate",
      labelKey: "estimatedArrivalDateLabel",
      type: "datetime-local",
      required: true,
      dependsOn: {
        fieldName: "mintral_etaMode",
        value: "manual",
      },
      useCalculatedValueFrom: "mintral_calculatedEta",
    },
    {
      name: "mintral_manualEtaReason",
      labelKey: "manualEtaReasonLabel",
      type: "select",
      required: true,
      defaultValue: "DESTINATION_SCHEDULE_RESTRICTIONS",
      options: MANUAL_ETA_REASON_OPTIONS,
      dependsOn: {
        fieldName: "mintral_etaMode",
        value: "manual",
      },
    },
    {
      name: "mintral_manualEtaReasonOther",
      labelKey: "manualEtaReasonOtherLabel",
      type: "textarea",
      required: true,
      placeholder: "Describe the reason...",
      dependsOn: {
        fieldName: "mintral_manualEtaReason",
        value: "OTHER",
      },
    },
  ],
};

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
      customFormConfig: MONITOR_TRIP_CUSTOM_FORM,
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
