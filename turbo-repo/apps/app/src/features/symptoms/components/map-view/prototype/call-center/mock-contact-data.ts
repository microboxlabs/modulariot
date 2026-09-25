/**
 * PROTOTYPE — deterministic mock data for a "who to call" contact: there's no
 * real phonebook or call-history backing these entries (see `format-chilean-
 * phone.ts` for the same idea applied to phone numbers), so a stable hash of
 * the option id stands in for "the same contact always looks the same."
 */

export function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash;
}

const MOCK_FIRST_NAMES = [
  "Javiera",
  "Matías",
  "Camila",
  "Sebastián",
  "Valentina",
  "Cristóbal",
  "Antonia",
  "Ignacio",
];
const MOCK_LAST_NAMES = [
  "González",
  "Muñoz",
  "Rojas",
  "Contreras",
  "Fuentes",
  "Espinoza",
  "Reyes",
  "Vergara",
];

/** A plausible person name — distinct from the contact's role/label. */
export function mockNameForId(id: string): string {
  const hash = hashId(id);
  const first = MOCK_FIRST_NAMES[hash % MOCK_FIRST_NAMES.length];
  const last = MOCK_LAST_NAMES[Math.floor(hash / MOCK_FIRST_NAMES.length) % MOCK_LAST_NAMES.length];
  return `${first} ${last}`;
}

export interface MockCallStats {
  lastCallAt: Date;
  accepted: number;
  denied: number;
}

/** Stable "call history" summary for a contact — last-call time plus an
 *  accepted/denied tally, shown on the contact row and regenerated from the
 *  same id hash every render so it doesn't jump around. */
export function mockCallStatsForId(id: string): MockCallStats {
  const hash = hashId(id);
  const minutesAgo = 3 + (hash % 180);
  const accepted = hash % 5;
  const denied = Math.floor(hash / 5) % 4;
  return {
    lastCallAt: new Date(Date.now() - minutesAgo * 60_000),
    accepted,
    denied,
  };
}
