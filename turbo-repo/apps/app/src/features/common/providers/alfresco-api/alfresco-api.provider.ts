import {
  AlfrescoApiClient,
  PersonEntry,
  NodeChildAssociationPaging,
  GroupPaging,
  NodeEntry,
  AlfrescoApi,
} from "@alfresco/js-api";
import type { ServiceType } from "./service-types.types";
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
  UpdateNodeContentRequest,
  UpdateNodeContentResponse,
  UploadNodeRequest,
  UploadNodeResponse,
  UserState,
  UserSite,
  ValidationsResponse,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  MessageTemplate,
  WebhookDefinition,
  WebhookDefinitionResponse,
  MessageTemplatesResponse,
  StatisticsMode,
  StatisticsTasksResponse,
} from "./alfresco-api.types";
import fetcher from "../fetcher";
import type { FetcherError } from "../fetcher.types";
import { GetEntityInfoResponse } from "../microboxlabs-api/microboxlabs-api.types";
import type { Session } from "next-auth";
import { createManagedLogger, logError } from "@/lib/logger";
import { z } from "zod";

const alfrescoApiLogger = createManagedLogger(
  "alfresco-api",
  "Alfresco API",
  undefined,
  "api"
);
/**
 * Prepares authentication configuration for Alfresco API calls
 * @param baseUrl - The base URL for the API endpoint
 * @param session - The user session containing authentication data
 * @returns Object containing the modified URL and headers for authentication
 */
export function prepareAlfrescoAuth(
  baseUrl: string,
  session?: Session
  // contentType: string = "application/json",
): {
  url: string;
  headers: Record<string, string>;
} {
  let url = baseUrl;
  const headers: Record<string, string> = {
    // "Content-Type": contentType,
  };
  const user = session?.user;
  if (session?.user?.rawJWT) {
    headers["Authorization"] = `Bearer ${session.user.rawJWT}`;
  } else if (session?.user?.ticket) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    url = `${baseUrl}${separator}alf_ticket=${session.user.ticket}`;
  }

  alfrescoApiLogger.debug(
    {
      user: user?.email,
      baseUrl,
      headers,
      rawJWT: user?.rawJWT,
      ticket: user?.ticket,
    },
    "prepareAlfrescoAuth"
  );

  return { url, headers };
}

export function prepareAlfrescoAuthWithAccessToken(session: Session): void {
  const idToken = session.user?.rawJWT;
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
  userId: string = "-me-"
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
  userId = "-me-"
): Promise<Blob> {
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
  } = {}
): Promise<FastTasksResponse> {
  const { from = 0, size = 100, filter = undefined } = options;
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      size,
      definitionKey: definitionKey.length == 0 ? undefined : definitionKey,
      filter,
    }),
  });

  return result as FastTasksResponse;
}

export async function getUnbookedTasks(
  session: Session,
  definitionKey: string | string[],
  options: {
    from?: number;
    size?: number;
    filter?: Record<string, unknown>;
  } = {},
  calendarId: string
): Promise<FastTasksResponse> {
  const { from = 0, size = 100, filter: baseFilter = undefined } = options;
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/unbooked`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  // When called with multiple keys, push them onto filter.definitionKeys so the
  // backend can issue a single IN-clause query and apply ORDER BY globally —
  // see ecm-coordinator #238. The singular form is preserved for back-compat.
  let body: Record<string, unknown>;
  if (Array.isArray(definitionKey)) {
    const keys = definitionKey.filter((k) => k.length > 0);
    body = {
      from,
      size,
      filter: { ...baseFilter, definitionKeys: keys },
      calendarId,
    };
  } else {
    body = {
      from,
      size,
      definitionKey: definitionKey.length === 0 ? undefined : definitionKey,
      filter: baseFilter,
      calendarId,
    };
  }

  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return result as FastTasksResponse;
}

export async function getTaskById(
  session: Session,
  taskId: string
): Promise<TaskResponse> {
  const queryParams = new URLSearchParams({
    taskId,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/details?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "GET",
    headers,
  });
  return result as TaskResponse;
}

export async function endTask(
  session: Session,
  taskId: string,
  transitionId?: string
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

/**
 * Wire payload for the calendar binding webscript. Fields use snake_case
 * to match the coordinator request model verbatim.
 *
 * Always required: `numero_servicio`, `calendar_id`, `stage`.
 * Required only when `stage="assigned"`: `tipo_servicio`, `carrier_id`,
 * `driver_id`, `truck_id`. `driver2_id` / `trailer_id` are optional.
 * Tuple fields are ignored on non-assigned stages.
 */
export type CalendarBindingStage =
  | "planned"
  | "assigned"
  | "unassigned"
  | "none";

export interface CalendarBindingPayload {
  numero_servicio: string;
  calendar_id: string;
  stage: CalendarBindingStage;
  tipo_servicio?: string;
  carrier_id?: string;
  driver_id?: string;
  driver2_id?: string | null;
  truck_id?: string;
  trailer_id?: string | null;
}

export interface CalendarBindingResponse {
  status: "applied" | "synced" | "already_synced";
  numero_servicio: string;
  calendar_id: string;
  stage: CalendarBindingStage;
  alerce?: { code?: string; message?: string };
}

/**
 * Notify the coordinator of a calendar binding change. Single entry point
 * for all five UI ops (Plan / Unplan / Assign / Unassign / Calendar-change);
 * the coordinator dispatches based on `stage` and, on `stage="assigned"`,
 * resolves UUIDs to RUTs/plates and pushes to Alerce
 * ModificacionRecursoServicios.
 *
 * A non-2xx is meaningful — the caller treats stage=assigned failures as
 * hard rollbacks (cancel the just-created booking).
 */
export async function notifyCalendarBinding(
  session: Session,
  payload: CalendarBindingPayload
): Promise<CalendarBindingResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/calendar/binding`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return result as CalendarBindingResponse;
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
      request.updateNameAndMimetype.toString()
    );
  }
  if (request.createdDirectory) {
    formdata.append("createdDirectory", request.createdDirectory.toString());
  }
  if (request.prop_mintral_contentType) {
    formdata.append(
      "prop_mintral_contentType",
      request.prop_mintral_contentType
    );
  }
  return formdata;
}

