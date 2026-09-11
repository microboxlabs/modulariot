import { FetcherError } from "./fetcher.types";

export type DescribedError = {
  status: number;
  code: string;
  message: string;
};

function messageFromInfo(info: FetcherError["info"]): string | null {
  if (!info) return null;
  if (typeof info === "string") {
    try {
      const parsed = JSON.parse(info) as { message?: unknown };
      return typeof parsed.message === "string" ? parsed.message : null;
    } catch {
      return null;
    }
  }
  if (typeof info.message === "string") return info.message;
  if (typeof info.responseText === "string") {
    try {
      const parsed = JSON.parse(info.responseText) as {
        message?: unknown;
        error?: unknown;
      };
      if (typeof parsed.message === "string") return parsed.message;
      if (typeof parsed.error === "string") return parsed.error;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Flattens anything thrown around a `fetcher` call into a serializable
 * `{ status, code, message }`. `info` may be a string, an object, or null.
 */
export function describeError(err: unknown): DescribedError {
  if (!(err instanceof Error)) {
    return { status: 500, code: "UNKNOWN", message: String(err) };
  }
  const e = err as Partial<FetcherError> & Error;
  const status = typeof e.status === "number" ? e.status : 500;
  const message = messageFromInfo(e.info ?? null) ?? err.message;
  return { status, code: codeOf(e), message };
}

function codeOf(err: Partial<FetcherError> & Error): string {
  if (typeof err.code === "string") return err.code;
  if (err.name === "AbortError" || err.name === "TimeoutError") return "TIMEOUT";
  return "UNKNOWN";
}
