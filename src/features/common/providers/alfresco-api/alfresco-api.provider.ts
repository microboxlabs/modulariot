import {
  AlfrescoApi,
  PeopleApi,
  NodesApi,
  PersonEntry,
  GroupsApi,
  NodeChildAssociationPaging,
} from "@alfresco/js-api";
import type {
  EndTaskResponse,
  FastTasksResponse,
  FinishedWorkflowsRequest,
  FinishedWorkflowsResponse,
  HistoricalWorkflow,
  NodeChildrenRequest,
  ServiceValidationResponse,
  SympthomTemplateResponse,
  TaskCountResponse,
  TaskResponse,
  UploadNodeRequest,
  UserState,
  ValidationsResponse,
} from "./alfresco-api.types";
import fetcher from "../fetcher";
import { GetEntityInfoResponse } from "../microboxlabs-api/microboxlabs-api.types";
import type { Session } from "next-auth";

/**
 * Prepares authentication configuration for Alfresco API calls
 * @param baseUrl - The base URL for the API endpoint
 * @param session - The user session containing authentication data
 * @returns Object containing the modified URL and headers for authentication
 */
export function prepareAlfrescoAuth(
  baseUrl: string,
  session: Session,
  contentType: string = "application/json",
): {
  url: string;
  headers: Record<string, string>;
} {
  let url = baseUrl;
  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };

  if (session.user?.rawJWT) {
    headers["Authorization"] = `Bearer ${session.user.rawJWT}`;
  } else if (session.user?.ticket) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    url = `${baseUrl}${separator}alf_ticket=${session.user.ticket}`;
  }

  return { url, headers };
}

export function prepareAlfrescoAuthWithAccessToken(session: Session): void {
  var idToken = session.user?.rawJWT;
  if (idToken) {
    alfrescoApi.config.accessToken = idToken;
  } else {
    alfrescoApi.setTicket(session.user?.ticket ?? "", "");
  }
}

export const alfrescoApi = new AlfrescoApi({
  hostEcm: process.env.ECM_API_URL,
  provider: process.env.AUTH_PROVIDER,
  contextRoot: process.env.CONTEXT_ROOT,
});

export async function getUserProfile(
  session: Session,
  userId: string = "-me-",
): Promise<PersonEntry> {
  prepareAlfrescoAuthWithAccessToken(session);
  const peopleApi = new PeopleApi(alfrescoApi.contentClient);
  return peopleApi.getPerson(userId);
}

export async function getBase64UserAvatar(
  session: Session,
  userId = "-me-",
): Promise<string> {
  prepareAlfrescoAuthWithAccessToken(session);
  const peopleApi = new PeopleApi(alfrescoApi.contentClient);
  const blob = await peopleApi.getAvatarImage(userId, {
    placeholder: true,
    attachment: true,
  });

  const buffer = Buffer.from(await new Response(blob).arrayBuffer());
  return "data:image/png;base64," + buffer.toString("base64");
}

export async function getUserTasks(
  session: Session,
  definitionKey: string,
  options: {
    from?: number;
    size?: number;
    filter?: Record<string, unknown>;
  } = {},
): Promise<FastTasksResponse> {
  const { from = 0, size = 100, filter = undefined } = options;
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      size,
      definitionKey: definitionKey.length == 0 ? undefined : definitionKey,
      filter,
    }),
  });

  return result as FastTasksResponse;
}

export async function getTaskById(
  session: Session,
  taskId: string,
): Promise<TaskResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/details`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ taskId }),
  });
  return result as TaskResponse;
}

export async function endTask(
  session: Session,
  taskId: string,
  transitionId?: string,
): Promise<EndTaskResponse> {
  let baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/end?taskId=${taskId}`;
  if (transitionId) {
    baseUrl += `&transition=${transitionId}`;
  }
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ taskId }),
  });
  return result as EndTaskResponse;
}

