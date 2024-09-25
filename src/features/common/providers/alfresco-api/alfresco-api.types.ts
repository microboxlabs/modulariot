export type TasksResponse = {
  data: Task[];
  paging: Paging;
};

export type FastTasksResponse = {
  tasks: Record<string, unknown>[];
  total: number;
};

export type TaskResponse = {
  data: Task;
};

export type Task = {
  id: string;
  url: string;
  name: string;
  title: string;
  description: string;
  state: string;
  path: string;
  isPooled: boolean;
  isEditable: boolean;
  isReassignable: boolean;
  isClaimable: boolean;
  isReleasable: boolean;
  outcome: string;
  owner: string;
  creator: string;
  properties: Record<string, unknown>;
  propertiesLabes: Record<string, string>;
  workflowInstance: WorkflowInstance;
};

export type Paging = {
  maxItems: number;
  skipCount: number;
  totalItems: number;
  totalItemsRangeEnd: number;
  confidence: string;
};

export type WorkflowInstance = {
  id: string;
  url: string;
  name: string;
  title: string;
  description: string;
  isActive: boolean;
  startDate: string;
  priority: number;
  dueDate?: string;
  endDate?: string;
  context: Record<string, unknown>;
  package: string;
  initiator: Initiator;
  definitionUrl: string;
};

export type Initiator = {
  userName: string;
  firstName: string;
  lastName: string;
};

export type EndTaskResponse = {
  id: string;
  transition: string;
};

export interface TaskCountResponse {
  totals: {
    totalTasks: number; // o cualquier otra propiedad que necesites
  };
}

export type TotalCount = {
  startevent1: number; //(Start): wfship:startEvent
  transportValidation: number; //(Validar Conductor / Transporte): wfship:transportValidationTask
  missionControlTripInit: number; //(Torre de Control: Iniciar Viaje): wfship:missionControlTripInitTask
  overlordTripInit: number; //(Overlord: Iniciar viaje (Confirmación)): wfship:overlordTripInitTask
  sovosDigitalSignature: number; //(Firma Digital Carta de Porte): wfship:sovosDigitalSignature
  tripOutsideInitiated: number; //(Iniciado Sin Coordinación): wfship:tripOutsideInitiatedTask
};