export async function uploadNodeContent(
  session: Session,
  request: UploadNodeRequest
): Promise<UploadNodeResponse> {
  try {
    const formdata = uploadNodeFormData(request);
    const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/api/upload`;
    const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

    const result = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
      },
      body: formdata,
    });

    if (!result.ok) {
      logError(
        new Error(
          `Upload failed with HTTP error: ${result.status} ${result.statusText}`
        )
      );
      return {
        status: { code: result.status, message: "The file was not uploaded" },
        data: undefined,
      };
    }

    const responseData = await result.json();

    // Validate that the response has the expected structure
    if (
      responseData &&
      typeof responseData === "object" &&
      responseData.status &&
      responseData.status.code
    ) {
      return responseData as UploadNodeResponse;
    } else {
      return {
        status: { code: 200, message: "Upload successful" },
        data: responseData,
      };
    }
  } catch (error) {
    alfrescoApiLogger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Upload failed with exception"
    );
    return null;
  }
}

export async function updateNodeContent(
  session: Session,
  request: UpdateNodeContentRequest
): Promise<UpdateNodeContentResponse> {
  try {
    const { nodeId, filedata, name } = request;

    const queryParams = new URLSearchParams();
    queryParams.set("name", name);
    queryParams.set("comment", "Updated version");

    const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${nodeId}/content?${queryParams.toString()}`;
    const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

    const result = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": filedata.type || "application/octet-stream",
      },
      body: filedata,
    });

    if (!result.ok) {
      logError(
        new Error(
          `Update node content failed with HTTP error: ${result.status} ${result.statusText}`
        )
      );
      return null;
    }

    const responseData = await result.json();
    return responseData as UpdateNodeContentResponse;
  } catch (error) {
    alfrescoApiLogger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Update node content failed with exception"
    );
    return null;
  }
}

export async function updateNodeProperties(
  session: Session,
  nodeId: string,
  properties: Record<string, string>
): Promise<boolean> {
  try {
    const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${nodeId}`;
    const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
    const result = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ properties }),
    });
    if (!result.ok) {
      logError(
        new Error(`Update node properties failed with HTTP error: ${result.status} ${result.statusText}`)
      );
      return false;
    }
    return true;
  } catch (error) {
    alfrescoApiLogger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Update node properties failed with exception"
    );
    return false;
  }
}

export async function updateNodeName(
  session: Session,
  nodeId: string,
  name: string
): Promise<boolean> {
  try {
    const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${nodeId}`;
    const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
    const result = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!result.ok) {
      logError(
        new Error(`Rename node failed with HTTP error: ${result.status} ${result.statusText}`)
      );
      return false;
    }
    return true;
  } catch (error) {
    alfrescoApiLogger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Rename node failed with exception"
    );
    return false;
  }
}

