import { FetcherError } from "./fetcher.types";

export default async function fetcher<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const error = new Error(response.statusText) as FetcherError;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    error.info = await response.json();
    error.status = response.status;
    throw error;
  }
  return response.json() as T;
}
