"use client";

/**
 * Client for the modulith core selectables API, through the app's
 * `/api/selectables/*` proxy. Members read; writes need an organization owner.
 */

import useSWR from "swr";
import type {
  Selectable,
  SelectableOption,
  SelectableSourceDescriptor,
} from "./types";

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/selectables`;

/** SWR keys are the full proxy URLs, so they never collide with other app keys. */
export const selectablesKey = BASE;
export const bindingsKey = `${BASE}/bindings`;
export const sourcesKey = `${BASE}/sources`;

export type SelectableWrite = Omit<
  Selectable,
  "key" | "updatedBy" | "updatedAt"
>;

async function request<T>(
  url: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers:
      init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let json: { error?: string } | undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // A gateway error page, say; fall back to the status below.
  }
  if (!response.ok) {
    throw new Error(json?.error ?? `HTTP ${response.status}`);
  }
  return json as T;
}

const fetcher = <T>(url: string) => request<T>(url);

export function useApiSelectables() {
  return useSWR<Selectable[]>(selectablesKey, fetcher, {
    revalidateOnFocus: false,
  });
}

export function replaceSelectable(key: string, body: SelectableWrite) {
  return request<Selectable>(`${BASE}/${key}`, { method: "PUT", body });
}

export function deleteSelectable(key: string) {
  return request<void>(`${BASE}/${key}`, { method: "DELETE" });
}

export function resetSelectables() {
  return request<Selectable[]>(`${BASE}/reset`, { method: "POST", body: {} });
}

export function useSelectableSources() {
  return useSWR<SelectableSourceDescriptor[]>(sourcesKey, fetcher, {
    revalidateOnFocus: false,
  });
}

export interface OptionsQuery {
  search?: string;
  parents?: string[];
  limit?: number;
}

export function optionsUrl(
  key: string,
  { search, parents, limit }: OptionsQuery = {}
): string {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("q", search.trim());
  parents?.forEach((p) => params.append("parent", p));
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return `${BASE}/${key}/options${query ? `?${query}` : ""}`;
}

/** Options fetched from the API: what a SYSTEM or CONNECTION list shows. `key` null pauses it. */
export function useSelectableOptions(key: string | null, query: OptionsQuery) {
  return useSWR<SelectableOption[]>(
    key ? optionsUrl(key, query) : null,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  );
}

export function useSelectableBindings() {
  return useSWR<Record<string, string>>(bindingsKey, fetcher);
}

export function updateSelectableBindings(bindings: Record<string, string>) {
  return request<Record<string, string>>(bindingsKey, {
    method: "PUT",
    body: { bindings },
  });
}
