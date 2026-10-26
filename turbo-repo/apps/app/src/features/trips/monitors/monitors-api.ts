"use client";

/**
 * Client for the trip monitors API (`/trips/monitors` and `/trips/access`)
 * through the app's `/api/trips/*` proxy. Types mirror the modulith's JSON.
 */

import useSWR, { mutate } from "swr";

export const TRIGGERS = [
  "plan",
  "signal",
  "timer",
  "stage",
  "command",
] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const STAGE_TYPES = [
  "preparation",
  "loading",
  "transit",
  "stop",
  "unloading",
  "closing",
] as const;

export const ACTIONS = [
  "advance",
  "start",
  "close",
  "completeTrip",
  "closeMandates",
  "cancelTrip",
  "requestConfirmation",
  "alert",
  "invoke",
] as const;
export type ActionType = (typeof ACTIONS)[number];

/** The trip's milestones in order: a detection asks a person or a system to confirm them. */
export const MILESTONES = [
  "presentation",
  "validation",
  "departure",
  "arrival",
  "closure",
] as const;
export type Milestone = (typeof MILESTONES)[number];

/** Actions whose value is a stage type; the flag actions take no value. */
export const STAGE_ACTIONS: readonly ActionType[] = [
  "advance",
  "start",
  "close",
];
export const FLAG_ACTIONS: readonly ActionType[] = [
  "completeTrip",
  "closeMandates",
];

export type ParamValue = number | boolean | string;

export interface StagePlan {
  stageType: string;
  serviceStatus: string | null;
}

export interface Action {
  type: ActionType;
  value: string | null;
}

export interface Rule {
  key: string;
  name: string | null;
  on: Trigger;
  at: string | null;
  when: string | null;
  then: Action[];
  priority: number;
  active: boolean;
}

/** A problem in the draft; `field` is `when`, `at`, `then` or `scope` (with no rule). */
export interface Finding {
  ruleKey: string | null;
  field: string;
  position: number;
  message: string;
}

/**
 * The trips a monitor takes: each list holds the accepted values, and an empty
 * list accepts any. Origins and destinations are location ids.
 */
export interface MonitorScope {
  feeds: string[];
  orderTypes: string[];
  origins: string[];
  destinations: string[];
}

export const SCOPE_DIMENSIONS = [
  "feeds",
  "orderTypes",
  "origins",
  "destinations",
] as const;
export type ScopeDimension = (typeof SCOPE_DIMENSIONS)[number];

export const ANY_TRIP: MonitorScope = {
  feeds: [],
  orderTypes: [],
  origins: [],
  destinations: [],
};

/**
 * How a scope stands to another published monitor's: NARROWER takes the trips
 * of both, BROADER leaves them to the other one, DUPLICATE blocks publishing.
 */
export type ScopeRelation = "NARROWER" | "BROADER" | "DUPLICATE";

export interface ScopeOverlap {
  key: string;
  name: string;
  relation: ScopeRelation;
}

export interface ScopeValues {
  feeds: { key: string; name: string }[];
  orderTypes: string[];
  locations: { id: string; name: string; code: string | null; type: string }[];
}

export interface Monitor {
  key: string;
  version: number;
  status: "draft" | "published";
  name: string;
  description: string | null;
  plan: StagePlan[];
  params: Record<string, ParamValue>;
  rules: Rule[];
  scope: MonitorScope | null;
  updatedAt: string | null;
  updatedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  findings: Finding[];
}

