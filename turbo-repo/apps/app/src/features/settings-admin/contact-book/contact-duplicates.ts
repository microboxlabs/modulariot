/**
 * Duplicate checks for the contact book. A repeated name is only a warning
 * (two people can share a name); a repeated RUT is the same person, so it
 * blocks creating another contact.
 */

import { isRutValid } from "@/utils/rut";
import type { BookContact } from "./store";

/** RUT without dots, dashes or spaces, upper-cased ("12.345.678-k" → "12345678K"). */
export function normalizeRut(rut: string): string {
  return rut.replaceAll(/[.\-\s]/g, "").toUpperCase();
}

/** A normalized RUT with dots and dash, for display ("111111111" → "11.111.111-1"). */
export function displayRut(rut: string): string {
  const normalized = normalizeRut(rut);
  if (normalized.length < 2) return normalized;
  return `${groupThousands(normalized.slice(0, -1))}-${normalized.slice(-1)}`;
}

/** "11111111" → "11.111.111". */
function groupThousands(digits: string): string {
  if (!/^\d+$/.test(digits)) return digits;
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  return groups.join(".");
}

export type RutProblem = "invalid" | "duplicate";

export interface RutCheck {
  problem: RutProblem | null;
  /** The contact that already has this RUT, when `problem` is "duplicate". */
  match: BookContact | null;
}

/** An empty RUT is allowed (it's optional); a filled one must be valid and
 *  not belong to another contact. `selfId` is the contact being edited. */
export function checkRut(
  rut: string,
  contacts: readonly BookContact[],
  selfId?: string
): RutCheck {
  const normalized = normalizeRut(rut);
  if (!normalized) return { problem: null, match: null };
  if (!isRutValid(normalized)) return { problem: "invalid", match: null };
  const match =
    contacts.find(
      (c) => c.id !== selfId && c.rut && normalizeRut(c.rut) === normalized
    ) ?? null;
  return { problem: match ? "duplicate" : null, match };
}