function uploadNodeFormData(request: UploadNodeRequest): FormData {
  const formdata = new FormData();
  formdata.append("filedata", request.filedata);
  if (request.filename) {
    formdata.append("filename", request.filename);
  }
  if (request.siteId) {
    formdata.append("siteId", request.siteId);
  }
  if (request.containerId) {
    formdata.append("containerId", request.containerId);
  }
  if (request.destination) {
    formdata.append("destination", request.destination);
  }
  if (request.uploadDirectory) {
    formdata.append("uploadDirectory", request.uploadDirectory);
  }
  if (request.updateNodeRef) {
    formdata.append("updateNodeRef", request.updateNodeRef);
  }
  if (request.description) {
    formdata.append("description", request.description);
  }
  if (request.contentType) {
    formdata.append("contentType", request.contentType);
  }
  if (request.aspects) {
    formdata.append("aspects", request.aspects.join(","));
  }
  if (request.majorVersion) {
    formdata.append("majorVersion", request.majorVersion.toString());
  }
  if (request.overwrite) {
    formdata.append("overwrite", request.overwrite.toString());
  }
  if (request.thumbnails) {
    formdata.append("thumbnails", request.thumbnails.join(","));
  }
  if (request.updateNameAndMimetype) {
    formdata.append(
      "updateNameAndMimetype",
      request.updateNameAndMimetype.toString(),
    );
  }
  if (request.createdDirectory) {
    formdata.append("createdDirectory", request.createdDirectory.toString());
  }
  if (request.prop_mintral_contentType) {
    formdata.append(
      "prop_mintral_contentType",
      request.prop_mintral_contentType,
    );
  }
  return formdata;
}

export async function uploadNodeContent(
  session: Session,
  request: UploadNodeRequest,
): Promise<string> {
  const formdata = uploadNodeFormData(request);
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/api/upload`;
  const { url, headers } = prepareAlfrescoAuth(
    baseUrl,
    session,
    "multipart/form-data",
  );
  const result = await fetcher(url, {
    method: "POST",
    headers,
    body: formdata,
  });
  return result as string;
}

export async function getChildrenNodes(
  session: Session,
  nodeId: string,
  options: NodeChildrenRequest,
): Promise<NodeChildAssociationPaging> {
  prepareAlfrescoAuthWithAccessToken(session);
  const nodesApi = new NodesApi(alfrescoApi.contentClient);
  const children = await nodesApi.listNodeChildren(nodeId, options);
  return children;
}

export async function getContentNode(
  session: Session,
  nodeId: string,
): Promise<string> {
  prepareAlfrescoAuthWithAccessToken(session);
  const nodesApi = new NodesApi(alfrescoApi.contentClient);
  const blob = await nodesApi.getNodeContent(nodeId);
  const buffer = Buffer.from(await new Response(blob).arrayBuffer());
  return buffer.toString("base64");
}
// Define el tipo Validations si no está definido
interface Validations {
  check1: boolean;
  check2: boolean;
  check3: boolean;
  check4: boolean;
}

export async function validateService(
  session: Session,
  serviceCode: string,
): Promise<Validations> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/service/validation`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  // Llamada a la API para validar el servicio
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ serviceCode }),
  });

  return result as Validations; // Asegúrate de que 'result' tenga el tipo correcto
}

export async function getContentByTaskId(
  session: Session,
  taskId: string,
  fileName: string,
  requireInternalSign: boolean = false,
): Promise<string> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/node/content`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = (await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ taskId, fileName, signed: requireInternalSign }),
  })) as { node: { id: string } };
  const nodesApi = new NodesApi(alfrescoApi.contentClient);
  const blob = await nodesApi.getNodeContent(result.node.id);
  const buffer = Buffer.from(await new Response(blob).arrayBuffer());
  return buffer.toString("base64");
}

export async function getCountTask(
  session: Session,
): Promise<TaskCountResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/statistics/tasks`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "POST",
    headers,
  });
  return result as TaskCountResponse;
}

export async function formProcessor(
  session: Session,
  itemKind: string,
  itemId: string,
  data: Record<string, unknown>,
): Promise<TaskResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/api/${itemKind}/${itemId}/formprocessor`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  return result as TaskResponse;
}

export async function updateTask(
  session: Session,
  taskId: string,
  data: Record<string, unknown>,
): Promise<TaskResponse> {
  return formProcessor(session, "task", taskId, data);
}

export async function getServiceValidation(
  session: Session,
  serviceCode: string,
): Promise<ServiceValidationResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/service/validation`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ serviceCode }),
  });
  return result as ServiceValidationResponse;
}

