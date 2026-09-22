"use client";

/**
 * Client for the modulith Control Tower API, through the app's
 * `/api/control-tower/*` proxy. Types mirror the API's JSON; see
 * `quarkus-srv/miot-symptoms/docs/control-tower-api.md`.
 */

import useSWR from "swr";

export type TowerTreatmentType = "CALL" | "IGNORE_CONDITION" | "INVALIDATE_SYMPTOM";
export type TowerTreatmentStatus = "OPEN" | "CLOSED" | "CANCELLED";
export type TowerActionKind = "CALL" | "IGNORE" | "INVALIDATE" | "NOTE";
export type TowerCallMethod = "PHONE" | "WHATSAPP" | "MEET" | "TEAMS";

export interface TowerAction {
  id: string;
  treatmentId: string;
  seq: number;
  kind: TowerActionKind;
  contactId: string | null;
  contactName: string | null;
  contactRole: string | null;
  contactPhone: string | null;
  method: TowerCallMethod | null;
  outcomeKey: string | null;
  outcomeLabel: string | null;
  answered: boolean | null;
  durationSeconds: number | null;
  message: string | null;
  note: string | null;
  tags: string[];
  details: Record<string, unknown>;
  performedBy: string | null;
  performedAt: string;
}

export interface TowerTreatment {
  id: string;
  symptomId: number;
  assetId: string | null;
  tripId: string | null;
  type: TowerTreatmentType;
  status: TowerTreatmentStatus;
  openedBy: string | null;
  openedAt: string;
  closedBy: string | null;
  closedAt: string | null;
  resolution: string | null;
  note: string | null;
  updatedAt: string;
  actions: TowerAction[];
}

export interface TowerContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  methods: TowerCallMethod[];
  active: boolean;
  notes: string | null;
  lastCalledAt: string | null;
  answered: number;
  missed: number;
}

export interface TowerSelectableOption {
  id: string;
  name: string;
  description: string;
}

export interface TowerSelectable {
  key: string;
  name: string;
  description: string | null;
  mode: "SINGLE" | "MULTIPLE";
  options: TowerSelectableOption[];
}

export type AddActionBody = Partial<Omit<TowerAction, "id" | "treatmentId" | "seq" | "performedBy" | "performedAt">> & {
  kind: TowerActionKind;
};

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/control-tower`;

/** Error carrying the API's `{error}` message, so callers can show it. */
export class ControlTowerError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** `path` is relative to the proxy, or a full key from the `*Key` helpers. */
async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const url = path.startsWith(BASE) ? path : `${BASE}${path}`;
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    throw new ControlTowerError(json?.error ?? `HTTP ${response.status}`, response.status);
  }
  return json as T;
}

const fetcher = <T,>(path: string) => request<T>(path);

/** SWR keys are the full proxy URLs, so they never collide with other app keys. */
export const treatmentsKey = (symptomId: number | string) => `${BASE}/symptoms/${symptomId}/treatments`;
export const contactsKey = `${BASE}/contacts`;
export const selectablesKey = `${BASE}/selectables`;
export const bindingsKey = `${BASE}/selectables/bindings`;

/* ---------- treatments ---------- */

export function useSymptomTreatments(symptomId: number | string | null | undefined) {
  return useSWR<TowerTreatment[]>(symptomId ? treatmentsKey(symptomId) : null, fetcher);
}

export function openTreatment(
  symptomId: number | string,
  body: { type: TowerTreatmentType; assetId?: string; tripId?: string; note?: string }
) {
  return request<TowerTreatment>(treatmentsKey(symptomId), { method: "POST", body });
}

export function addTreatmentAction(treatmentId: string, body: AddActionBody) {
  return request<TowerAction>(`/treatments/${treatmentId}/actions`, { method: "POST", body });
}

export function closeTreatment(treatmentId: string, body: { resolution?: string; note?: string } = {}) {
  return request<TowerTreatment>(`/treatments/${treatmentId}/close`, { method: "POST", body });
}

export function cancelTreatment(treatmentId: string, reason?: string) {
  return request<TowerTreatment>(`/treatments/${treatmentId}/cancel`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

/* ---------- contacts ---------- */

export function useContacts() {
  return useSWR<TowerContact[]>(contactsKey, fetcher);
}

export function createContact(body: {
  name: string;
  role?: string;
  phone?: string;
  methods?: TowerCallMethod[];
}) {
  return request<TowerContact>(contactsKey, { method: "POST", body });
}

/* ---------- selectables ---------- */

export function useTowerSelectables() {
  return useSWR<TowerSelectable[]>(selectablesKey, fetcher);
}

export function replaceSelectable(key: string, body: Omit<TowerSelectable, "key">) {
  return request<TowerSelectable>(`${selectablesKey}/${key}`, { method: "PUT", body });
}

export function deleteSelectable(key: string) {
  return request<void>(`${selectablesKey}/${key}`, { method: "DELETE" });
}

export function resetSelectables() {
  return request<TowerSelectable[]>(`${selectablesKey}/reset`, { method: "POST", body: {} });
}

export function useSelectableBindings() {
  return useSWR<Record<string, string>>(bindingsKey, fetcher);
}

export function updateSelectableBindings(bindings: Record<string, string>) {
  return request<Record<string, string>>(bindingsKey, { method: "PUT", body: { bindings } });
}
