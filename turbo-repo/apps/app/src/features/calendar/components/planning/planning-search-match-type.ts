/**
 * The fields the planning search can match a freight service on.
 *
 * Declared once because it used to be written out five times — the sidebar
 * twice, the autocomplete, the tag bar, and the search context's param list —
 * and a member added to four of the five type-checks clean while silently
 * doing nothing in the fifth.
 *
 * `tipoViaje` is equipment (Sider / Doble Sider / Rampla); `tipoServicio` is
 * the Alerce service type (v / otr / ote). Different fields, deliberately
 * separate: `StoredServiceSchema` persists both.
 */
export const PLANNING_SEARCH_MATCH_TYPES = [
  "id",
  "cliente",
  "origen",
  "destino",
  "lugarCarguio",
  "permanencia",
  "tipoViaje",
  "tipoServicio",
] as const;

export type PlanningSearchMatchType =
  (typeof PLANNING_SEARCH_MATCH_TYPES)[number];
