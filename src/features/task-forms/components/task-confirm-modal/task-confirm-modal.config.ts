import {
  SelectOption,
  SelectConfig,
  SelectOptionsConfig,
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
} from "../../services/form.service";

// Common option sets - extracted to eliminate duplication
const MISSION_CONTROL_OPTIONS: SelectOption[] = [
  {
    value: "NO_GPS_VALIDATION",
    labelKey: "missionControlTripInitTaskReason1",
  },
  {
    value: "NO_DOCUMENT_CONSOLIDATION",
    labelKey: "missionControlTripInitTaskReason2",
  },
  {
    value: "NO_CLIENT_SYSTEM_VALIDATION",
    labelKey: "missionControlTripInitTaskReason3",
  },
  { value: "OTHER", labelKey: "missionControlTripInitTaskReason4" },
];

const POD_REJECTION_OPTIONS: SelectOption[] = [
  { value: "NOT_VALID_DOCUMENT", labelKey: "PODReason1" },
  { value: "ID_RECEPTOR_MISSING", labelKey: "PODReason2" },
  { value: "INCOMPLETE_POD", labelKey: "PODReason3" },
  { value: "OTHER", labelKey: "PODReason4" },
];

const DIGITAL_SIGNATURE_OPTIONS: SelectOption[] = [
  { value: "FINGERPRINT_DEVICES_TECH_ISSUES", labelKey: "reason1" },
  { value: "COMPUTER_TECH_ISSUES", labelKey: "reason2" },
  { value: "DRIVER_FINGERPRINT_NOT_RECOGNIZED", labelKey: "reason3" },
  { value: "DISPATCHER_NOT_ENROLLED", labelKey: "reason4" },
  { value: "DISPATCHER_FINGERPRINT_NOT_RECOGNIZED", labelKey: "reason5" },
  { value: "AUTHORIZED_BY_TRANSPORT_OVERLORD", labelKey: "reason6" },
  { value: "OTHER", labelKey: "reason7" },
];

const PREPARE_SERVICE_OPTIONS: SelectOption[] = [
  // Image rejection reasons
  {
    value: "REJECTED_GUIDE",
    labelKey: "rejectedGuide",
    descriptionKey: "rejectedGuideDesc",
  },
  {
    value: "REJECTED_LEFT_SIDE",
    labelKey: "rejectedLeftSide",
    descriptionKey: "rejectedLeftSideDesc",
  },
  {
    value: "REJECTED_RIGHT_SIDE",
    labelKey: "rejectedRightSide",
    descriptionKey: "rejectedRightSideDesc",
  },
  {
    value: "REJECTED_FRONT",
    labelKey: "rejectedFront",
    descriptionKey: "rejectedFrontDesc",
  },
  {
    value: "REJECTED_BACK",
    labelKey: "rejectedBack",
    descriptionKey: "rejectedBackDesc",
  },
  // Technical reasons (reusing mission control options with descriptions)
  {
    value: "NO_GPS_VALIDATION",
    labelKey: "missionControlTripInitTaskReason1",
    descriptionKey: "noGpsValidationDesc",
  },
  {
    value: "NO_DOCUMENT_CONSOLIDATION",
    labelKey: "missionControlTripInitTaskReason2",
    descriptionKey: "noDocumentConsolidationDesc",
  },
  {
    value: "NO_CLIENT_SYSTEM_VALIDATION",
    labelKey: "missionControlTripInitTaskReason3",
    descriptionKey: "noClientSystemValidationDesc",
  },
  {
    value: "OTHER",
    labelKey: "missionControlTripInitTaskReason4",
    descriptionKey: "otherReasonDesc",
  },
];

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
    [OUTCOME_RETURN_TO_TRANSPORT_VALIDATION]: createConfig(
      MISSION_CONTROL_OPTIONS,
      "NO_GPS_VALIDATION"
    ),
  },
  [TYPE_WFSHIP2_MISSION_CONTROL_TASK]: {
    [OUTCOME_ASSIGN_DRIVER_V2]: createConfig(
      MISSION_CONTROL_OPTIONS,
      "NO_GPS_VALIDATION"
    ),
    [OUTCOME_PRESENT_DRIVER_V2]: createConfig(
      MISSION_CONTROL_OPTIONS,
      "NO_GPS_VALIDATION"
    ),
    [OUTCOME_OVERLORD_REQUIRED_V2]: createConfig(
      MISSION_CONTROL_OPTIONS,
      "NO_GPS_VALIDATION"
    ),
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
