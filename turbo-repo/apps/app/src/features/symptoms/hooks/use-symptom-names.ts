"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSymptomsTable } from "@/features/common/providers/client-api.provider";
import { trDynamic } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

/**
 * localStorage key carrying the symptom names the symptoms table aggregated.
 * The value is a plain `string[]` of raw names — the contract between the
 * symptoms table (writer) and the filter bar's "Nombre del síntoma" dropdown
 * (reader), which live in different features.
 */
export const SYMPTOM_NAMES_KEY = "selector";

/** Same-tab notification, dispatched right after the write. */
const SAME_TAB_EVENT = "localStorageUpdated";

/** Filters the symptoms table queries on, read off the URL. */
export interface SymptomTableQuery {
  page: number;
  pageSize: number;
  icu_code: string;
  trip_id: string;
  asset_id: string;
  driver_id: string;
  carrier_id: string;
  origin: string;
  destination: string;
  symptom_name: string;
  date_range: { from: string; to: string };
}

/** The symptoms table query for the current URL. */
export function useSymptomTableQuery(
  page: number,
  pageSize: number
): SymptomTableQuery {
  const searchParams = useSearchParams();
  const get = (key: string) => searchParams.get(key) ?? "";

  return {
    page,
    pageSize,
    icu_code: get("icu_code"),
    trip_id: get("trip_id"),
    asset_id: get("asset_id"),
    driver_id: get("driver_id"),
    carrier_id: get("carrier_id"),
    origin: get("origin"),
    destination: get("destination"),
    symptom_name: get("symptom_name"),
    date_range: { from: get("date_from"), to: get("date_to") },
  };
}

function readSymptomNames(): string[] {
  try {
    const stored = localStorage.getItem(SYMPTOM_NAMES_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((n): n is string => typeof n === "string")
      : [];
  } catch (error) {
    console.error("Error parsing localStorage selector:", error);
    return [];
  }
}

/**
 * Publish the symptom names the "Nombre del síntoma" dropdown offers.
 *
 * Deliberately queries with `symptom_name` cleared: the aggregation the API
 * returns covers only the rows that matched, so publishing it from the filtered
 * query would shrink the dropdown to whatever is already selected and leave no
 * way to add a second symptom. Every other filter still applies, so the list
 * stays scoped to what the page is showing.
 *
 * With no symptom selected this is the same SWR key as the table's own query,
 * so it costs nothing; only an active symptom filter adds a request.
 */
export function usePublishSymptomNames(query: SymptomTableQuery): void {
  const { tableData } = useSymptomsTable({ ...query, symptom_name: "" });

  // Publish whenever a response has landed, empty included: a scope with no
  // symptoms must empty the dropdown rather than keep offering names from the
  // scope before it. The API omits `symptom_name_list` entirely when nothing
  // matched, so an absent list means "none", not "unknown".
  //
  // Compare by content: SWR hands back a fresh array on every revalidation, and
  // re-publishing an unchanged list would wake every reader on a timer. Nothing
  // is published while the first response is in flight; SWR keeps the previous
  // data during a refetch, so this never blinks through empty on a poll.
  const serialized = tableData
    ? JSON.stringify(tableData.symptoms_list ?? [])
    : "";

  useEffect(() => {
    if (!serialized) return;
    localStorage.setItem(SYMPTOM_NAMES_KEY, serialized);
    globalThis.dispatchEvent(
      new CustomEvent(SAME_TAB_EVENT, {
        detail: { key: SYMPTOM_NAMES_KEY, value: JSON.parse(serialized) },
      })
    );
  }, [serialized]);
}

/**
 * The published symptom names, kept in sync with writes from this tab and from
 * other tabs.
 *
 * Reading happens in an effect, never at module load: the list is written after
 * the table's first fetch, so a value captured at import time is always stale.
 */
export function useSymptomNames(): string[] {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setNames(readSymptomNames());
    sync();

    globalThis.addEventListener("storage", sync);
    globalThis.addEventListener(SAME_TAB_EVENT, sync);
    return () => {
      globalThis.removeEventListener("storage", sync);
      globalThis.removeEventListener(SAME_TAB_EVENT, sync);
    };
  }, []);

  return names;
}

/**
 * Turn raw symptom names into filter options, translating each through
 * `symptoms.types.*` and falling back to the raw name when it has no entry
 * (`trDynamic` echoes the path back for unknown keys).
 */
export function toSymptomOptions(
  names: string[],
  dict: I18nRecord
): { value: string; label: string }[] {
  return names.map((name) => {
    const path = `symptoms.types.${name}`;
    const label = trDynamic(path, dict);
    return { value: name, label: label === path ? name : label };
  });
}
