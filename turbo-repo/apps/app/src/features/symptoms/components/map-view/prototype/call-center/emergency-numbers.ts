/**
 * Emergency numbers the call panel always shows, by country (ISO 3166-1
 * alpha-2). A call to one is recorded with the role "Emergencias – <name>".
 */

import type { CallTarget } from "./call-targets";

export interface EmergencyNumber {
  name: string;
  number: string;
}

export const EMERGENCY_NUMBERS: Readonly<
  Record<string, readonly EmergencyNumber[]>
> = {
  CL: [
    { name: "Carabineros", number: "133" },
    { name: "Ambulancia (SAMU)", number: "131" },
    { name: "Bomberos", number: "132" },
    { name: "PDI", number: "134" },
  ],
};

/** The country whose numbers the panel shows, until the organization has one. */
export const EMERGENCY_COUNTRY = "CL";

export function emergencyTarget(
  country: string,
  e: EmergencyNumber
): CallTarget {
  return {
    id: `emergency:${country}:${e.number}`,
    personName: e.name,
    role: `Emergencias – ${e.name}`,
    phone: e.number,
    channels: { phone: e.number },
    methods: ["phone"],
    stats: null,
  };
}
