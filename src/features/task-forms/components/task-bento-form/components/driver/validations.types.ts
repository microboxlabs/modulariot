export type ValidationStatus =
  | "approved"
  | "alert"
  | "not_approved"
  | "pending";

export interface ValidationItem {
  key: string;
  status: ValidationStatus;
  label: string;
}

export interface ValidationsInfoProps {
  task: any;
  msg: any;
}
