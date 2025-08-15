import {
  AlfrescoApiClient,
  PersonEntry,
  NodeChildAssociationPaging,
  GroupPaging,
  NodeEntry,
} from "@alfresco/js-api";
import type {
  EndTaskResponse,
  FastTasksResponse,
  FinishedWorkflowsRequest,
  FinishedWorkflowsResponse,
  HistoricalWorkflow,
  NodeChildrenRequest,
  ForumDiscussionResponse,
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
  session?: Session,
  // contentType: string = "application/json",
): {
  url: string;
  headers: Record<string, string>;
} {
  let url = baseUrl;
  const headers: Record<string, string> = {
    // "Content-Type": contentType,
  };

  if (session?.user?.rawJWT) {
    headers["Authorization"] = `Bearer ${session.user.rawJWT}`;
  } else if (session?.user?.ticket) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    url = `${baseUrl}${separator}alf_ticket=${session.user.ticket}`;
  }

  return { url, headers };
}

export function prepareAlfrescoAuthWithAccessToken(session: Session): void {
  var idToken = session.user?.rawJWT;
  if (idToken) {
    alfrescoApi = new AlfrescoApiClient(process.env.ECM_API_URL);
  } else {
    alfrescoApi.config.ticket = session.user?.ticket ?? "";
  }
}

let alfrescoApi = new AlfrescoApiClient(process.env.ECM_API_URL);

export function getAlfrescoApi(): AlfrescoApiClient {
  return alfrescoApi;
}

export async function getUserProfile(
  session: Session,
  userId: string = "-me-",
): Promise<PersonEntry> {
  const queryParams = new URLSearchParams({
    userId,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/people/${userId}?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
  });
  return result as PersonEntry;
}

