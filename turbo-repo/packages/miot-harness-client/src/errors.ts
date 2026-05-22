import type { ErrorResponse } from "./types.js";

export class MiotHarnessApiError extends Error {
  override name = "MiotHarnessApiError" as const;

  constructor(
    public readonly code: string,
    public readonly runId?: string,
    public readonly body?: ErrorResponse | string,
    public readonly status?: number,
  ) {
    super(messageOf(body, code));
  }
}

function messageOf(
  body: ErrorResponse | string | undefined,
  code: string,
): string {
  if (typeof body === "string" && body.length > 0) return body;
  if (typeof body === "object" && body !== null) {
    if (typeof body.message === "string") return body.message;
    if (typeof body.error === "string") return body.error;
    if (typeof body.detail === "string") return body.detail;
  }
  return `harness error: ${code}`;
}
