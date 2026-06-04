"use client";

import { useCallback, useMemo } from "react";
import { FaTruck, FaMapMarkerAlt, FaCalendarAlt } from "react-icons/fa";
import {
  PlanningSearchAutocomplete as GenericSearchAutocomplete,
  type SearchAutocompleteField,
} from "@microboxlabs/miot-calendar-ui";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { SelectedService } from "./planning-selection-context";

type MatchType =
  | "id"
  | "cliente"
  | "origen"
  | "destino"
  | "lugarCarguio"
  | "permanencia"
  | "tipoViaje";

export interface PlanningSearchAutocompleteProps {
  dict: I18nDictionary;
  services: SelectedService[];
  onSelect?: (service: SelectedService) => void;
  onMatchTypeSelect?: (matchType: MatchType, query: string) => void;
  onClear?: () => void;
  onQueryChange?: (q: string) => void;
  hasActiveFilter?: boolean;
  isLoading?: boolean;
}

/**
 * Searchable fields for freight services. `lugarCarguio` is intentionally
 * omitted: it is hard-coded to "" in transformTaskToService (not on
 * KanbanBoardTask), so it could never produce matches.
 */
const SEARCHABLE_FIELDS: readonly MatchType[] = [
  "id",
  "cliente",
  "origen",
  "destino",
  "permanencia",
  "tipoViaje",
] as const;

const FIELD_ICON: Record<MatchType, React.ReactNode> = {
  id: <FaTruck className="w-4 h-4 text-gray-600 dark:text-gray-400" />,
  cliente: <FaTruck className="w-4 h-4 text-gray-600 dark:text-gray-400" />,
  origen: <FaMapMarkerAlt className="w-4 h-4 text-gray-600 dark:text-gray-400" />,
  destino: <FaMapMarkerAlt className="w-4 h-4 text-gray-600 dark:text-gray-400" />,
  lugarCarguio: (
    <FaMapMarkerAlt className="w-4 h-4 text-gray-600 dark:text-gray-400" />
  ),
  permanencia: (
    <FaCalendarAlt className="w-4 h-4 text-gray-600 dark:text-gray-400" />
  ),
  tipoViaje: <FaTruck className="w-4 h-4 text-gray-600 dark:text-gray-400" />,
};

/**
 * Freight-domain shim over the generic package autocomplete. Builds the
 * searchable-field config (accessors, labels, icons) from the freight service
 * shape and keeps the historical `./planning-search-autocomplete` props so
 * callers stay unchanged. `onSelect`/`hasActiveFilter` are accepted for
 * back-compat; the package no longer needs them.
 */
export function PlanningSearchAutocomplete({
  dict,
  services,
  onMatchTypeSelect,
  onClear,
  onQueryChange,
  isLoading,
}: Readonly<PlanningSearchAutocompleteProps>) {
  const fields = useMemo<ReadonlyArray<SearchAutocompleteField<SelectedService>>>(
    () =>
      SEARCHABLE_FIELDS.map((matchType) => ({
        matchType,
        get: (service) => service[matchType],
        label: tr(`pages.planning.sidebar.search.matchType.${matchType}`, dict),
        icon: FIELD_ICON[matchType],
      })),
    [dict]
  );

  // Translate the box's chrome strings from our own dict so it works both inside
  // the calendar (CalendarProvider) and standalone (e.g. the move-file modal).
  const t = useCallback((path: string) => trDynamic(path, dict), [dict]);

  return (
    <GenericSearchAutocomplete
      services={services}
      fields={fields}
      t={t}
      onMatchTypeSelect={(matchType, query) =>
        onMatchTypeSelect?.(matchType as MatchType, query)
      }
      onClear={onClear}
      onQueryChange={onQueryChange}
      isLoading={isLoading}
    />
  );
}
