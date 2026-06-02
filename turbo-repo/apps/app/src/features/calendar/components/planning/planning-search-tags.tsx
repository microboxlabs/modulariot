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

/**
 * Capitalized, translated match-type label for the freight planning filters.
 * Match types are a closed set, so each key is resolved with the type-checked
 * `tr` (not a dynamic template) — a renamed/removed locale key fails the build
 * instead of silently shipping a raw key path.
 */
function freightTagLabel(dict: I18nDictionary, matchType: string): string {
  const labels: Record<MatchType, string> = {
    id: tr("pages.planning.sidebar.search.matchType.id", dict),
    cliente: tr("pages.planning.sidebar.search.matchType.cliente", dict),
    origen: tr("pages.planning.sidebar.search.matchType.origen", dict),
    destino: tr("pages.planning.sidebar.search.matchType.destino", dict),
    lugarCarguio: tr(
      "pages.planning.sidebar.search.matchType.lugarCarguio",
      dict
    ),
    permanencia: tr(
      "pages.planning.sidebar.search.matchType.permanencia",
      dict
    ),
    tipoViaje: tr("pages.planning.sidebar.search.matchType.tipoViaje", dict),
  };
  const label = labels[matchType as MatchType] ?? matchType;
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
