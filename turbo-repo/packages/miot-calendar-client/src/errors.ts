import type { ErrorResponse } from "./types.js";

export class MiotCalendarApiError extends Error {
  override name = "MiotCalendarApiError" as const;

  constructor(
    public readonly status: number,
    public readonly body: ErrorResponse | string,
  ) {
    super(typeof body === "string" ? body : body.message);
  }
}
