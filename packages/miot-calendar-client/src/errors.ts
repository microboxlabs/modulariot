import type { ErrorResponse } from "./types.js";

export class MiotCalendarApiError extends Error {
  override name = "MiotCalendarApiError" as const;

  constructor(
    public readonly status: number,
    public readonly body: ErrorResponse,
  ) {
    super(body.message);
  }
}
