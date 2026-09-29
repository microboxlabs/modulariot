"use client";

/**
 * Client for the modulith core selectables API, through the app's
 * `/api/selectables/*` proxy. Members read; writes need an organization owner.
 */

import useSWR from "swr";

export interface ApiSelectableOption {
  id: string;
  name: string;
  description: string;
}

export interface ApiSelectable {
  key: string;
  name: string;
  description: string | null;
  mode: "SINGLE" | "MULTIPLE";
  options: ApiSelectableOption[];
}

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/selectables`;

/** SWR keys are the full proxy URLs, so they never collide with other app keys. */
export const selectablesKey = BASE;
export const bindingsKey = `${BASE}/bindings`;

async function request<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
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

const fetcher = <T,>(url: string) => request<T>(url);

export function useApiSelectables() {
  return useSWR<ApiSelectable[]>(selectablesKey, fetcher);
}

export function replaceSelectable(key: string, body: Omit<ApiSelectable, "key">) {
  return request<ApiSelectable>(`${BASE}/${key}`, { method: "PUT", body });
}

export function deleteSelectable(key: string) {
  return request<void>(`${BASE}/${key}`, { method: "DELETE" });
}

export function resetSelectables() {
  return request<ApiSelectable[]>(`${BASE}/reset`, { method: "POST", body: {} });
}

export function useSelectableBindings() {
  return useSWR<Record<string, string>>(bindingsKey, fetcher);
}

export function updateSelectableBindings(bindings: Record<string, string>) {
  return request<Record<string, string>>(bindingsKey, { method: "PUT", body: { bindings } });
}
