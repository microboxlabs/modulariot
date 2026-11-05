"use client";

/**
 * Client for the modulith Control Tower API, through the app's
 * `/api/control-tower/*` proxy. Types mirror the API's JSON; see
 * `quarkus-srv/miot-symptoms/docs/control-tower-api.md`.
 */

import useSWR, { mutate } from "swr";
import { z } from "zod/v3";
import useSWRInfinite from "swr/infinite";

export type TowerTreatmentType =
  | "CALL"
  | "IGNORE_CONDITION"
  | "INVALIDATE_SYMPTOM";
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

/** Address per channel: numbers for phone and WhatsApp, account emails for Meet and Teams. */
export interface TowerContactChannels {
  phone?: string;
  whatsapp?: string;
  meet?: string;
  teams?: string;
  /** Where communication rules send email. */
  email?: string;
}

export interface TowerContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  methods: TowerCallMethod[];
  active: boolean;
  notes: string | null;
  /** Stored without dots or dashes, upper case. Unique in the organization. */
  nationalId: string | null;
  nationalIdType: string | null;
  company: string | null;
  /** The company's tax id, stored without dots or dashes, upper case. */
  companyRut?: string | null;
  /** RUT, RUC or OTRO. */
  companyTaxIdType?: string | null;
  position: string | null;
  channels: TowerContactChannels | null;
  tags: string[] | null;
  memberUserId: string | null;
  provisional: boolean;
  lastCalledAt: string | null;
  answered: number;
  missed: number;
}

/** One page of the book; `next` is the cursor of the following page, null on the last. */
export interface TowerContactPage {
  items: TowerContact[];
  next: string | null;
}

/** Which contacts a page holds. `role`, `company` and `tag` match whole values, ignoring case. */
export interface TowerContactQuery {
  q?: string;
  kind?: "member" | "external";
  role?: string;
  company?: string;
  tag?: string;
}

/** What the whole book holds, for the filters and pickers. */
export interface TowerContactFacets {
  total: number;
  roles: string[];
  companies: { name: string; rut: string | null; taxIdType: string | null }[];
  tags: string[];
  members: { memberUserId: string; contactId: string }[];
}

/** The book's people for each step of a case, as the server evaluated the steps' conditions. */
export interface TowerTripContacts {
  /** `event.data` the conditions read: the trip's driverRut, secondDriverRut and carrierRut, when it has them. */
  data: Partial<Record<"driverRut" | "secondDriverRut" | "carrierRut", string>>;
  /** For each condition, in order, the ids of the active contacts that meet it. */
  matches: string[][];
  /** For each condition, its compile problem, or null. */
  problems: (string | null)[];
}

/** Create or update body. On update, a field left out keeps its value and "" clears it. */
export interface TowerContactBody {
  name?: string;
  role?: string;
  phone?: string;
  methods?: TowerCallMethod[];
  active?: boolean;
  notes?: string;
  nationalId?: string;
  nationalIdType?: string;
  company?: string;
  companyRut?: string;
  companyTaxIdType?: string;
  position?: string;
  channels?: TowerContactChannels;
  tags?: string[];
  memberUserId?: string;
  provisional?: boolean;
}

export interface TowerContactImportRow {
  index: number;
  status: "created" | "skipped" | "error";
  reason: string | null;
  contact: TowerContact | null;
}

export interface TowerContactImportResult {
  created: number;
  skipped: number;
  errors: number;
  rows: TowerContactImportRow[];
}

export type AddActionBody = Partial<
  Omit<
    TowerAction,
    "id" | "treatmentId" | "seq" | "performedBy" | "performedAt"
  >
> & {
  kind: TowerActionKind;
};

