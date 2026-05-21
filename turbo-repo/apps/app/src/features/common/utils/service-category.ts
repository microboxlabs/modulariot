/**
 * Helpers for displaying a planned service's category compactly.
 *
 * Service categories are stored on tasks/bookings as a service-type *code*
 * (e.g. "ST001"); the human-readable name is resolved from the service-types
 * catalog. Across cards and chips we only have room for a short token, so we
 * derive the Spanish initials of the (two-word) category name.
 */

/**
 * Derive a short uppercase token from a service category name.
 *
 *  "Servicio Programado"   → "SP"
 *  "Faena"                 → "FA"
 *  "  carga   peligrosa "  → "CP"
 *  ""                      → ""
 *
 * Names with three or more words only contribute their first two words.
 */
export function serviceCategoryInitials(
  name: string | null | undefined
): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
