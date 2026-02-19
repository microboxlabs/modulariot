import type { DynamicFormConfig } from "@/features/dynamic-forms";

// Curated IANA timezone list (Latin America–focused + UTC + common EU/US)
export const TIMEZONE_OPTIONS = [
  { value: "UTC", labelKey: "UTC" },
  { value: "America/Santiago", labelKey: "America/Santiago" },
  { value: "America/Argentina/Buenos_Aires", labelKey: "America/Argentina/Buenos_Aires" },
  { value: "America/Bogota", labelKey: "America/Bogota" },
  { value: "America/Lima", labelKey: "America/Lima" },
  { value: "America/Sao_Paulo", labelKey: "America/Sao_Paulo" },
  { value: "America/Mexico_City", labelKey: "America/Mexico_City" },
  { value: "America/New_York", labelKey: "America/New_York" },
  { value: "America/Los_Angeles", labelKey: "America/Los_Angeles" },
  { value: "Europe/London", labelKey: "Europe/London" },
  { value: "Europe/Madrid", labelKey: "Europe/Madrid" },
];

/**
 * Form config for creating a calendar.
 * labelKeys are relative to the full calendar dict (e.g. tr("create.nameLabel", calendarDict)).
 * The "groups" field is rendered as a custom GroupAutocompleteField in the modal.
 */
export const CREATE_CALENDAR_FORM_CONFIG: DynamicFormConfig = {
  fields: [
    {
      name: "name",
      labelKey: "create.nameLabel",
      type: "text",
      required: true,
      placeholder: "Loading Dock South",
    },
    {
      name: "code",
      labelKey: "create.codeLabel",
      type: "text",
      required: true,
      placeholder: "loadingdocksouth",
      readonly: true,
    },
    {
      name: "description",
      labelKey: "create.descriptionLabel",
      type: "textarea",
      placeholder: "Scheduling calendar for Loading Dock South",
    },
    {
      name: "timezone",
      labelKey: "create.timezoneLabel",
      type: "select",
      required: true,
      defaultValue: "America/Santiago",
      options: TIMEZONE_OPTIONS,
    },
    {
      name: "active",
      labelKey: "create.activeLabel",
      type: "checkbox",
      defaultValue: true,
    },
  ],
};

/**
 * Normalize a name to a valid calendar/group code:
 * lowercase, alphanumeric only, max 15 chars.
 */
export function normalizeCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 15);
}
