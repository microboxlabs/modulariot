"use client";

import { ApiError, getJson } from "../data/json-client";
import type {
  CreateDataShare,
  DataShare,
  DataShareAsset,
  DataShareOrg,
  DataSharingFigures,
} from "./platform.types";

/** Client wrappers for `/api/v1/platform/data-sharing`, through the Next.js proxy. */

const BASE = "/app/api/admin/platform/data-sharing";

/** The modulith refused the share; `code` is a key under `form.errors`. */
export class ShareRejectedError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Share rejected: ${code}`);
    this.name = "ShareRejectedError";
    this.code = code;
  }
}

export function fetchSharingOrgs(): Promise<DataShareOrg[]> {
  return getJson<DataShareOrg[]>(`${BASE}/orgs`);
}

export function fetchShareableAssets(slug: string): Promise<DataShareAsset[]> {
  return getJson<DataShareAsset[]>(
    `${BASE}/orgs/${encodeURIComponent(slug)}/assets`
  );
}

export function fetchDataShares(): Promise<DataShare[]> {
  return getJson<DataShare[]>(`${BASE}/shares`);
}

export function fetchSharingFigures(): Promise<DataSharingFigures> {
  return getJson<DataSharingFigures>(`${BASE}/summary`);
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    return (await res.json()) as T;
  }
  const parsed = (await res.json().catch(() => ({}))) as {
    code?: string;
    error?: string;
  };
  if (res.status === 400 && parsed.code) {
    throw new ShareRejectedError(parsed.code);
  }
  throw new ApiError({ status: res.status, url, message: parsed.error });
}

export function createDataShare(draft: CreateDataShare): Promise<DataShare> {
  return post<DataShare>(`${BASE}/shares`, draft);
}

export function revokeDataShare(id: string): Promise<DataShare> {
  return post<DataShare>(`${BASE}/shares/${encodeURIComponent(id)}/revoke`, {});
}