const API_ROOT = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/`;
const BASE = `${API_ROOT}control-tower`;

/** Error carrying the API's `{error}` message, so callers can show it. */
export class ControlTowerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The API's `{code}`, when it names the reason (e.g. telephony_quota_exhausted). */
    readonly code?: string
  ) {
    super(message);
  }
}

/** A gateway error page is HTML, not JSON; the status still reaches the caller. */
function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** `path` is relative to the proxy, or a full app API URL such as a key from the `*Key` helpers. */
async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const url = path.startsWith(API_ROOT) ? path : `${BASE}${path}`;
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
  const json = text ? parseJson(text) : undefined;
  if (!response.ok) {
    throw new ControlTowerError(
      json?.error ?? `HTTP ${response.status}`,
      response.status,
      typeof json?.code === "string" ? json.code : undefined
    );
  }
  return json as T;
}

const fetcher = <T>(path: string) => request<T>(path);

/** SWR keys are the full proxy URLs, so they never collide with other app keys. */
export const treatmentsKey = (symptomId: number | string) =>
  `${BASE}/symptoms/${symptomId}/treatments`;

const GENERAL_KEY = "/app/api/treatments/general?id=";
const LOCATION_KEY = "/app/api/treatments/location?";

/**
 * True for every SWR key that shows one case: its Control Tower treatments,
 * timeline and context, the general-treatments data (the case timeline and
 * side info), its map signals, and the symptom lists and inbox.
 */
export function isCaseKey(symptomId: number | string, key: unknown): boolean {
  if (typeof key !== "string") return false;
  const id = String(symptomId);
  if (key === treatmentsKey(id)) return true;
  if (key.startsWith(`${BASE}/map/symptoms/${id}/`)) return true;
  if (key === `${GENERAL_KEY}${id}`) return true;
  if (key.startsWith(LOCATION_KEY)) {
    return (
      new URLSearchParams(key.slice(LOCATION_KEY.length)).get("symptom_id") ===
      id
    );
  }
  return key.startsWith("/app/api/symptoms");
}

/** Refetches everything that shows the case, after a save changed it. */
export async function revalidateCase(
  symptomId: number | string | null | undefined
): Promise<void> {
  if (symptomId == null || symptomId === "") return;
  await mutate((key) => isCaseKey(symptomId, key));
}

export const contactsKey = `${BASE}/contacts`;
export const contactFacetsKey = `${BASE}/contacts/facets`;
export const tripContactsPath = `${BASE}/contacts/trip`;
export const CONTACT_PAGE_SIZE = 100;

export function contactPageKey(
  query: TowerContactQuery,
  cursor?: string | null
): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value) params.set(name, value);
  }
  params.set("limit", String(CONTACT_PAGE_SIZE));
  if (cursor) params.set("cursor", cursor);
  return `${BASE}/contacts/page?${params}`;
}

/* ---------- script context ---------- */

/**
 * What an operator step's script reads for a case: `case`, `condition`,
 * `trip` and `vehicle`, written in a script as `{{trip.driver.name}}`.
 */
export type ScriptContext = Record<string, unknown>;

/** A recent case of a symptom, with the context a script reads. */
export interface ScriptSample {
  symptom_id: number;
  asset_id: string;
  icu_code: number;
  opened_at: string;
  context: ScriptContext;
}

const scriptContextSchema = z
  .object({
    case: z.record(z.unknown()),
    condition: z.record(z.unknown()),
    trip: z.record(z.unknown()),
    vehicle: z.record(z.unknown()),
  })
  .passthrough();
const scriptSamplesSchema = z.array(
  z
    .object({
      symptom_id: z.number().int(),
      asset_id: z.string(),
      icu_code: z.number().int(),
      opened_at: z.string().datetime({ offset: true }),
      context: scriptContextSchema,
    })
    .passthrough()
);

export function parseScriptContext(value: unknown): ScriptContext {
  return scriptContextSchema.parse(value);
}

export function parseScriptSamples(value: unknown): ScriptSample[] {
  return scriptSamplesSchema.parse(value);
}

/** The symptom's newest engine cases, those at `level` first, to write a script with real data. */
export function useScriptSamples(
  symptomName: string | null | undefined,
  level: number | null | undefined
) {
  const params = new URLSearchParams();
  if (symptomName) params.set("symptom", symptomName);
  if (level != null) params.set("level", String(level));
  return useSWR<ScriptSample[]>(
    symptomName ? `${BASE}/map/script-samples?${params}` : null,
    async (url: string) => parseScriptSamples(await fetcher(url))
  );
}

/** One moment of an engine case's life, as `GET /map/symptoms/{id}/timeline` lists it. */
const caseTimelineEntrySchema = z.object({
  kind: z.enum([
    "OPENED",
    "LEVEL_CHANGED",
    "NOTED",
    "HELD",
    "ACTION",
    "CLOSED",
  ]),
  at: z.string().datetime({ offset: true }),
  level: z.number().int().optional(),
  previousLevel: z.number().int().optional(),
  eventType: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  action: z.string().optional(),
  by: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
  // The closing rule's opaque JSON context is displayed by the sample tree.
  context: z.unknown().optional(),
});

export type CaseTimelineEntry = z.infer<typeof caseTimelineEntrySchema>;

export function parseCaseTimeline(data: unknown): CaseTimelineEntry[] {
  return z.array(caseTimelineEntrySchema).parse(data);
}

/** An engine case's life in time order; none for other cases. */
export function useCaseTimeline(symptomId: number | null | undefined) {
  return useSWR<CaseTimelineEntry[]>(
    symptomId != null && symptomId < 0
      ? `${BASE}/map/symptoms/${symptomId}/timeline`
      : null,
    async (url: string) => parseCaseTimeline(await fetcher(url))
  );
}

/** The context a script reads for one engine case (negative id); none for other cases. */
export function useCaseContext(symptomId: number | null | undefined) {
  return useSWR<ScriptContext>(
    symptomId != null && symptomId < 0
      ? `${BASE}/map/symptoms/${symptomId}/context`
      : null,
    async (url: string) => parseScriptContext(await fetcher(url))
  );
}

/* ---------- treatments ---------- */

export function useSymptomTreatments(
  symptomId: number | string | null | undefined
) {
  return useSWR<TowerTreatment[]>(
    symptomId ? treatmentsKey(symptomId) : null,
    fetcher
  );
}

export function openTreatment(
  symptomId: number | string,
  body: {
    type: TowerTreatmentType;
    assetId?: string;
    tripId?: string;
    note?: string;
  }
) {
  return request<TowerTreatment>(treatmentsKey(symptomId), {
    method: "POST",
    body,
  });
}

export function addTreatmentAction(treatmentId: string, body: AddActionBody) {
  return request<TowerAction>(`/treatments/${treatmentId}/actions`, {
    method: "POST",
    body,
  });
}

export function closeTreatment(
  treatmentId: string,
  body: { resolution?: string; note?: string } = {}
) {
  return request<TowerTreatment>(`/treatments/${treatmentId}/close`, {
    method: "POST",
    body,
  });
}

/** "Reanudar": ends an engine case's "Ignorar condición" hold early. */
export function resumeTreatment(treatmentId: string) {
  return request<TowerTreatment>(`/treatments/${treatmentId}/resume`, {
    method: "POST",
    body: {},
  });
}

export function cancelTreatment(treatmentId: string, reason?: string) {
  return request<TowerTreatment>(`/treatments/${treatmentId}/cancel`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

/* ---------- contacts ---------- */

/** The whole book in one request; `enabled` false fetches nothing. */
export function useContacts(enabled = true) {
  return useSWR<TowerContact[]>(enabled ? contactsKey : null, fetcher);
}

/** The book 100 at a time: `setSize(size + 1)` fetches the next page. */
export function useContactPages(query: TowerContactQuery) {
  return useSWRInfinite<TowerContactPage>(
    (index, previous: TowerContactPage | null) =>
      index > 0 && !previous?.next
        ? null
        : contactPageKey(query, previous?.next),
    fetcher,
    { revalidateFirstPage: false, keepPreviousData: true }
  );
}

/**
 * The book's people for each condition (a step's `who`), with the case trip's
 * RUTs as `event.data`. Other cases than engine ones (negative ids) have no
 * trip, so a condition that reads it finds nobody.
 */
export function useTripContacts(
  symptomId: number | null | undefined,
  conditions: readonly string[]
) {
  const key =
    symptomId != null && conditions.length > 0
      ? ([tripContactsPath, String(symptomId), ...conditions] as const)
      : null;
  return useSWR<TowerTripContacts>(key, () =>
    request<TowerTripContacts>(tripContactsPath, {
      method: "POST",
      body: { symptomId: String(symptomId), conditions },
    })
  );
}

export function useContactFacets() {
  return useSWR<TowerContactFacets>(contactFacetsKey, fetcher);
}

/** Every contact that passes `query`, page after page. */
export async function fetchAllContacts(
  query: TowerContactQuery
): Promise<TowerContact[]> {
  const all: TowerContact[] = [];
  async function fetchPage(cursor: string | null): Promise<TowerContact[]> {
    const page: TowerContactPage = await request<TowerContactPage>(
      contactPageKey(query, cursor)
    );
    all.push(...page.items);
    return page.next ? fetchPage(page.next) : all;
  }
  return fetchPage(null);
}

export function createContact(body: TowerContactBody & { name: string }) {
  return request<TowerContact>(contactsKey, { method: "POST", body });
}

export function updateContact(contactId: string, body: TowerContactBody) {
  return request<TowerContact>(`/contacts/${contactId}`, {
    method: "PATCH",
    body,
  });
}

/** Needs an organization owner. */
export function deleteContact(contactId: string) {
  return request<void>(`/contacts/${contactId}`, { method: "DELETE" });
}

/** Creates each row on its own; a national id already in the book is skipped. */
export function importContacts(
  contacts: (TowerContactBody & { name: string })[]
) {
  return request<TowerContactImportResult>("/contacts/import", {
    method: "POST",
    body: { contacts },
  });
}

/** The shared request helper, for other Control Tower clients on the same proxy. */
export { request as controlTowerRequest, BASE as CONTROL_TOWER_BASE };
