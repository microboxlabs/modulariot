import {
  AlfrescoApi,
  PeopleApi,
  WebscriptApi,
  NodesApi,
  PersonEntry,
} from "@alfresco/js-api";
import type {
  EndTaskResponse,
  FastTasksResponse,
  TaskCountResponse,
  TaskResponse,
} from "./alfresco-api.types";

export const alfrescoApi = new AlfrescoApi({
  hostEcm: process.env.ECM_API_URL,
  provider: process.env.AUTH_PROVIDER,
  contextRoot: process.env.CONTEXT_ROOT,
});

export async function getUserProfile(
  ticket: string,
  userId: string = "-me-",
): Promise<PersonEntry> {
  alfrescoApi.setTicket(ticket, "");
  const peopleApi = new PeopleApi(alfrescoApi.contentClient);
  return peopleApi.getPerson(userId);
}

export async function getBase64UserAvatar(
  ticket: string,
  userId = "-me-",
): Promise<string> {
  alfrescoApi.setTicket(ticket, "");
  const peopleApi = new PeopleApi(alfrescoApi.contentClient);
  const blob = await peopleApi.getAvatarImage(userId, {
    placeholder: true,
    attachment: true,
  });

  const buffer = Buffer.from(await new Response(blob).arrayBuffer());
  return "data:image/png;base64," + buffer.toString("base64");
}

export async function getUserTasks(
  ticket: string,
  definitionKey: string,
): Promise<FastTasksResponse> {
  alfrescoApi.setTicket(ticket, "");
  const webscriptApi = new WebscriptApi(alfrescoApi.contentClient);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await webscriptApi.executeWebScript(
    "POST",
    "mintral/tasks",
    undefined,
    undefined,
    undefined,
    JSON.stringify({
      from: 0,
      size: 100,
      definitionKey,
    }),
  );
  return result as FastTasksResponse;
}

export async function getTaskById(
  ticket: string,
  taskId: string,
): Promise<TaskResponse> {
  alfrescoApi.setTicket(ticket, "");
  const webscriptApi = new WebscriptApi(alfrescoApi.contentClient);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await webscriptApi.executeWebScript(
    "GET",
    `api/task-instances/${taskId}`,
  );
  return result as TaskResponse;
}

export async function endTask(
  ticket: string,
  taskId: string,
  transitionId?: string,
): Promise<EndTaskResponse> {
  alfrescoApi.setTicket(ticket, "");
  const webscriptApi = new WebscriptApi(alfrescoApi.contentClient);
  let endpoint = `api/workflow/task/end/${taskId}`;
  if (transitionId) {
    endpoint += `/${transitionId}`;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await webscriptApi.executeWebScript("POST", endpoint);
  return result as EndTaskResponse;
}

export async function getContentNode(
  ticket: string,
  nodeId: string,
): Promise<string> {
  alfrescoApi.setTicket(ticket, "");
  const nodesApi = new NodesApi(alfrescoApi.contentClient);
  const blob = await nodesApi.getNodeContent(nodeId);
  const buffer = Buffer.from(await new Response(blob).arrayBuffer());
  return buffer.toString("base64");
}

export async function getContentByTaskId(
  ticket: string,
  taskId: string,
  fileName: string,
): Promise<string> {
  alfrescoApi.setTicket(ticket, "");
  const webscriptApi = new WebscriptApi(alfrescoApi.contentClient);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = (await webscriptApi.executeWebScript(
    "GET",
    `mintral/node/content?taskId=${taskId}&fileName=${fileName}`,
  )) as { node: { id: string } };
  const nodesApi = new NodesApi(alfrescoApi.contentClient);
  const blob = await nodesApi.getNodeContent(result.node.id);
  const buffer = Buffer.from(await new Response(blob).arrayBuffer());
  return buffer.toString("base64");
  // console.log(buffer.toString("base64"));
  // return result as string;
}

export async function getCountTask(ticket: string): Promise<TaskCountResponse> {
  alfrescoApi.setTicket(ticket, "");
  const webscriptApi = new WebscriptApi(alfrescoApi.contentClient);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await webscriptApi.executeWebScript(
    "POST",
    `mintral/statistics/tasks`,
  );
  return result as TaskCountResponse;
}

export async function formProcessor(
  ticket: string,
  itemKind: string,
  itemId: string,
  data: Record<string, unknown>,
): Promise<TaskResponse> {
  alfrescoApi.setTicket(ticket, "");
  const webscriptApi = new WebscriptApi(alfrescoApi.contentClient);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await webscriptApi.executeWebScript(
    "POST",
    `/api/${itemKind}/${itemId}/formprocessor`,
    undefined,
    undefined,
    undefined,
    JSON.stringify(data),
  );
  return result as TaskResponse;
}

export async function updateTask(
  ticket: string,
  taskId: string,
  data: Record<string, unknown>,
): Promise<TaskResponse> {
  return formProcessor(ticket, "task", taskId, data);
}
