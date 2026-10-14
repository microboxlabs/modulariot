"use client";

import useSWR from "swr";
import { getJson, sendJson } from "@/features/settings-admin/data/json-client";

export type AssetKind = "TRUCK" | "TRAILER" | "DECOY" | "PERSON" | "OTHER";
export type AssetStatus = "IN_TRIP" | "AVAILABLE" | "NO_SIGNAL";
export type FieldSource = "SIGNAL" | "TRIP" | "MANUAL" | "NONE";
export type DocumentStatus = "MISSING" | "VALID" | "EXPIRING" | "EXPIRED";

export const ASSET_KINDS: AssetKind[] = [
  "TRUCK",
  "TRAILER",
  "DECOY",
  "PERSON",
  "OTHER",
];
export const DOCUMENT_KEYS = [
  "accreditation",
  "technicalReview",
  "circulationPermit",
  "insurance",
] as const;

/** Mirrors `TripView`. */
export interface Trip {
  id: string;
  origin: string | null;
  destination: string | null;
  status: string | null;
  start: string | null;
  end: string | null;
  eta: string | null;
  carrier: string | null;
  driver: string | null;
  trailer: string | null;
}

/** Mirrors `DocumentView`. */
export interface AssetDocument {
  key: string;
  expiresAt: string | null;
  status: DocumentStatus;
}

/** Mirrors `AssetRow`. */
export interface AssetRow {
  id: string;
  label: string | null;
  kind: AssetKind;
  status: AssetStatus;
  carrier: string | null;
  driver: string | null;
  currentTrip: Trip | null;
  nextTrip: Trip | null;
  accreditation: AssetDocument;
  km30d: number;
  lastSignalAt: string | null;
  gpsProvider: string | null;
  suggestions: number;
}

/** Mirrors `Summary`: counts over the whole fleet, before filters. */
export interface FleetSummary {
  assets: number;
  withSignal: number;
  inTrip: number;
  plannedToday: number;
  noSignal: number;
  documentsDue: number;
  suggestions: number;
}

export interface Facet {
  value: string;
  count: number;
}

/** Mirrors `AssetPage`. */
export interface AssetPage {
  items: AssetRow[];
  total: number;
  page: number;
  size: number;
  summary: FleetSummary;
  kinds: Facet[];
  carriers: Facet[];
}

/** Mirrors `FieldView`. */
export interface AssetField {
  key: string;
  value: string | null;
  source: FieldSource;
  integrationValue: string | null;
  integrationSource: FieldSource;
  reported: string | null;
  count: number | null;
  total: number | null;
  conflict: boolean;
  editable: boolean;
}

export interface Suggestion {
  kind: string;
  field: string;
  value: string;
  count: number;
  total: number;
}

export interface Change {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  origin: "MANUAL" | "SUGGESTION";
  changedBy: string | null;
  changedAt: string;
}

/** Mirrors `AssetDetail`. */
export interface AssetDetail {
  id: string;
  label: string | null;
  kind: AssetKind;
  status: AssetStatus;
  /** A signed studio image of the make and model; null when there is none. */
  image: { url: string; expiresAt: string } | null;
  fields: AssetField[];
  live: {
    lastSignalAt: string | null;
    lat: number | null;
    lon: number | null;
    speed: number | null;
    engineOn: boolean | null;
    gpsProvider: string | null;
    driver: string | null;
  };
  indicators: {
    km30d: number;
    engineHours30d: number;
    idlePct: number | null;
    utilizationPct: number | null;
    fleetUtilizationPct: number | null;
    trips30d: number;
    avgTripHours: number | null;
  };
  currentTrip: Trip | null;
  plannedTrips: Trip[];
  recentTrips: Trip[];
  documents: AssetDocument[];
  suggestions: Suggestion[];
  changes: Change[];
}

/** Mirrors `ActivityDay`. */
export interface ActivityDay {
  day: string;
  signals: number;
  engineSeconds: number;
  idleSeconds: number;
  movingSeconds: number;
  km: number;
}

export interface AssetFilters {
  q?: string;
  kind?: AssetKind;
  status?: AssetStatus;
  carrier?: string;
  suggestions?: boolean;
  documentsDue?: boolean;
  sort?: "id" | "signal" | "km";
  page?: number;
  size?: number;
}

export interface AssetUpdate {
  fields?: Record<string, string | null>;
  documents?: Record<string, string | null>;
}

const FLEET = "/app/api/fleet";

/** Signals arrive every minute; a minute is fresh enough for a directory. */
const REFRESH = { revalidateOnFocus: false, refreshInterval: 60 * 1000 };

export function assetPath(id: string): string {
  return `${FLEET}/assets/${encodeURIComponent(id)}`;
}

/** Query string with only the filters that are set. */
export function assetsUrl(filters: AssetFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "" || value === false) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return `${FLEET}/assets${query ? `?${query}` : ""}`;
}

/** Fetches only when `enabled`: the caller may view the fleet. */
export function useFleetAssets(filters: AssetFilters, enabled: boolean) {
  return useSWR<AssetPage>(enabled ? assetsUrl(filters) : null, getJson, {
    ...REFRESH,
    keepPreviousData: true,
  });
}

export function useFleetAsset(id: string, enabled: boolean) {
  return useSWR<AssetDetail>(enabled ? assetPath(id) : null, getJson, REFRESH);
}

export function useFleetActivity(id: string, days: number, enabled: boolean) {
  return useSWR<ActivityDay[]>(
    enabled ? `${assetPath(id)}/activity?days=${days}` : null,
    getJson,
    { revalidateOnFocus: false }
  );
}

export function updateAsset(id: string, update: AssetUpdate) {
  return sendJson<AssetDetail>("PATCH", assetPath(id), update);
}

export function acceptSuggestion(id: string, kind: string) {
  return sendJson<AssetDetail>(
    "POST",
    `${assetPath(id)}/suggestions/${encodeURIComponent(kind)}/accept`,
    {}
  );
}

export function dismissSuggestion(id: string, kind: string) {
  return sendJson<AssetDetail>(
    "POST",
    `${assetPath(id)}/suggestions/${encodeURIComponent(kind)}/dismiss`,
    {}
  );
}

export function field(
  detail: AssetDetail,
  key: string
): AssetField | undefined {
  return detail.fields.find((f) => f.key === key);
}

/** Only the entries that differ from what the form started with; blank clears the field. */
export function changedValues(
  initial: Record<string, string>,
  current: Record<string, string>
): Record<string, string | null> {
  const changed: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(current)) {
    if ((initial[key] ?? "") !== value) {
      changed[key] = value.trim() === "" ? null : value.trim();
    }
  }
  return changed;
}

/** Whole hours with one decimal, from seconds. */
export function hours(seconds: number): number {
  return Math.round(seconds / 360) / 10;
}

/** "hace 3 min" style, through Intl. */
export function ago(
  value: string | null,
  lang: string,
  now = Date.now()
): string {
  if (!value) return "—";
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

export function formatNumber(value: number, lang: string, digits = 0): string {
  return new Intl.NumberFormat(lang, {
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDateTime(value: string | null, lang: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDay(value: string | null, lang: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
