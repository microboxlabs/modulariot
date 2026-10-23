/**
 * A trip id from a link or an API row, or "" when there is none. Rows of the
 * evaluator's cases carry a null trip, which older links wrote as "null".
 */
export function tripIdOf(value: string | number | null | undefined): string {
  const id = value == null ? "" : String(value).trim();
  return id === "null" || id === "undefined" ? "" : id;
}

/** The evaluator's cases have negative symptom ids. */
export function isEngineCaseId(
  symptomId: string | number | null | undefined
): boolean {
  return /^-\d+$/.test(String(symptomId ?? "").trim());
}

/** The treatment page of a symptom, without a trip parameter when it has none. */
export function treatmentHref(
  symptomId: string | number,
  tripId: string | number | null | undefined,
  assetId: string | null | undefined
): string {
  const params = new URLSearchParams();
  const trip = tripIdOf(tripId);
  if (trip) params.set("tripId", trip);
  if (assetId) params.set("assetId", assetId);
  const query = params.toString();
  return `/symptoms/map-view/${symptomId}${query ? `?${query}` : ""}`;
}
