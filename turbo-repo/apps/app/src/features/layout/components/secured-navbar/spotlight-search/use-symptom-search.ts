"use client";

import { useMemo } from "react";
import { HiArrowRight } from "react-icons/hi";
import {
  type SymptomDefinition,
  useSymptomDefinitions,
} from "@/features/symptoms/maintainer/maintainer-api";
import type { SpotlightItem } from "./types";
import { norm } from "./use-pagefind-search";

/** The navigate item of the symptom catalog page; present only for users who can open it. */
export const SYMPTOM_CATALOG_ITEM = "navigate:symptomCatalog";
const PREFIX = "symptom:";
const LIMIT = 5;

/** Whether a spotlight item is a symptom row; those are not kept as recent pages. */
export const isSymptomItem = (item: SpotlightItem) =>
  item.id.startsWith(PREFIX);

/** Symptoms whose name or key contains the query, ignoring case and accents; names that start with it first. */
export function matchSymptoms(
  symptoms: SymptomDefinition[],
  query: string,
  limit = LIMIT
): SymptomDefinition[] {
  const q = norm(query.trim());
  if (!q) return [];
  const starts: SymptomDefinition[] = [];
  const contains: SymptomDefinition[] = [];
  for (const s of symptoms) {
    const name = norm(s.name);
    if (name.startsWith(q)) starts.push(s);
    else if (name.includes(q) || norm(s.key).includes(q)) contains.push(s);
  }
  return [...starts, ...contains].slice(0, limit);
}

/**
 * Spotlight rows for the organization's symptoms: a header with the catalog's
 * name, then one row per match that opens the symptom's sheet. The list is
 * fetched only while the panel is open and the user can open the catalog.
 */
export function useSymptomSearch(
  query: string,
  isOpen: boolean,
  navigateItems: SpotlightItem[],
  onNavigate: (href: string) => void
): SpotlightItem[] {
  const catalog = navigateItems.find((i) => i.id === SYMPTOM_CATALOG_ITEM);
  const { data } = useSymptomDefinitions(isOpen && catalog !== undefined);
  const group = catalog?.label;

  return useMemo(() => {
    if (!group || !data) return [];
    const matches = matchSymptoms(
      data.map((s) => s.definition),
      query
    );
    if (matches.length === 0) return [];
    return [
      {
        id: `${PREFIX}header`,
        label: group,
        kind: "navigate",
        keywords: [],
        onSelect: () => {},
        isGroupHeader: true,
      },
      ...matches.map(
        (s): SpotlightItem => ({
          id: `${PREFIX}${s.id}`,
          label: s.name,
          sublabel: group,
          kind: "navigate",
          icon: HiArrowRight,
          keywords: [s.name.toLowerCase(), s.key],
          onSelect: () => onNavigate(`/users/settings/symptoms/${s.id}`),
        })
      ),
    ];
  }, [group, data, query, onNavigate]);
}
