import { AlfrescoApi, PeopleApi, WebscriptApi } from "@alfresco/js-api";
import type {
  EndTaskResponse,
  FastTasksResponse,
  TaskResponse,
} from "./alfresco-api.types";

export const alfrescoApi = new AlfrescoApi({
  hostEcm: process.env.ECM_API_URL,
  provider: process.env.AUTH_PROVIDER,
  contextRoot: process.env.CONTEXT_ROOT,
});

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

export async function getUserTasks(ticket: string): Promise<FastTasksResponse> {
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
// export const webscriptApi = new WebscriptApi(alfrescoApi.contentClient);

// export const peopleApi = new PeopleApi(alfrescoApi.contentClient);
