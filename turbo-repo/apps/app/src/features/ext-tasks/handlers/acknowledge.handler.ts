import "server-only";

import { getSharedAuthToken } from "@/app/api/utils/streamhub-api-client";
import fetcher from "@/features/common/providers/fetcher";
import type { TaskExecutionResult } from "../ext-task.types";

export async function acknowledgeHandler(
  payload: Record<string, unknown>,
): Promise<TaskExecutionResult> {
  const webhookUrl = process.env.EXT_TASKS_WEBHOOK_URL;
  if (!webhookUrl) {
    // DEMO LOCAL: sin webhook configurado, el tratamiento igual queda creado;
    // se omite el aviso externo en vez de reventar el flujo.
    console.warn("EXT_TASKS_WEBHOOK_URL not configured — skipping external ack");
    return { status: "completed" };
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