export async function deleteNode(
  session: Session,
  nodeId: string
): Promise<boolean> {
  try {
    const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${nodeId}`;
    const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
    const result = await fetch(url, { method: "DELETE", headers });
    if (!result.ok) {
      logError(
        new Error(`Delete node failed with HTTP error: ${result.status} ${result.statusText}`)
      );
      return false;
    }
    return true;
  } catch (error) {
    alfrescoApiLogger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Delete node failed with exception"
    );
    return false;
  }
}

export async function getChildrenNodes(
  session: Session,
  nodeId: string,
  options: NodeChildrenRequest
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
  nodeId: string
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

export async function getPlainTextNode(
  session: Session,
  nodeId: string
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
  return result.text();
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
  serviceCode: string
): Promise<Validations> {
  const queryParams = new URLSearchParams({
    serviceCode,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/service/validation?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  // Llamada a la API para validar el servicio

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
  requireInternalSign: boolean = false
): Promise<string> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/node/content`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = (await fetcher(url, {
    method: "GET",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ taskId, fileName, signed: requireInternalSign }),
  })) as { node: { id: string } };
  const baseUrl1 = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${result.node.id}/content`;

  const { url: url1, headers: headers1 } = prepareAlfrescoAuth(
    baseUrl1,
    session
  );
  const result1 = await fetch(url1, {
    method: "GET",
    headers: headers1,
  });
  const buffer = Buffer.from(await result1.arrayBuffer());
  return buffer.toString("base64");
}

export async function getCountTask(
  session: Session
): Promise<TaskCountResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/statistics/tasks`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "POST",
    headers,
  });
  return result as TaskCountResponse;
}

export async function getStatisticsTasks(
  session: Session,
  mode: StatisticsMode = "running_tasks"
): Promise<StatisticsTasksResponse> {
  const queryParams = new URLSearchParams({
    mode,
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/statistics/tasks?${queryParams.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  return result as StatisticsTasksResponse;
}

export async function formProcessor(
  session: Session,
  itemKind: string,
  itemId: string,
  data: Record<string, unknown>
): Promise<TaskResponse> {
  const normalizedItemId =
    itemKind === "task" && !itemId.startsWith("activiti$")
      ? `activiti$${itemId}`
      : itemId;
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/api/${itemKind}/${normalizedItemId}/formprocessor`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return result as TaskResponse;
}

export async function updateTask(
  session: Session,
  taskId: string,
  data: Record<string, unknown>
): Promise<TaskResponse> {
  return formProcessor(session, "task", taskId, data);
}

export async function getServiceValidation(
  session: Session,
  serviceCode: string
): Promise<ServiceValidationResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/service/validation`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "GET",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ serviceCode }),
  });
  return result as ServiceValidationResponse;
}

export async function getFinishedWorkflows(
  session: Session,
  data: FinishedWorkflowsRequest
): Promise<FinishedWorkflowsResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/finished/workflows`;

  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return result as FinishedWorkflowsResponse;
}

export async function getFinishedWorkflowByInstanceId(
  session: Session,
  data: string
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
  nodeId: string
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
  icuCode: string
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

  const result = await fetcher(url, {
    method: "GET",
    headers,
  });
  return result as UserState[];
}

export async function getTaskHistory(
  session: Session,
  taskId: string,
  active: boolean = true
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
  tripId: string
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

/**
 * Resolve a node by relativePath. Returns the nodeId or null if not found (404).
 */
export async function resolveNodeByPath(
  session: Session,
  relativePath: string
): Promise<string | null> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/-root-?relativePath=${encodeURIComponent(relativePath)}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  try {
    const response = await fetcher<{ entry?: { id?: string } }>(url, {
      method: "GET",
      headers,
    });
    return response?.entry?.id ?? null;
  } catch (error: unknown) {
    const fetcherErr = error as FetcherError;
    if (fetcherErr?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Ensure a folder exists under a parent node. Creates it if missing.
 * Uses create-first strategy to avoid TOCTOU races — handles 409 (already exists).
 * Returns the folder's nodeId.
 */
export async function ensureFolder(
  session: Session,
  parentNodeId: string,
  folderName: string
): Promise<string> {
  const createUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${parentNodeId}/children`;
  const { url, headers } = prepareAlfrescoAuth(createUrl, session);

  try {
    const created = await fetcher<{ entry?: { id?: string } }>(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: folderName,
        nodeType: "cm:folder",
      }),
    });

    const createdId = created?.entry?.id;
    if (!createdId) {
      throw new Error(`Failed to create folder '${folderName}'`);
    }
    return createdId;
  } catch (error: unknown) {
    const fetcherErr = error as FetcherError;
    // 409 = folder already exists — resolve its nodeId by relativePath from parent
    if (fetcherErr?.status === 409) {
      const nodeUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${parentNodeId}?relativePath=${encodeURIComponent(folderName)}`;
      const { url: resolveUrl, headers: resolveHeaders } =
        prepareAlfrescoAuth(nodeUrl, session);
      const resolved = await fetcher<{ entry?: { id?: string } }>(resolveUrl, {
        method: "GET",
        headers: resolveHeaders,
      });

      const existingId = resolved?.entry?.id;
      if (existingId) {
        return existingId;
      }
    }
    throw error;
  }
}

export async function getUserFilters(
  session: Session,
  group: string
): Promise<string> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/-root-?relativePath=Sites/mintral/documentLibrary/task/${group}.json`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const filterResponse = (await fetcher(url, {
    method: "GET",
    headers,
  })) as any;
  return filterResponse?.entry?.id as string;
}

/**
 * Gets the sites associated with the current user
 * @param session - The user session
 * @returns Array of sites the user belongs to
 */
export async function getUserSites(session: Session): Promise<UserSite[]> {
  const userEmail = session.user?.email;
  if (!userEmail) {
    return [];
  }
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/service/api/people/${encodeURIComponent(userEmail)}/sites`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "GET",
    headers,
  });
  return result as UserSite[];
}

/**
 * Logo file configurations for different themes
 * Order matters - first match wins
 */
const LOGO_LIGHT_THEME = [
  { filename: "logo-black.svg", mimeType: "image/svg+xml" },
  { filename: "logo-black.png", mimeType: "image/png" },
  { filename: "logo.svg", mimeType: "image/svg+xml" },
  { filename: "logo.png", mimeType: "image/png" },
] as const;

const LOGO_DARK_THEME = [
  { filename: "logo-white.svg", mimeType: "image/svg+xml" },
  { filename: "logo-white.png", mimeType: "image/png" },
  { filename: "logo.svg", mimeType: "image/svg+xml" },
  { filename: "logo.png", mimeType: "image/png" },
] as const;

type LogoFormat = { filename: string; mimeType: string };

/**
 * Tries to get a logo node by filename from a site's document library
 */
async function tryGetLogoNode(
  session: Session,
  siteName: string,
  filename: string,
  mimeType: string
): Promise<{ nodeId: string; mimeType: string } | null> {
  try {
    const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/-root-?relativePath=Sites/${encodeURIComponent(siteName)}/documentLibrary/branding/${filename}`;
    const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

    const response = (await fetcher(url, {
      method: "GET",
      headers,
    })) as NodeEntry;

    const nodeId = response?.entry?.id;
    if (!nodeId) return null;

    return { nodeId, mimeType };
  } catch {
    return null;
  }
}

