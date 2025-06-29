/**
 * An error type that extends the built-in Error class with additional properties:
 * - info: Additional error information from the response
 * - status: The HTTP status code of the response
 */
export type FetcherError = Error & {
    info: Record<string, unknown>;
    status: number;
};
  

/**
 * Fetches data from the API and throws an error if the response is not ok.
 * @param input - The URL to fetch from.
 * @param init - The request init object.
 * @returns The response body as a JSON object.
 */
export default async function fetcher<T>(
    input: RequestInfo | URL,
    init?: RequestInit,
  ) {
    const response = await fetch(input, init);
    if (!response.ok) {
      const error = new Error(response.statusText) as FetcherError;
      error.info = await response.json();
      error.status = response.status;
      throw error;
    }
    return response.json() as T;
}
  
/**
 * Converts an `include` object (e.g., Prisma include) to a query string for use in API requests.
 * Only includes keys with truthy values.
 *
 * @param include - An object where keys are field names and values are booleans or strings
 * @returns A query string starting with '?' if any keys are included, otherwise an empty string
 */
export function buildIncludeQuery(include?: Record<string, any>): string {
  if (!include) return '';
  const queryParams = new URLSearchParams();
  for (const key in include) {
    if (include[key]) {
      queryParams.set(key, include[key] as string);
    }
  }
  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
}


export function deleteFetcher(url: string): Promise<void> {
  return fetcher(url, {
    method: 'DELETE',
  });
}
  