export type TaskResponse = {
  data: Task[];
  paging: Paging;
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