/**
 * Finds the first available logo from a list of formats
 */
async function findFirstAvailableLogo(
  session: Session,
  siteName: string,
  formats: readonly LogoFormat[]
): Promise<{ nodeId: string; mimeType: string } | null> {
  for (const format of formats) {
    const result = await tryGetLogoNode(
      session,
      siteName,
      format.filename,
      format.mimeType
    );
    if (result) {
      return result;
    }
  }
  return null;
}

/**
 * Gets theme-specific logos for a site
 * @param session - The user session
 * @param siteName - The site shortName
 * @returns Object with light and dark theme logo nodes
 */
export async function getSiteLogos(
  session: Session,
  siteName: string
): Promise<{
  light: { nodeId: string; mimeType: string } | null;
  dark: { nodeId: string; mimeType: string } | null;
}> {
  // Fetch both theme variants in parallel
  const [light, dark] = await Promise.all([
    findFirstAvailableLogo(session, siteName, LOGO_LIGHT_THEME),
    findFirstAvailableLogo(session, siteName, LOGO_DARK_THEME),
  ]);

  return { light, dark };
}

/**
 * @deprecated Use getSiteLogos instead for theme support
 * Gets the logo node ID from a site's document library
 * Tries SVG first, then falls back to PNG
 */
export async function getSiteLogoNodeId(
  session: Session,
  siteName: string
): Promise<{ nodeId: string; mimeType: string } | null> {
  return findFirstAvailableLogo(session, siteName, LOGO_LIGHT_THEME);
}

/**
 * Gets the logo content (as base64 data URL) from a site's document library
 * @param session - The user session
 * @param nodeId - The node ID of the logo
 * @param mimeType - The MIME type of the logo (e.g., "image/svg+xml" or "image/png")
 * @returns The logo content as base64 data URL, or null if not found
 */
export async function getSiteLogoContent(
  session: Session,
  nodeId: string,
  mimeType: string = "image/png"
): Promise<string | null> {
  try {
    const baseUrl = `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${nodeId}/content`;
    const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

    const result = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!result.ok) {
      return null;
    }

    const buffer = Buffer.from(await result.arrayBuffer());
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Gets the public organization logo from the /alfresco/s/public/org/logo endpoint
 * This is a public endpoint that returns the organization's logo without requiring authentication
 * @returns The logo as a base64 data URL, or null if not available
 */
export async function getPublicOrgLogo(): Promise<string | null> {
  const ecmApiUrl = process.env.ECM_API_URL;
  if (!ecmApiUrl) {
    return null;
  }

  try {
    const logoUrl = `${ecmApiUrl}/alfresco/s/public/org/logo`;

    const response = await fetch(logoUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    // Get the content type from the response
    const contentType = response.headers.get("content-type") ?? "image/png";

    // Convert to base64 data URL
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64Logo = `data:${contentType};base64,${buffer.toString("base64")}`;

    return base64Logo;
  } catch {
    return null;
  }
}

export async function getInfoEntity(
  session: Session,
  licencePlate: string
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
  data: Record<string, unknown>
): Promise<TaskResponse> {
  const url = `${process.env.ECM_API_URL}/alfresco/service/public/biometric/verification`;
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return result as any;
}

export async function getSovosFingerprintReuse(
  session: Session,
  data: Record<string, unknown>
): Promise<TaskResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/service/sovos/fingerprint-reuse`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
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
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });

  return result as any;
}

export async function getTaskByLicensePlate(
  session: Session,
  data: Record<string, unknown>
): Promise<any> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/history-filter`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return result as any;
}

export async function ecmSovosDec5(
  session: Session,
  taskId: string
): Promise<any> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/sign/sovos-dec5?taskId=${taskId}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  return result as any;
}

