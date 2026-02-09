import { DynamicFormConfig } from "@/features/dynamic-forms";

// ETA Mode options
export const ETA_MODE_OPTIONS = [
  { value: "calculated", labelKey: "etaModeCalculated" },
  { value: "manual", labelKey: "etaModeManual" },
];

// Manual ETA Reasons
export const MANUAL_ETA_REASON_OPTIONS = [
  { value: "DESTINATION_SCHEDULE_RESTRICTIONS", labelKey: "manualEtaReasonDestinationSchedule" },
  { value: "WEEKEND_OR_HOLIDAY", labelKey: "manualEtaReasonWeekendHoliday" },
  { value: "AUTHORIZED_OVERNIGHT_WITH_CARGO", labelKey: "manualEtaReasonAuthorizedOvernight" },
  { value: "OTHER", labelKey: "manualEtaReasonOther" },
];

/**
 * Form configuration for ETA editing.
 * Reuses the same structure as TaskConfirmModal custom forms.
 */
export const ETA_EDIT_FORM_CONFIG: DynamicFormConfig = {
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

