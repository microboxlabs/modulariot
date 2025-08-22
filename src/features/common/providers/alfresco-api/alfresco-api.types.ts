export type TasksResponse = {
  data: Task[];
  paging: Paging;
};

export type FastTasksResponse = {
  tasks: { persistentState?: PersistentState } & Record<string, unknown>[];
  total: number;
};

export type UserState = {
  firstName: string;
  lastName: string;
  status: string;
  isTreating: boolean;
  icu_code: string;
  email: string;
  start_timestamp: string;
  end_timestamp: string;
  trip_id: string;
  symptom_name: string;
  username: string;
};

export type PersistentState = {
  processDefinitionId: string;
  durationInMillis: number;
  endStateName: string;
  deploymentId: string;
  processDefinitionName: string;
  endTime: string;
  processDefinitionVersion: number;
  processDefinitionKey: string;
};

export type TaskResponse = {
  initiator: string;
  bpm_assignee: string;
  bpm_sendEMailNotifications: boolean;
  bpm_workflowPriority: number;
  bpm_hiddenTransitions: string;
  workflowinstanceid: string;
  taskFormKey: string;
  id: string;
  bpm_package: string;
  bpm_packageItemActionGroup: string;
  mintral_trailerLicensePlate: string;
  initiatorhome: string;
  mintral_serviceType: string;
  cancelled: boolean;
  bpm_packageActionGroup: string;
  bpm_reassignable: boolean;
  bpm_priority: number;
  bpm_percentComplete: number;
  instanceId: string;
  bpm_workflowDescription: string;
  _startTaskCompleted: string;
  bpm_description: string;
  bpm_status: string;
  mintral_comments?: string | string[];
  mintral_hoReference?: string;
  [key: string]: unknown;
  mintral_serviceCode: string;
  bpm_outcome: string;
  persistentState: PersistentState;
  isEditable: boolean;
  takenBy?: string;
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
    totalTasks: number;
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

export type AlfrescoErrorResponse = {
  code: string;
  message: string;
  exceptionType: string;
  details: Record<string, unknown>;
};

export type UploadNodeRequest = {
  filename?: string;
  filedata: File;
  siteId?: string;
  containerId?: string;
  destination?: string;
  uploadDirectory?: string;
  updateNodeRef?: string;
  description?: string;
  contentType?: string;
  aspects?: string[];
  majorVersion?: boolean;
  overwrite?: boolean;
  thumbnails?: string[];
  updateNameAndMimetype?: boolean;
  createdDirectory?: boolean;
  prop_mintral_contentType?: string;
};

export type UploadNodeResponse = {
  status: {
    code: number;
    message?: string;
  };
  data?: Record<string, unknown>;
  [key: string]: unknown;
} | null;

export type FinishedWorkflowsResponse = {
  total: number;
  workflows: HistoricalWorkflow[];
};

export type FinishedWorkflowsRequest = {
  from: number;
  size: number;
  definitionKey?: string;
  filter: {
    mintralKey?: string;
    licensePlate?: string;
    driverId?: string;
    trailerLicensePlate?: string;
    carrierId?: string;
    carrierName?: string;
    origin?: string;
    destination?: string;
    customerCode?: string;
    clientAbbreviation?: string;
  };
};

export type HistoricalWorkflow = {
  deploymentId: string;
  durationInMillis: number;
  endActivityId: string;
  endTime: string;
  id: string;
  persistentState: {
    processDefinitionId: string;
    durationInMillis: number;
    endStateName: string;
    deploymentId: string;
    processDefinitionName: string;
    endTime: string;
    processDefinitionVersion: number;
    processDefinitionKey: string;
  };
  processDefinitionId: string;
  processDefinitionKey: string;
  processDefinitionName: string;
  processDefinitionVersion: number;
  processInstanceId: string;
  processVariables: Record<string, unknown>;
  startActivityId: string;
  startTime: string;
  startUserId: string;
  tenantId: string;
};

export type ServiceValidationResponse = {
  error?: string;
  message?: string;
  servicio?: string;
  v_03?: {
    v_03reg: number;
    v_03eval: number;
    v_03res: number;
    v_03type: string;
  };
  v_02?: {
    v_02reg: number;
    v_02eval: number;
    v_02res: number;
    v_02type: string;
  };
  v_01?: {
    v_01reg: number;
    v_01eval: number;
    v_01type: string;
    v_01res: number;
  };
  validations?: ValidationsResponseItem[];
};

export type DownloadDocumentResponse = {
  content: string;
};

export type VerifyDocumentResponse = {
  exists: boolean;
};

export type SympthomTemplateResponse = {
  data: SympthomTemplate;
  success: boolean;
};

export type SympthomTemplate = {
  icuCode: string;
  name: string;
  conditionName: string;
  message: string;
};

export type UserGroupsResponse = {
  data: string[];
};

export type NodesIncludeQuery = {
  include?: string[];
  fields?: string[];
};

export type ContentPagingQuery = {
  skipCount?: number;
  maxItems?: number;
};

export type NodeChildrenRequest = {
  orderBy?: string[];
  where?: string;
  relativePath?: string;
  includeSource?: boolean;
} & NodesIncludeQuery &
  ContentPagingQuery;

export type ValidationsResponse = {
  validations: ValidationsResponseItem[];
  scope: string;
  scopeId: string;
};

export type ValidationsResponseItem = {
  validations: ValidationResponseItem[];
  group: string;
};

export type ValidationResponseItem = {
  value: number;
  description: string;
  name: string;
};

// Forum types
export type ForumDiscussionResponse = {
  forum: string;
  topics: ForumTopic[];
};

export type ForumTopic = {
  ref: string;
  name: string;
  title: string;
  author: string;
  created: string;
  posts: ForumPost[];
};

export type ForumPost = {
  ref: string;
  name: string;
  title: string;
  author: string;
  created: string;
  content: string;
  replies: ForumReply[];
};

export type ForumReply = {
  ref: string;
  title: string;
  author: string;
  created: string;
};

export type MessageTemplate = {
  nodeRef: string;
  templateId: string;
  templateKind: string;
  engine: string;
  locale?: string;
  content?: string;
  name: string;
  created: string;
  modified: string;
};

export type MessageTemplatesResponse = {
  templates: MessageTemplate[];
};

export type WebhookDefinition = {
  nodeRef: string;
  templateId: string;
  webhookKind: string;
  templateWebhookUrl: string;
  templateRef?: string;
  created: string;
  modified: string;
};

export type WebhookDefinitionResponse = {
  webhookDefs: WebhookDefinition[];
};

export type CreateTemplateRequest = {
  site: string;
  kind: string;
  templateId: string;
  engineExt: string;
  content: string;
};

export type UpdateTemplateRequest = {
  template: string;
  content: string;
};

export type CreateWebhookRequest = {
  site: string;
  templateId: string;
  webhookUrl: string;
  webhookKind: string;
  template?: string;
};

export type UpdateWebhookRequest = {
  webhookDef: string;
  templateId?: string;
  webhookUrl?: string;
  webhookKind?: string;
  template?: string;
};
