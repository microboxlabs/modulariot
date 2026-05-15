/**
 * Dynamic Forms Module
 *
 * Configuration-driven form field system for building dynamic forms
 * from declarative configuration objects.
 *
 * @example
 * ```tsx
 * import {
 *   DynamicFormField,
 *   useDynamicFormState,
 *   type DynamicFormConfig,
 *   type DynamicFieldConfig,
 * } from "@/features/dynamic-forms";
 *
 * const myFormConfig: DynamicFormConfig = {
 *   fields: [
 *     { name: "username", labelKey: "usernameLabel", type: "text", required: true },
 *     { name: "role", labelKey: "roleLabel", type: "select", options: [...] },
 *   ],
 * };
 *
 * function MyForm({ isOpen }) {
 *   const { formValues, setFormValue, isFieldVisible } = useDynamicFormState(isOpen, myFormConfig);
 *
 *   return (
 *     <>
 *       {myFormConfig.fields.map((field) => (
 *         <DynamicFormField
 *           key={field.name}
 *           field={field}
 *           value={formValues[field.name]}
 *           onChange={(value) => setFormValue(field.name, value)}
 *           isVisible={isFieldVisible(field)}
 *           translate={(key) => t(key)}
 *         />
 *       ))}
 *     </>
 *   );
 * }
 * ```
 */

// Types
export type {
  DynamicFieldType,
  DynamicFieldOption,
  DynamicFieldConfig,
  DynamicFormConfig,
  DynamicFormValues,
  DisplayFormat,
  LiveFieldConfig,
  FieldDependency,
} from "./dynamic-form.types";

// Hooks
export { useDynamicFormState } from "./hooks";
export type { DynamicFormState } from "./hooks";

// Components
export {
  DynamicFormField,
  CustomFormField,
  DisplayField,
  LiveFormField,
} from "./components";
export type {
  DynamicFormFieldProps,
  DisplayFieldProps,
  LiveFormFieldProps,
  LiveDataHookResult,
} from "./components";
