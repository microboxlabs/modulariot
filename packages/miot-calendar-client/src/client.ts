import type { ClientConfig } from "./types.js";
import { MiotCalendarApiError } from "./errors.js";
import { createBookingsApi } from "./resources/bookings.js";
import { createCalendarsApi } from "./resources/calendars.js";
import { createSlotsApi } from "./resources/slots.js";

export interface FetchOptions<TBody = unknown> {
  body?: TBody;
  query?: Record<string, string | boolean | undefined>;
  headers?: Record<string, string>;
}

export type Fetcher = <T, TBody = unknown>(
  method: string,
  path: string,
  options?: FetchOptions<TBody>,
) => Promise<T>;

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | boolean | undefined>,
): string {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export function createMiotCalendarClient(config: ClientConfig) {
  const fetchFn = config.fetch ?? globalThis.fetch;

  const fetcher: Fetcher = async <T>(
    method: string,
    path: string,
    options?: FetchOptions,
  ): Promise<T> => {
    const url = buildUrl(config.baseUrl, path, options?.query);

    const headers: Record<string, string> = {
      ...config.headers,
      ...options?.headers,
    };

    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetchFn(url, {
      method,
      headers,
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      let body: import("./types.js").ErrorResponse | string;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
      throw new MiotCalendarApiError(response.status, body);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  };

  return {
    bookings: createBookingsApi(fetcher),
    calendars: createCalendarsApi(fetcher),
    slots: createSlotsApi(fetcher),
  };
}
