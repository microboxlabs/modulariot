import { MiotHarnessApiError } from "./errors.js";
import { createRunsApi } from "./resources/runs.js";
import type { ClientConfig, ErrorResponse } from "./types.js";

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type Fetcher = <T>(
  method: string,
  path: string,
  options?: RequestOptions,
) => Promise<T>;

export interface ClientContext {
  fetcher: Fetcher;
  request(method: string, path: string, options?: RequestOptions): Promise<Response>;
}

function trimTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 0x2f /* '/' */) end--;
  return end === s.length ? s : s.slice(0, end);
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const normalizedBase = trimTrailingSlashes(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function buildHeaders(
  config: ClientConfig,
  options?: RequestOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    ...config.headers,
    ...options?.headers,
  };
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
  if (options?.body !== undefined) headers["Content-Type"] = "application/json";
  return headers;
}

export function createMiotHarnessClient(config: ClientConfig) {
  const fetchFn = config.fetch ?? globalThis.fetch;

  const rawRequest = async (
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<Response> => {
    const url = buildUrl(config.baseUrl, path, options?.query);
    const headers = buildHeaders(config, options);
    return fetchFn(url, {
      method,
      headers,
      body:
        options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options?.signal,
    });
  };

  const fetcher: Fetcher = async <T>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<T> => {
    const response = await rawRequest(method, path, options);
    if (!response.ok) {
      let body: ErrorResponse | string;
      try {
        body = (await response.json()) as ErrorResponse;
      } catch {
        body = await response.text().catch(() => "");
      }
      throw new MiotHarnessApiError(
        `http_${response.status}`,
        undefined,
        body,
        response.status,
      );
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  };

  const ctx: ClientContext = { fetcher, request: rawRequest };

  return {
    runs: createRunsApi(ctx),
  };
}

export type MiotHarnessClient = ReturnType<typeof createMiotHarnessClient>;