export async function getValidationByServiceCode(
  session: Session,
  serviceCode: string,
  scope?: string,
  scopeId?: string
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

export async function getInfoEntityGuest(
  licencePlate: string
): Promise<GetEntityInfoResponse> {
  const guestEmail = process.env.TOTEMSA_EMAIL || "guest";
  const guestPassword = process.env.TOTEMSA_PASSWORD || "guest";

  try {
    // Login with guest credentials
    const alfrescoApi = new AlfrescoApi({
      hostEcm: process.env.ECM_API_URL,
      provider: process.env.AUTH_PROVIDER,
      contextRoot: process.env.CONTEXT_ROOT,
    });
    const ticket: string = (await alfrescoApi.login(
      guestEmail,
      guestPassword
    )) as string;

    // Build query params
    const queryParams = new URLSearchParams({
      licencePlate,
    });

    // Call entity endpoint with guest ticket
    const baseUrl = `${process.env.ECM_API_URL}/alfresco/service/mintral/service/last-info-gps-service?${queryParams.toString()}`;
    const separator = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${separator}alf_ticket=${ticket}`;

    const result = await fetcher(url, {
      method: "GET",
      headers: {},
    });
    return result as GetEntityInfoResponse;
  } catch (error) {
    alfrescoApiLogger.error(
      { error, licencePlate },
      "Failed to get entity info with guest account"
    );
    throw error;
  }
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
  }
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
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options?.body),
  });
  return result as TResponse;
}

export async function getForumDiscussion(
  session: Session,
  params: { taskId?: string; instanceId?: string; serviceCode?: string }
): Promise<ForumDiscussionResponse> {
  return callForumAction<ForumDiscussionResponse>(session, "discussion", {
    query: params,
  });
}

export async function createForumTopic(
  session: Session,
  data: { bpmPackage: string; title: string; content: string }
): Promise<unknown> {
  return callForumAction(session, "topic/create", { body: data });
}

export async function createForumPost(
  session: Session,
  data: { topic: string; title: string; content: string; author: string }
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
  }
): Promise<unknown> {
  return callForumAction(session, "post/reply", { body: data });
}

export async function editForumPost(
  session: Session,
  data: { post: string; title?: string; content?: string }
): Promise<unknown> {
  return callForumAction(session, "post/edit", { body: data });
}

export async function deleteForumPost(
  session: Session,
  data: { topic: string; post: string }
): Promise<unknown> {
  return callForumAction(session, "post/delete", { body: data });
}

export async function deleteForumTopic(
  session: Session,
  data: { bpmPackage: string; topic: string }
): Promise<unknown> {
  return callForumAction(session, "topic/delete", { body: data });
}

// Message Templates API

async function callMessageTemplateAction<TResponse = unknown>(
  session: Session,
  action: string,
  options?: {
    query?: Record<string, string | undefined>;
    body?:
      | CreateTemplateRequest
      | UpdateTemplateRequest
      | CreateWebhookRequest
      | UpdateWebhookRequest
      | { template: string };
  }
): Promise<TResponse> {
  const queryParams = new URLSearchParams();
  if (options?.query) {
    Object.entries(options.query).forEach(([k, v]) => {
      if (v) queryParams.set(k, v);
    });
  }

  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/common/msgtpl/${action}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  return result as TResponse;
}

// Template CRUD operations
export async function createMessageTemplate(
  session: Session,
  data: CreateTemplateRequest
): Promise<MessageTemplate> {
  return callMessageTemplateAction<MessageTemplate>(
    session,
    "template/create",
    {
      body: data,
    }
  );
}

export async function updateMessageTemplate(
  session: Session,
  data: UpdateTemplateRequest
): Promise<MessageTemplate> {
  return callMessageTemplateAction<MessageTemplate>(
    session,
    "template/update",
    {
      body: data,
    }
  );
}

export async function deleteMessageTemplate(
  session: Session,
  templateNodeRef: string
): Promise<void> {
  return callMessageTemplateAction(session, "template/delete", {
    body: { template: templateNodeRef },
  });
}

export async function listMessageTemplates(
  session: Session,
  site: string,
  kind?: string
): Promise<MessageTemplatesResponse> {
  return callMessageTemplateAction<MessageTemplatesResponse>(
    session,
    "template/list",
    {
      query: { site, kind },
    }
  );
}

// Webhook CRUD operations
export async function createWebhookDefinition(
  session: Session,
  data: CreateWebhookRequest
): Promise<WebhookDefinition> {
  return callMessageTemplateAction<WebhookDefinition>(
    session,
    "webhook/create",
    {
      body: data,
    }
  );
}

export async function updateWebhookDefinition(
  session: Session,
  data: UpdateWebhookRequest
): Promise<WebhookDefinition> {
  return callMessageTemplateAction<WebhookDefinition>(
    session,
    "webhook/update",
    {
      body: data,
    }
  );
}

export async function deleteWebhookDefinition(
  session: Session,
  webhookDefNodeRef: string
): Promise<void> {
  return callMessageTemplateAction(session, "webhook/delete", {
    body: { webhookDef: webhookDefNodeRef },
  });
}

export async function listWebhookDefinitions(
  session: Session,
  site: string,
  kind?: string
): Promise<WebhookDefinitionResponse> {
  return callMessageTemplateAction<WebhookDefinitionResponse>(
    session,
    "webhook/list",
    {
      query: { site, kind },
    }
  );
}

// Data Source Config API

interface AlfrescoDataSourceTokenConfig {
  authMethod: "TOKEN";
  encryptedToken?: string;
  tokenSuffix?: string;
}

interface AlfrescoDataSourceOAuthConfig {
  authMethod: "OAUTH";
  clientId?: string;
  encryptedClientSecret?: string;
  clientSecretSuffix?: string;
  tokenUrl?: string;
  scope?: string;
  audience?: string;
  tokenRequestFormat?: "form" | "json";
}

export type AlfrescoDataSourceConfig =
  | AlfrescoDataSourceTokenConfig
  | AlfrescoDataSourceOAuthConfig;

export interface AlfrescoDataSource {
  nodeRef: string;
  name: string;
  type: string;
  description?: string;
  url: string;
  config: AlfrescoDataSourceConfig | null;
  isActive: boolean;
  lastTestedAt?: string;
  lastTestResult?: boolean;
  site: string;
}

export interface AlfrescoDataSourceListResponse {
  dataSources: AlfrescoDataSource[];
}

async function callDataSourceAction<TResponse = unknown>(
  session: Session,
  action: string,
  options?: {
    query?: Record<string, string | undefined>;
    body?: Record<string, unknown>;
  }
): Promise<TResponse> {
  const queryParams = new URLSearchParams();
  if (options?.query) {
    Object.entries(options.query).forEach(([k, v]) => {
      if (v) queryParams.set(k, v);
    });
  }

  const queryString = queryParams.toString();
  const suffix = queryString ? `?${queryString}` : "";
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/microboxlabs/dashboards/datasource/${action}${suffix}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  return result as TResponse;
}

export async function listDataSources(
  session: Session,
  site: string
): Promise<AlfrescoDataSourceListResponse> {
  return callDataSourceAction<AlfrescoDataSourceListResponse>(
    session,
    "list",
    { query: { site } }
  );
}

export async function createDataSource(
  session: Session,
  data: Record<string, unknown>
): Promise<AlfrescoDataSource> {
  return callDataSourceAction<AlfrescoDataSource>(session, "create", {
    body: data,
  });
}

export async function updateDataSource(
  session: Session,
  data: Record<string, unknown>
): Promise<AlfrescoDataSource> {
  return callDataSourceAction<AlfrescoDataSource>(session, "update", {
    body: data,
  });
}

export async function deleteDataSource(
  session: Session,
  nodeRef: string
): Promise<{ success: boolean }> {
  return callDataSourceAction<{ success: boolean }>(session, "delete", {
    body: { nodeRef },
  });
}

export async function getDataSource(
  session: Session,
  nodeRef: string
): Promise<AlfrescoDataSource> {
  return callDataSourceAction<AlfrescoDataSource>(session, "get", {
    query: { nodeRef },
  });
}

/**
 * Unclaim a task by removing the current owner assignment
 * @param session - User session with admin privileges
 * @param taskId - The ID of the task to unclaim
 * @returns Success status
 */
export async function unclaimTask(
  session: Session,
  taskId: string
): Promise<{ success: boolean }> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/api/task-instances/activiti$${taskId}`;
  console.log("baseUrl", baseUrl);
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  alfrescoApiLogger.debug(
    {
      taskId,
      user: session.user?.email,
    },
    "Unclaiming task"
  );

  const result = await fetcher(url, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cm_owner: null,
    }),
  });

  return result as { success: boolean };
}

