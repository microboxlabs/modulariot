"use client";

import { PlanningSearchTags as GenericSearchTags } from "@microboxlabs/miot-calendar-ui";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

type MatchType =
  | "id"
  | "cliente"
  | "origen"
  | "destino"
  | "lugarCarguio"
  | "permanencia"
  | "tipoViaje";

export interface SearchTag {
  matchType: MatchType;
  value: string;
}

export interface PlanningSearchTagsProps {
  dict: I18nDictionary;
  tags: SearchTag[];
  onTagsChange: (tags: SearchTag[]) => void;
}

/** Capitalized, translated match-type label for the freight planning filters. */
function freightTagLabel(dict: I18nDictionary, matchType: string): string {
  const label = tr(`pages.planning.sidebar.search.matchType.${matchType}`, dict);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Freight-domain shim over the generic package {@link GenericSearchTags}. Keeps
 * the historical `./planning-search-tags` import path + props while delegating
 * the chrome to the package; match-type labels are resolved via the app's `tr`.
 */
export function PlanningSearchTags({
  dict,
  tags,
  onTagsChange,
}: Readonly<PlanningSearchTagsProps>) {
  return (
    <GenericSearchTags
      tags={tags}
      onTagsChange={(next) => onTagsChange(next as SearchTag[])}
      labelFor={(matchType) => freightTagLabel(dict, matchType)}
    />
  );
}