export async function getFinishedWorkflows(
  session: Session,
  data: FinishedWorkflowsRequest,
): Promise<FinishedWorkflowsResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/finished/workflows`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  return result as FinishedWorkflowsResponse;
}

export async function getFinishedWorkflowByInstanceId(
  session: Session,
  data: string,
): Promise<HistoricalWorkflow> {
  prepareAlfrescoAuthWithAccessToken(session);
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/finished/workflow/details`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ instanceId: data }),
  });

  return result as HistoricalWorkflow;
}

export async function checkDocumentExists(
  session: Session,
  nodeId: string,
): Promise<boolean> {
  try {
    prepareAlfrescoAuthWithAccessToken(session);
    const nodesApi = new NodesApi(alfrescoApi.contentClient);

    // This will throw an error if the node doesn't exist
    const node = await nodesApi.getNode(nodeId);
    return node && node?.entry?.isFile;
  } catch (error) {
    // just ignore and return false
  }
  return false;
}

export async function getUserStatus(session: Session): Promise<string> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/api/activities/feed/user`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ format: "json" }),
  });
  return result as string;
}

export async function getSympthomTemplate(
  session: Session,
  serviceCode: string,
  conditionName: string,
  icuCode: string,
): Promise<SympthomTemplateResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/service/message-template`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ serviceCode, conditionName, icuCode }),
  });
  return result as SympthomTemplateResponse;
}

export async function getUserStates(session: Session): Promise<UserState[]> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/operator-status`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "GET",
    headers,
  });
  return result as UserState[];
}

export async function getTaskHistory(
  session: Session,
  taskId: string,
  active: boolean = true,
): Promise<TaskResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/history`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ taskId, active }),
  });

  return result as TaskResponse;
}

export async function getTripLoads(
  session: Session,
  tripId: string,
): Promise<TaskResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/service/mintral/service/letter-port`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ tripId }),
  });

  return result as any;
}

export async function getGroupsForPerson(session: Session): Promise<string[]> {
  prepareAlfrescoAuthWithAccessToken(session);
  const groupsApi = new GroupsApi(alfrescoApi.contentClient);
  const groups = await groupsApi.listGroupMembershipsForPerson("-me-");
  return groups.list?.entries?.map(({ entry }) => entry.id!) ?? [];
}

export async function getInfoEntity(
  session: Session,
  licencePlate: string,
): Promise<GetEntityInfoResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/service/mintral/service/last-info-gps-service`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ licencePlate }),
  });

  return result as GetEntityInfoResponse;
}

export async function getBiometricVerification(
  data: Record<string, unknown>,
): Promise<TaskResponse> {
  const url = `${process.env.ECM_API_URL}/alfresco/service/public/biometric/verification`;

  const result = await fetcher(url, {
    method: "POST",
    body: JSON.stringify(data),
  });

  return result as any;
}

export async function getSovosFingerprintReuse(
  session: Session,
  data: Record<string, unknown>,
): Promise<TaskResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/service/sovos/fingerprint-reuse`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  return result as any;
}

export async function getNotifications(session: Session) {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/notifications`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
  });
  return result as any;
}

export async function markAsRead(session: Session, id: string) {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/notifications/mark-as-read`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ id }),
  });

  return result as any;
}

export async function getTaskByLicensePlate(
  session: Session,
  data: Record<string, unknown>,
): Promise<any> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/history-filter`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  return result as any;
}

export async function ecmSovosDec5(
  session: Session,
  taskId: string,
): Promise<any> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/sign/sovos-dec5?taskId=${taskId}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });

  return result as any;
}

export async function getValidationByServiceCode(
  session: Session,
  serviceCode: string,
  scope?: string,
  scopeId?: string,
): Promise<ValidationsResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/service/validation`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  if (scope && scopeId) {
    return fetcher(url, {
      method: "GET",
      headers,
      body: JSON.stringify({ serviceCode, scope, scopeId }),
    }) as Promise<ValidationsResponse>;
  }

  return fetcher(url, {
    method: "GET",
    headers,
    body: JSON.stringify({ serviceCode }),
  }) as Promise<ValidationsResponse>;
}