export interface MonitorSummary {
  key: string;
  name: string;
  description: string | null;
  publishedVersion: number | null;
  draftVersion: number | null;
  rules: number;
  scope: MonitorScope | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface MonitorVersion {
  version: number;
  status: "draft" | "published";
  publishedAt: string | null;
  publishedBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface MonitorDetail {
  key: string;
  draft: Monitor | null;
  published: Monitor | null;
  versions: MonitorVersion[];
}

export interface SchemaField {
  path: string;
  type: string;
}

export interface CheckResult {
  ok: boolean;
  resultType: string | null;
  findings: Finding[];
}

/** The body of a draft: what the editor changes. */
export type MonitorBody = Pick<
  Monitor,
  "name" | "description" | "plan" | "params" | "rules" | "scope"
>;

export class TripsApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const API_ROOT = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/`;
const BASE = `${API_ROOT}trips`;

export const MONITOR_ADMIN = "trips:monitor.admin";

export const monitorsKey = `${BASE}/monitors`;
export const monitorKey = (key: string) =>
  `${BASE}/monitors/${encodeURIComponent(key)}`;
const scopeValuesKey = `${BASE}/monitors/scope-values`;
const accessKey = `${BASE}/access`;

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Throws the API's `{error}` message, so callers can show it. */
export async function tripsRequest<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const url = path.startsWith(API_ROOT) ? path : `${BASE}${path}`;
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers:
      init?.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const json = text ? parseJson(text) : undefined;
  if (!response.ok) {
    throw new TripsApiError(
      json?.error ?? json?.message ?? `HTTP ${response.status}`,
      response.status
    );
  }
  return json as T;
}

const fetcher = <T>(url: string) => tripsRequest<T>(url);

export function useMonitors() {
  return useSWR<MonitorSummary[]>(monitorsKey, fetcher);
}

export function useMonitor(key: string | null) {
  return useSWR<MonitorDetail>(key ? monitorKey(key) : null, fetcher);
}

/** Whether the caller holds a trips permission; false until the access loads. */
export function useTripsPermission(permission: string) {
  const { data } = useSWR<{ permissions: string[] }>(accessKey, fetcher);
  return data?.permissions?.includes(permission) ?? false;
}

export function useCanEditMonitors() {
  return useTripsPermission(MONITOR_ADMIN);
}

/** The fields an expression of `on` may read, with the monitor's parameters. */
export function useMonitorSchema(
  on: Trigger,
  params: Record<string, ParamValue>
) {
  return useSWR<SchemaField[]>(
    [`${monitorsKey}/schema`, on, JSON.stringify(params)],
    ([url]: [string]) =>
      tripsRequest<SchemaField[]>(url, {
        method: "POST",
        body: { on, params },
      }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );
}

export function checkExpression(body: {
  on: Trigger;
  expression: string;
  expect: "condition" | "time";
  params: Record<string, ParamValue>;
}) {
  return tripsRequest<CheckResult>(`${monitorsKey}/check`, {
    method: "POST",
    body,
  });
}

export async function saveDraft(key: string, body: MonitorBody) {
  const saved = await tripsRequest<Monitor>(monitorKey(key), {
    method: "PUT",
    body,
  });
  await Promise.all([mutate(monitorKey(key)), mutate(monitorsKey)]);
  return saved;
}

export async function publishMonitor(key: string) {
  const published = await tripsRequest<Monitor>(`${monitorKey(key)}/publish`, {
    method: "POST",
  });
  await Promise.all([mutate(monitorKey(key)), mutate(monitorsKey)]);
  return published;
}

export async function discardDraft(key: string) {
  await tripsRequest<void>(`${monitorKey(key)}/draft`, { method: "DELETE" });
  await Promise.all([mutate(monitorKey(key)), mutate(monitorsKey)]);
}

export function getVersion(key: string, version: number) {
  return tripsRequest<Monitor>(`${monitorKey(key)}/versions/${version}`);
}

/** The feeds, order types and locations a scope can name. */
export function useScopeValues() {
  return useSWR<ScopeValues>(scopeValuesKey, fetcher, {
    revalidateOnFocus: false,
  });
}

/** How `scope` stands to the other published monitors; disjoint ones are left out. */
export function useScopeCheck(key: string, scope: MonitorScope | null) {
  return useSWR<{ overlaps: ScopeOverlap[] }>(
    scope ? [`${monitorKey(key)}/scope-check`, JSON.stringify(scope)] : null,
    ([url]: [string]) =>
      tripsRequest<{ overlaps: ScopeOverlap[] }>(url, {
        method: "POST",
        body: { scope },
      }),
    { revalidateOnFocus: false }
  );
}

/** A new rule of `on`, with a key not yet used in the monitor. */
export function newRule(on: Trigger, taken: string[]): Rule {
  let n = taken.length + 1;
  while (taken.includes(`rule-${n}`)) n++;
  return {
    key: `rule-${n}`,
    name: null,
    on,
    at: on === "timer" ? "trip.plannedStart" : null,
    when: null,
    then: [{ type: "alert", value: "" }],
    priority: 100,
    active: true,
  };
}

/** The draft body of a monitor, to start editing it. */
export function bodyOf(m: Monitor): MonitorBody {
  return {
    name: m.name,
    description: m.description,
    plan: m.plan,
    params: m.params,
    rules: m.rules,
    scope: m.scope,
  };
}
