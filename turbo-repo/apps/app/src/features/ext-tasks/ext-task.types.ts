export interface ExternalTask {
  taskType: string;
  payload: Record<string, unknown>;
  expiresAt: string; // ISO date
}

export type TaskExecutionStatus =
  | "completed"
  | "already_completed"
  | "expired"
  | "invalid"
  | "error";

export interface TaskExecutionResult {
  status: TaskExecutionStatus;
  message?: string;
}
