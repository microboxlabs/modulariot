"use client";

/**
 * Client for the symptom catalog API (`/control-tower/symptom-definitions`
 * and `/control-tower/data-sources`), through the app's Control Tower proxy.
 * Types mirror the modulith's JSON.
 */

import useSWR, { mutate } from "swr";
import {
  CONTROL_TOWER_BASE,
  controlTowerRequest as request,
} from "../control-tower/control-tower-api";

export type SymptomState = "OFF" | "TEST" | "ACTIVE";
export type VersionBump = "PATCH" | "MINOR" | "MAJOR";
export type FieldOrigin =
  | "DEVICE"
  | "TRIP"
  | "VEHICLE"
  | "ROAD_NETWORK"
  | "ZONES"
  | "TENANT_SETTINGS"
  | "CALCULATED"
  | "CONNECTION";

export interface Step {
  role: string | null;
  channel: string | null;
  budgetMinutes: number | null;
  script: string | null;
}

export interface Notice {
  when: string;
  channel: string;
  connectionId: string | null;
  templateId: string | null;
  recipient: string | null;
}

export interface LevelResponse {
  operator: boolean;
  slaMinutes: number | null;
  steps: Step[];
  notices: Notice[];
  evidence: string[];
  ignorable: boolean;
  /** Who is told when the SLA runs out, e.g. "Jefe de torre". */
  escalateTo?: string | null;
  /** The case counts in consequence management. */
  consequence?: boolean;
}

export interface Level {
  icu: number;
  applies: boolean;
  when: string | null;
  response: LevelResponse | null;
}

/** A draft may be incomplete, so every part can be null until it is published. */
export interface SymptomSpec {
  source: string | null;
  activation: string | null;
  measure: {
    expression: string | null;
    label: string | null;
    unit: string | null;
  } | null;
  levels: Level[] | null;
  lifecycle: {
    open: string | null;
    close: string | null;
    /** An open case's level follows the measure down. */
    levelDown?: boolean;
  } | null;
  recurrence: {
    enabled: boolean;
    count: number;
    days: number;
    raiseLevels: number;
    /** "patente" (default) or "conductor". */
    entity?: string | null;
  } | null;
  /** A symptom_families value; null or missing keeps the symptom's. */
  family?: string | null;
  /** The state publishing this version sets; null or missing keeps the symptom's. */
  state?: SymptomState | null;
}

