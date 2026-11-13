type IdInput = string | number | null | undefined;

/**
 * A trip id from a link or an API row, or "" when there is none. Rows of the
 * evaluator's cases carry a null trip, which older links wrote as "null".
 */
export function tripIdOf(value: IdInput): string {
  const id = value == null ? "" : String(value).trim();
  return id === "null" || id === "undefined" ? "" : id;
}

/** The evaluator's cases have negative symptom ids, as the modulith reads them. */
export function isEngineCaseId(symptomId: IdInput): boolean {
  return /^-\d{1,18}$/.test(String(symptomId ?? "").trim());
}

/** The treatment page of a symptom, without a trip parameter when it has none. */
export function treatmentHref(
  symptomId: string | number,
  tripId: IdInput,
  assetId: string | null | undefined
): string {
  const params = new URLSearchParams();
  const trip = tripIdOf(tripId);
  if (trip) params.set("tripId", trip);
  if (assetId) params.set("assetId", assetId);
  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  return `/symptoms/map-view/${symptomId}${suffix}`;
}

/** The operator's existing treatment, with its form open for continuation. */
export function continueTreatmentHref(href: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}open=1&menu=call_driver`;
}
