import type { SonarCloudErrorResponse } from "../types.js";

const BASE_URL = "https://sonarcloud.io/api";

function authHeader(token: string): string {
  return `Basic ${Buffer.from(token + ":").toString("base64")}`;
}

export class SonarCloudApiError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "));
    this.name = "SonarCloudApiError";
  }
}

export async function sonarFetch<T>(
  path: string,
  params: Record<string, string>,
  token: string,
): Promise<T> {
  const url = new URL(`${BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    headers: { Authorization: authHeader(token) },
  });

  const body = await res.json();

  if ((body as SonarCloudErrorResponse).errors) {
    throw new SonarCloudApiError(
      (body as SonarCloudErrorResponse).errors.map((e) => e.msg),
    );
  }

  return body as T;
}
