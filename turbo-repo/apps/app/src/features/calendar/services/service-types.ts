/**
 * The service types a freight trip can have, as Alfresco records them on
 * `mintral_serviceType` and as the `mintral_key` prefix spells them
 * (`v1457216`, `otr1152392`, `ote1158224`).
 *
 * Closed set on purpose: these are the three Alerce issues, and a calendar
 * filter that named a fourth would route nothing. Free text here would let a
 * typo create a calendar no trip ever resolves to, with nothing to show for it
 * but an empty planning grid.
 *
 * Not to be confused with `tipoViaje` (Sider / Doble Sider / Rampla), which is
 * equipment and lives on its own field.
 */
export const SERVICE_TYPES = ["v", "otr", "ote"] as const;

export type ServiceTypeCode = (typeof SERVICE_TYPES)[number];

/** How a service type is written for people: the kanban's `1152392-OTR`. */
export function serviceTypeLabel(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * The canonical form of a service type, or undefined when it is not one of
 * ours. miot-calendar stores these lower-cased and matches exactly, so this is
 * what has to reach it.
 */
export function normalizeServiceType(
  raw: string | null | undefined
): ServiceTypeCode | undefined {
  const value = raw?.trim().toLowerCase();
  return SERVICE_TYPES.find((t) => t === value);
}