export interface SymptomDefinition {
  id: string;
  tenantCode: string;
  key: string;
  name: string;
  family: string | null;
  icon: string | null;
  description: string | null;
  sourceKey: string;
  engineRuleId: number | null;
  templateKey: string | null;
  forkedFromVersionId: string | null;
  state: SymptomState;
  currentVersion: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface SymptomVersion {
  id: string;
  definitionId: string;
  version: string | null;
  status: "DRAFT" | "PUBLISHED";
  spec: SymptomSpec;
  bump: VersionBump | null;
  reason: string | null;
  rolledBackFrom: string | null;
  createdBy: string;
  createdAt: string;
  publishedBy: string | null;
  publishedAt: string | null;
}

export interface SymptomSummary {
  definition: SymptomDefinition;
  hasDraft: boolean;
  /** The version in force; null before the first publish. */
  current?: SymptomVersion | null;
  /** Cached Harness description of the published activation (b, i, mark), if any. */
  activationText?: string | null;
}

/** Catalog numbers: weekly cases from the engine's last 90 days, operator load and recent changes. */
/** The operator team; null means not set. */
export interface TowerTeam {
  operators: number | null;
  shiftHours: number;
  capacityPerShift: number | null;
}

export interface SymptomStats {
  engineAvailable: boolean;
  windowDays: number;
  symptoms: {
    definitionId: string;
    weekByLevel: number[];
    week: number;
    operatorWeek: number;
  }[];
  totals: {
    weekByLevel: number[];
    week: number;
    perShift: number;
    topShare: { definitionIds: string[]; share: number } | null;
  };
  operators: TowerTeam & { slaMetLastWeek: number | null };
  changes: {
    drafts: number;
    lastPublished: {
      definitionId: string;
      name: string;
      version: string;
      at: string;
      by: string;
      reason: string | null;
    } | null;
  };
}

export interface SymptomDetail {
  definition: SymptomDefinition;
  current: SymptomVersion | null;
  draft: SymptomVersion | null;
  versions: SymptomVersion[];
  /** Per published version, what changed from the one before it; the first has none. */
  versionChanges?: Record<string, Change[]>;
  /** The symptom and version this one was copied from; version null when a draft was copied. */
  forkedFrom: {
    definitionId: string;
    name: string;
    version: string | null;
  } | null;
}

export interface Finding {
  section: string;
  severity: "ERROR" | "WARNING";
  message: string;
  position: number;
}

export interface ValidationReport {
  findings: Finding[];
  publishable: boolean;
  needsTestOnly: boolean;
}

export interface Change {
  section: string;
  bump: VersionBump;
  text: string;
}

export interface PublishPlan {
  changes: Change[];
  bump: VersionBump | null;
  nextVersion: string | null;
  report: ValidationReport;
}

export interface SourceField {
  path: string;
  label: string;
  type: string;
  unit: string | null;
  origin: FieldOrigin | null;
  engineSupported: boolean;
  /** The values a list field takes, as rules write them and as people read them. */
  values?: { value: string; label: string }[] | null;
}

export interface DataSource {
  id: string;
  tenantCode: string | null;
  key: string;
  name: string;
  kind: "SIGNAL" | "EVENT" | "CHECK" | "TRIP_EVENT" | "WEBHOOK";
  root: string;
  cadence: string | null;
  fields: SourceField[];
  samples: Record<string, unknown>[];
}

/** One activation condition run on its own on a sample. */
export interface ClauseResult {
  text: string;
  holds: boolean | null;
  /** The sample's value for each field the condition reads. */
  values: Record<string, unknown>;
  error: string | null;
}

export interface SamplePreview {
  sample: Record<string, unknown>;
  activates: boolean | null;
  measure: number | null;
  level: number | null;
  error: string | null;
  /** Each condition of an activation joined by &&; empty otherwise. */
  clauses?: ClauseResult[];
}

export interface Preview {
  source: string;
  samples: SamplePreview[];
}

export interface CreateSymptomBody {
  key: string;
  name: string;
  family?: string | null;
  icon?: string | null;
  description?: string | null;
  sourceKey: string;
  spec?: SymptomSpec;
}

const DEFS = `${CONTROL_TOWER_BASE}/symptom-definitions`;
const SOURCES = `${CONTROL_TOWER_BASE}/data-sources`;

export const definitionsKey = DEFS;
export const definitionKey = (id: string) => `${DEFS}/${id}`;

const fetcher = <T>(url: string) => request<T>(url);

export function useSymptomDefinitions() {
  return useSWR<SymptomSummary[]>(definitionsKey, fetcher);
}

export const statsKey = `${DEFS}/stats`;

const settingsKey = `${CONTROL_TOWER_BASE}/settings`;

/** The operator team as saved; the editor starts from it. */
export function useTowerTeam(enabled: boolean) {
  return useSWR<TowerTeam>(enabled ? settingsKey : null, fetcher, {
    revalidateOnFocus: false,
  });
}

/** Saves the operator team (owners); the stats carry it back. */
export async function saveTowerTeam(team: TowerTeam) {
  const saved = await request<TowerTeam>(settingsKey, {
    method: "PUT",
    body: team,
  });
  await mutate(settingsKey, saved, { revalidate: false });
  await mutate(statsKey);
  return saved;
}

/** Undefined data while loading; an error when the modulith or the engine fails. */
export function useSymptomStats() {
  return useSWR<SymptomStats>(statsKey, fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
}

export function useSymptomDefinition(id: string | null) {
  return useSWR<SymptomDetail>(id ? definitionKey(id) : null, fetcher);
}

export interface LevelResponseView {
  definitionId: string;
  name: string;
  version: string;
  state: SymptomState;
  level: Level;
}

/** What the tower does for a live case at one level; 404 (no data) when no symptom in force matches. */
export function useLevelResponse(
  symptomName: string | null,
  icu: number | null
) {
  const key =
    symptomName && icu != null
      ? `${DEFS}/response?symptom=${encodeURIComponent(symptomName)}&icu=${icu}`
      : null;
  return useSWR<LevelResponseView>(key, fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
}

export function useDataSources() {
  return useSWR<DataSource[]>(SOURCES, fetcher);
}

export function useDataSource(key: string | null) {
  return useSWR<DataSource>(key ? `${SOURCES}/${key}` : null, fetcher);
}

/** Refreshes the list and, when given, one symptom. */
export async function refreshSymptoms(id?: string) {
  await mutate(definitionsKey);
  await mutate(statsKey);
  if (id) await mutate(definitionKey(id));
}

export function createSymptom(body: CreateSymptomBody) {
  return request<SymptomDetail>(DEFS, { method: "POST", body });
}

export function updateIdentity(
  id: string,
  body: {
    name?: string;
    family?: string | null;
    icon?: string | null;
    description?: string | null;
  }
) {
  return request<SymptomDefinition>(`${DEFS}/${id}`, { method: "PATCH", body });
}

export interface ImportResult {
  created: {
    id: string;
    name: string;
    engineRuleId: number;
    pending: string[];
  }[];
  skipped: number;
}

/** A platform template: a ready symptom the organization copies. */
export interface SymptomTemplate {
  key: string;
  name: string;
  family: string;
  icon: string | null;
  /** When it opens, in words. */
  description: string;
  spec: SymptomSpec;
}

export function useSymptomTemplates(enabled: boolean) {
  return useSWR<SymptomTemplate[]>(
    enabled ? `${DEFS}/templates` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
}

/** Copies a template into the catalog, published as 0.1.0 in TEST. */
export function createFromTemplate(templateKey: string, name?: string) {
  return request<SymptomDetail>(`${DEFS}/from-template`, {
    method: "POST",
    body: { templateKey, name },
  });
}

/** Creates an off draft for each engine rule the organization does not have yet. */
export function importEngineRules() {
  return request<ImportResult>(`${DEFS}/import-engine`, { method: "POST" });
}

/** What a rule does, in plain words, written by the Harness and cached by rule. */
export function describeRule(body: {
  section: string;
  rule: string;
  sourceKey: string;
  locale?: string;
}) {
  return request<{ html: string; cached: boolean }>(`${DEFS}/describe`, {
    method: "POST",
    body,
  });
}

export function saveDraft(id: string, spec: SymptomSpec) {
  return request<SymptomVersion>(`${DEFS}/${id}/draft`, {
    method: "PUT",
    body: spec,
  });
}

export function discardDraft(id: string) {
  return request<void>(`${DEFS}/${id}/draft`, { method: "DELETE" });
}

export function validateSpec(id: string, spec?: SymptomSpec) {
  return request<ValidationReport>(`${DEFS}/${id}/validate`, {
    method: "POST",
    body: spec ?? {},
  });
}

export function previewSpec(id: string, spec?: SymptomSpec) {
  return request<Preview>(`${DEFS}/${id}/preview`, {
    method: "POST",
    body: spec ?? {},
  });
}

export const publishPlanKey = (id: string) => `${DEFS}/${id}/publish-plan`;

export function publishPlan(id: string) {
  return request<PublishPlan>(publishPlanKey(id));
}

/** What publishing the draft would do; null key when there is no draft. */
export function usePublishPlan(id: string, hasDraft: boolean) {
  return useSWR<PublishPlan>(hasDraft ? publishPlanKey(id) : null, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
}

/** A family the organization files symptoms under; the label is per language. */
export interface SymptomFamily {
  value: string;
  label: Record<string, string>;
  disabled: boolean;
}

export function useSymptomFamilies() {
  return useSWR<SymptomFamily[]>(
    `${CONTROL_TOWER_BASE}/symptom-families`,
    fetcher,
    { revalidateOnFocus: false }
  );
}

export function publishDraft(
  id: string,
  body: { reason: string; bump?: VersionBump | null }
) {
  return request<SymptomVersion>(`${DEFS}/${id}/publish`, {
    method: "POST",
    body,
  });
}

export function rollbackTo(id: string, version: string, reason?: string) {
  return request<SymptomVersion>(`${DEFS}/${id}/rollback`, {
    method: "POST",
    body: { version, reason },
  });
}

export function forkSymptom(
  id: string,
  body: { version?: string | null; key: string; name: string }
) {
  return request<SymptomDetail>(`${DEFS}/${id}/fork`, {
    method: "POST",
    body,
  });
}

export function setSymptomState(id: string, state: SymptomState) {
  return request<SymptomDefinition>(`${DEFS}/${id}/state`, {
    method: "PUT",
    body: { state },
  });
}

/** What changes from one published version to another; null while either is unknown. */
export function useVersionCompare(
  id: string,
  from: string | null,
  to: string | null
) {
  const key =
    from && to && from !== to
      ? `${DEFS}/${id}/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : null;
  return useSWR<Change[]>(key, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
}