export interface ETARequest {
  originGeofence: string;
  destinationGeofence: string;
  doubleDriver?: boolean;
  percentile?: string;
  startDate?: string;
}

export interface ETAResponse {
  estimatedArrival: string;
  duration: number;
  distance: number;
}

export async function calculateETA(
  session: Session,
  etaRequest: ETARequest
): Promise<ETAResponse> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/calculate-eta`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);

  alfrescoApiLogger.debug(
    {
      origin: etaRequest.originGeofence,
      destination: etaRequest.destinationGeofence,
      user: session.user?.email,
    },
    "Calculating ETA"
  );

  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(etaRequest),
  });

  return result as ETAResponse;
}

const serviceTypeSchema = z.object({
  nodeRef: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
});
const serviceTypesSchema = z.array(serviceTypeSchema);

export async function getServiceTypes(
  session: Session
): Promise<ServiceType[]> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/service-types`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`service-types: ${response.status}`);
  return serviceTypesSchema.parse(await response.json());
}

export const timelapseMetadataSchema = z.object({
  streamUrl: z.string(),
  estimatedDurationSeconds: z.number(),
  framerate: z.number(),
  downloadUrl: z.string(),
  videoSizeBytes: z.number(),
  sessionId: z.string(),
  deviceId: z.string(),
  licensePlate: z.string(),
  nodeRef: z.string(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .nullable()
    .optional(),
  state: z.string(),
  startTimestamp: z.string(),
  endTimestamp: z.string(),
  frameCount: z.number(),
  clientId: z.string(),
  projectId: z.string(),
});

export type TimelapseMetadata = z.infer<typeof timelapseMetadataSchema>;

export async function getTimelapseMetadata(
  session: Session,
  licensePlate: string,
  timestamp: string
): Promise<TimelapseMetadata> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/timelapse?license_plate=${encodeURIComponent(licensePlate)}&timestamp=${encodeURIComponent(timestamp)}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`timelapse: ${response.status}`);
  return timelapseMetadataSchema.parse(await response.json());
}

