"use client";

/**
 * Shared fetch wrappers for the settings admin UI's calls to the Next.js
 * proxy routes. Non-2xx throws {@link ApiError} so SWR surfaces it rather
 * than caching a failure as data.
 */

interface ApiErrorOptions {
  readonly status: number;
  readonly url: string;
  readonly message?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor({ status, url, message }: ApiErrorOptions) {
    super(message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError({ status: res.status, url });
  }
  return (await res.json()) as T;
}

export async function sendJson<T>(
  method: string,
  url: string,
  body: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError({ status: res.status, url, message: await reason(res) });
  }
  return (await res.json()) as T;
}

/** For endpoints that answer 204, where there is no body to parse. */
export async function sendEmpty(method: string, url: string): Promise<void> {
  const res = await fetch(url, { method });
  if (!res.ok) {
    throw new ApiError({ status: res.status, url, message: await reason(res) });
  }
}

/**
 * The upstream's own explanation, when it sent one. The modulith answers a
 * rejected write with a message worth showing ("Unsupported logo type:
 * application/pdf"); anything unparseable leaves ApiError's default text.
 */
async function reason(res: Response): Promise<string | undefined> {
  try {
    const parsed = (await res.json()) as {
      message?: string;
      error?: string | { message?: string };
    };
    if (parsed.message) return parsed.message;
    if (typeof parsed.error === "string") return parsed.error;
    return parsed.error?.message;
  } catch {
    return undefined;
  }
}
