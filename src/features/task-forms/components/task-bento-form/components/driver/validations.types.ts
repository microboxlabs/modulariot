export type ValidationStatus = "ok" | "error" | "not_found";

export interface ValidationItem {
  key: string;
  status: ValidationStatus;
  label: string;
  group?: string;
}

export interface ValidationsInfoProps {
  task: any;
  msg: any;
}

// Types for the actual validation response structure
export interface ValidationData {
  description: string;
  value: number;
  name: string;
}

export interface ValidationGroup {
  validations: ValidationData[];
  group: string;
}

export interface ServiceValidationData {
  validations: ValidationGroup[];
  scopeId: string;
  scope: string;
}