export async function updateTaskServiceCategory(
  session: Session,
  taskId: string,
  serviceTypeCode: string
): Promise<void> {
  await formProcessor(session, "task", taskId, {
    prop_mintral_serviceCategory: serviceTypeCode,
  });
}

/**
 * Reads a dashboard config from Alfresco via the dashboard config webscript.
 * The Alfresco webscript uses POST with JSON body for all actions.
 * Returns the parsed config or null if no config exists yet.
 */
export async function getDashboardConfig(
  session: Session,
  site: string,
  slug: string
): Promise<{ data: unknown }> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/microboxlabs/dashboards/dashboard-config/get`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site, slug }),
  });
  return result as { data: unknown };
}

/**
 * Saves a dashboard config to Alfresco via the dashboard config webscript.
 */
export async function saveDashboardConfig(
  session: Session,
  site: string,
  slug: string,
  config: unknown
): Promise<{ success: boolean }> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/microboxlabs/dashboards/dashboard-config/save`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site, slug, config }),
  });
  return result as { success: boolean };
}

/**
 * Lists all dashboard configs for a site from Alfresco.
 * Returns { data: Array<{ slug, config }> }.
 */
export async function listDashboardConfigs(
  session: Session,
  site: string
): Promise<{ data: Array<{ slug: string; config: Record<string, unknown> }> }> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/microboxlabs/dashboards/dashboard-config/list`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site }),
  });
  return result as { data: Array<{ slug: string; config: Record<string, unknown> }> };
}

/**
 * Deletes a dashboard config from Alfresco via the dashboard config webscript.
 */
export async function deleteDashboardConfig(
  session: Session,
  site: string,
  slug: string
): Promise<{ success: boolean }> {
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/microboxlabs/dashboards/dashboard-config/delete`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site, slug }),
  });
  return result as { success: boolean };
}

// ============================================================================
// Dashboard node permissions (public Alfresco v1 REST API)
// ============================================================================

const ALF_PUBLIC_V1 = "/alfresco/api/-default-/public/alfresco/versions/1";

type NodeEntryWithPermissions = {
  entry: {
    id: string;
    name: string;
    nodeType: string;
    permissions?: import("./alfresco-api.types").AlfrescoNodePermissions;
  };
};

/**
 * Resolves the Alfresco nodeId of a dashboard config file and returns its
 * permissions in a single round trip, using the public v1 REST API.
 *
 * The file path convention is defined by the miot-dashboards backend:
 *   Sites/{site}/documentLibrary/dashboard/{slug}-config.json
 */