export async function getBase64UserAvatar(
  session: Session,
  userId = "-me-",
): Promise<Blob> {
  // curl -X 'GET' \
  // 'https://coordinador-dev.mintral.cl/alfresco/api/-default-/public/alfresco/versions/1/people/-me-/avatar?attachment=true&placeholder=true' \
  // -H 'accept: application/octet-stream' \
  // -H 'authorization: Basic YWRtaW46MzNMY3BtZS4kVHdwUk5FRk0='
  const queryParams = new URLSearchParams({
    attachment: "true",
    placeholder: "true",
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/people/${userId}/avatar?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetch(url, {
    method: "GET",
    headers,
  });
  return await result.blob();
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
  const queryParams = new URLSearchParams({
    taskId,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/details?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await fetcher(url, {
    method: "GET",
    headers,
  });
  return result as TaskResponse;
}

export async function endTask(
  session: Session,
  taskId: string,
  transitionId?: string,
): Promise<EndTaskResponse> {
  const queryParams = new URLSearchParams({
    taskId,
  });
  if (transitionId) {
    queryParams.set("transition", transitionId);
  }
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/end?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
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
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "multipart/form-data",
    },
    body: formdata,
  });
  return result as string;
}

export async function getChildrenNodes(
  session: Session,
  nodeId: string,
  options: NodeChildrenRequest,
): Promise<NodeChildAssociationPaging> {
  const queryParams = new URLSearchParams();
  Object.entries(options).forEach(([key, value]) => {
    queryParams.set(key, value.toString());
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${nodeId}/children?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const children = await fetcher(url, {
    method: "GET",
    headers,
  });
  return children as NodeChildAssociationPaging;
}

export async function getContentNode(
  session: Session,
  nodeId: string,
): Promise<string> {
  const queryParams = new URLSearchParams({
    attachment: "true",
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${nodeId}/content?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetch(url, {
    method: "GET",
    headers,
  });
  const buffer = Buffer.from(await result.arrayBuffer());
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
  const queryParams = new URLSearchParams({
    serviceCode,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/service/validation?${queryParams.toString()}`;
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
  const baseUrl1 = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${result.node.id}/content`;

  const { url: url1, headers: headers1 } = prepareAlfrescoAuth(
    baseUrl1,
    session,
  );
  const result1 = await fetch(url1, {
    method: "GET",
    headers: headers1,
  });
  const buffer = Buffer.from(await result1.arrayBuffer());
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
  const queryParams = new URLSearchParams({
    instanceId: data,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/finished/workflow/details?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
  });
  return result as HistoricalWorkflow;
}

export async function checkDocumentExists(
  session: Session,
  nodeId: string,
): Promise<boolean> {
  try {
    const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${nodeId}`;
    const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
    // This will throw an error if the node doesn't exist
    const node = (await fetcher(url, {
      method: "GET",
      headers,
    })) as NodeEntry;
    return node && node?.entry?.isFile;
  } catch (error) {
    // just ignore and return false
  }
  return false;
}

export async function getUserStatus(session: Session): Promise<string> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/api/activities/feed/user?format=json`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
  });
  return result as string;
}

export async function getSympthomTemplate(
  session: Session,
  serviceCode: string,
  conditionName: string,
  icuCode: string,
): Promise<SympthomTemplateResponse> {
  const queryParams = new URLSearchParams({
    serviceCode,
    conditionName,
    icuCode,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/service/message-template?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
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
  const queryParams = new URLSearchParams({
    taskId,
    active: `${active}`,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/history?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
  });

  return result as TaskResponse;
}

export async function getTripLoads(
  session: Session,
  tripId: string,
): Promise<TaskResponse> {
  const queryParams = new URLSearchParams({
    tripId,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/service/mintral/service/letter-port?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
  });

  return result as any;
}

export async function getGroupsForPerson(session: Session): Promise<string[]> {
  const queryParams = new URLSearchParams({
    skipCount: "0",
    maxItems: "100",
  });
  const personId = "-me-";
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/people/${personId}/groups?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const groups = (await fetcher(url, {
    method: "GET",
    headers,
  })) as GroupPaging;
  return groups.list?.entries?.map(({ entry }) => entry.id!) ?? [];
}

export async function getInfoEntity(
  session: Session,
  licencePlate: string,
): Promise<GetEntityInfoResponse> {
  const queryParams = new URLSearchParams({
    licencePlate,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/service/mintral/service/last-info-gps-service?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "GET",
    headers,
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
  const queryParams = new URLSearchParams({
    serviceCode,
  });
  if (scope && scopeId) {
    queryParams.set("scope", scope);
    queryParams.set("scopeId", scopeId);
  }
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/service/validation?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  return fetcher(url, {
    method: "GET",
    headers,
  }) as Promise<ValidationsResponse>;
}

// Forum API integrations

type ForumAction =
  | "discussion"
  | "topic/create"
  | "topic/delete"
  | "post/create"
  | "post/reply"
  | "post/edit"
  | "post/delete";

async function callForumAction<TResponse = unknown>(
  session: Session,
  action: ForumAction,
  options?: {
    query?: Record<string, string | undefined>;
    body?: Record<string, unknown>;
  },
): Promise<TResponse> {
  const queryParams = new URLSearchParams();
  if (options?.query) {
    Object.entries(options.query).forEach(([k, v]) => {
      queryParams.set(k, String(v));
    });
  }
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/forum/${action}?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url.toString(), {
    method: "POST",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  return result as TResponse;
}

export async function getForumDiscussion(
  session: Session,
  params: { taskId?: string; instanceId?: string; serviceCode?: string },
): Promise<ForumDiscussionResponse> {
  return callForumAction<ForumDiscussionResponse>(session, "discussion", {
    query: params,
  });
}

export async function createForumTopic(
  session: Session,
  data: { bpmPackage: string; title: string; content: string },
): Promise<unknown> {
  return callForumAction(session, "topic/create", { body: data });
}

export async function createForumPost(
  session: Session,
  data: { topic: string; title: string; content: string; author: string },
): Promise<unknown> {
  return callForumAction(session, "post/create", { body: data });
}

export async function replyForumPost(
  session: Session,
  data: {
    topic: string;
    parentPost: string;
    title?: string;
    content: string;
    author: string;
  },
): Promise<unknown> {
  return callForumAction(session, "post/reply", { body: data });
}

export async function editForumPost(
  session: Session,
  data: { post: string; title?: string; content?: string },
): Promise<unknown> {
  return callForumAction(session, "post/edit", { body: data });
}

export async function deleteForumPost(
  session: Session,
  data: { topic: string; post: string },
): Promise<unknown> {
  return callForumAction(session, "post/delete", { body: data });
}

export async function deleteForumTopic(
  session: Session,
  data: { bpmPackage: string; topic: string },
): Promise<unknown> {
  return callForumAction(session, "topic/delete", { body: data });
}
