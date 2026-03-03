import "server-only";

import type { ExternalTask } from "../ext-task.types";

/**
 * Validates a token and extracts the external task data.
 *
 * **Interim implementation**: base64url-decodes the token JSON payload.
 * **Future**: Replace internals with Alfresco node lookup by token UUID.
 * The function signature stays the same — this is the only integration point.
 */
export async function validateAndGetTask(
  token: string,
  taskType: string,
): Promise<ExternalTask> {
  let decoded: ExternalTask;

  try {
    const json = Buffer.from(token, "base64url").toString("utf-8");
    decoded = JSON.parse(json) as ExternalTask;
  } catch {
    throw new ExtTaskError("Invalid token", 404);
  }

  if (decoded.taskType !== taskType) {
    throw new ExtTaskError("Token task type mismatch", 400);
  }

  if (!decoded.expiresAt || new Date(decoded.expiresAt) < new Date()) {
    throw new ExtTaskError("Token has expired", 410);
  }

  return decoded;
}

export class ExtTaskError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ExtTaskError";
    this.statusCode = statusCode;
  }
}
