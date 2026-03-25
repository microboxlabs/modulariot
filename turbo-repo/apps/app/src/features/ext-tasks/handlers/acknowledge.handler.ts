import "server-only";

import { getSharedAuthToken } from "@/app/api/utils/streamhub-api-client";
import fetcher from "@/features/common/providers/fetcher";
import type { TaskExecutionResult } from "../ext-task.types";

export async function acknowledgeHandler(
  payload: Record<string, unknown>,
): Promise<TaskExecutionResult> {
  const webhookUrl = process.env.EXT_TASKS_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("EXT_TASKS_WEBHOOK_URL is not configured");
  }

  const authToken = getSharedAuthToken();
  const token = await authToken.getToken();

  await fetcher(webhookUrl, {
    method: "POST", 
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return { status: "completed" };
}
