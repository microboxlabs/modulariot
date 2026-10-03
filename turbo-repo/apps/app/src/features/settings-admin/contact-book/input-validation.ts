/**
 * Same confirmation the dashlet Handlebars inputs use (`getFlowbiteColor`):
 * a Flowbite TextInput `color` — gray while empty, green when the value is
 * valid, red when it's filled in but not valid.
 */
export type InputValidationColor = "gray" | "success" | "failure";

export function inputValidationColor(value: string, isValid: boolean): InputValidationColor {
  if (!value.trim()) return "gray";
  return isValid ? "success" : "failure";
}
