import type { ErrorResponse } from "./types.js";

export class MiotConnectionApiError extends Error {
  override name = "MiotConnectionApiError" as const;

  constructor(
    public readonly status: number,
    public readonly body: ErrorResponse | string,
  ) {
    super(typeof body === "string" ? body : body.message);
  }
}
