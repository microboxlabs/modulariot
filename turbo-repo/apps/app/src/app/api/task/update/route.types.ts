export type UpdateTaskPropertiesRequest = {
  taskId: string;
  properties: Record<string, unknown>;
};

export type UpdateTaskPropertiesResponse = {
  success: boolean;
  error?: string;
  updatedProperties?: Record<string, unknown>;
};

