/**
 * PROTOTYPE — deterministic mock names for the treatments timeline's mock
 * call log (`mock-call-log.ts`, `group-treatments.ts`). Gated by
 * `isMockDataEnabled` (see `prototype-api-guard.ts`).
 */

import { isMockDataEnabled } from "../prototype-api-guard";

export function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash * 31 + (id.codePointAt(i) ?? 0)) >>> 0;
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
  if (!isMockDataEnabled()) return "";
  const hash = hashId(id);
  const first = MOCK_FIRST_NAMES[hash % MOCK_FIRST_NAMES.length];
  const last =
    MOCK_LAST_NAMES[
      Math.floor(hash / MOCK_FIRST_NAMES.length) % MOCK_LAST_NAMES.length
    ];
  return `${first} ${last}`;
}