export async function getDashboardNodePermissions(
  session: Session,
  site: string,
  slug: string
): Promise<{
  nodeId: string;
  permissions: import("./alfresco-api.types").AlfrescoNodePermissions;
}> {
  const relativePath = `Sites/${site}/documentLibrary/dashboard/${slug}-config.json`;
  const params = new URLSearchParams({
    relativePath,
    include: "permissions",
  });
  const baseUrl = `${process.env.ECM_API_URL}${ALF_PUBLIC_V1}/nodes/-root-?${params.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher<NodeEntryWithPermissions>(url, {
    method: "GET",
    headers,
  });

  return {
    nodeId: result.entry.id,
    permissions: result.entry.permissions ?? { isInheritanceEnabled: true },
  };
}

/**
 * Resolves the nodeId of the dashboard config file for the given site/slug
 * via its canonical path. Used by routes that must authoritatively identify
 * the dashboard node server-side (never trust a client-supplied nodeId).
 */
export async function resolveDashboardNodeId(
  session: Session,
  site: string,
  slug: string
): Promise<string> {
  const relativePath = `Sites/${site}/documentLibrary/dashboard/${slug}-config.json`;
  const params = new URLSearchParams({ relativePath });
  const baseUrl = `${process.env.ECM_API_URL}${ALF_PUBLIC_V1}/nodes/-root-?${params.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher<{ entry: { id: string } }>(url, {
    method: "GET",
    headers,
  });
  return result.entry.id;
}

/**
 * Resolves the dashboard node and returns the `allowableOperations` array
 * Alfresco computes for the current user. Operations: `delete`, `update`,
 * `updatePermissions`, `create`. Used by the UI to gate edit/settings
 * controls based on the user's effective role.
 */
export async function getDashboardAllowableOperations(
  session: Session,
  site: string,
  slug: string
): Promise<{ nodeId: string; allowableOperations: string[] }> {
  const relativePath = `Sites/${site}/documentLibrary/dashboard/${slug}-config.json`;
  const params = new URLSearchParams({
    relativePath,
    include: "allowableOperations",
  });
  const baseUrl = `${process.env.ECM_API_URL}${ALF_PUBLIC_V1}/nodes/-root-?${params.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher<{
    entry: { id: string; allowableOperations?: string[] };
  }>(url, {
    method: "GET",
    headers,
  });

  return {
    nodeId: result.entry.id,
    allowableOperations: result.entry.allowableOperations ?? [],
  };
}

/**
 * Updates the permissions of a node using the public v1 REST API.
 * Returns the updated permissions snapshot.
 */
export async function updateNodePermissions(
  session: Session,
  nodeId: string,
  permissions: import("./alfresco-api.types").NodePermissionsUpdate
): Promise<import("./alfresco-api.types").AlfrescoNodePermissions> {
  const params = new URLSearchParams({ include: "permissions" });
  const baseUrl = `${process.env.ECM_API_URL}${ALF_PUBLIC_V1}/nodes/${nodeId}?${params.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher<NodeEntryWithPermissions>(url, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ permissions }),
  });

  return result.entry.permissions ?? { isInheritanceEnabled: true };
}

/**
 * Searches Alfresco people using the same webscript Alfresco Share's people
 * picker uses: `GET /alfresco/s/api/people?filter=<term>`.
 * Filter matches firstName, lastName, userName, and email (substring).
 */
export async function searchPeople(
  session: Session,
  term: string,
  maxItems = 25
): Promise<import("./alfresco-api.types").AuthoritySuggestion[]> {
  const trimmed = term.trim();
  if (trimmed.length === 0) return [];

  const params = new URLSearchParams({
    filter: trimmed,
    maxResults: String(maxItems),
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/api/people?${params.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher<
    import("./alfresco-api.types").LegacyPeopleSearchResponse
  >(url, {
    method: "GET",
    headers,
  });

  return (result.people ?? []).map((person) => {
    const fullName = [person.firstName, person.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      id: person.userName,
      displayName: fullName || person.email || person.userName,
      kind: "user" as const,
    };
  });
}

/**
 * Searches Alfresco groups using the same webscript Alfresco Share's people
 * picker uses: `GET /alfresco/s/api/groups?shortNameFilter=*term*&zone=APP.DEFAULT`.
 *
 * This filters directly against the authority shortName (e.g. "DASHBOARD"),
 * which is what users see in Share's admin console. More reliable than the
 * v1 `/queries/groups` endpoint, which is SOLR-backed and only matches
 * displayName within the default zone.
 */
export async function searchGroups(
  session: Session,
  term: string,
  maxItems = 25
): Promise<import("./alfresco-api.types").AuthoritySuggestion[]> {
  const trimmed = term.trim();
  if (trimmed.length === 0) return [];

  const params = new URLSearchParams({
    shortNameFilter: `*${trimmed}*`,
    zone: "APP.DEFAULT",
    maxItems: String(maxItems),
  });
  const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/api/groups?${params.toString()}`;
  const { url, headers } = prepareAlfrescoAuth(baseUrl, session);
  const result = await fetcher<
    import("./alfresco-api.types").LegacyGroupSearchResponse
  >(url, {
    method: "GET",
    headers,
  });

  return (result.data ?? []).map((group) => ({
    id: group.fullName,
    displayName: group.displayName || group.shortName,
    kind: "group" as const,
  }));
}
