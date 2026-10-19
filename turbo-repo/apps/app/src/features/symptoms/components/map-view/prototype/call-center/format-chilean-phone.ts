/**
 * PROTOTYPE — formats a phone number as a Chilean mobile: "+56 9 1234 5678".
 * Accepts raw digits with or without the country code; anything that doesn't
 * resolve to a 9-digit national number is returned unchanged rather than
 * mangled (real `driver_contact` values aren't guaranteed to be Chilean).
 */
export function formatChileanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("56") ? digits.slice(2) : digits;
  if (national.length !== 9) return raw;
  return `+56 ${national[0]} ${national.slice(1, 5)} ${national.slice(5)}`;
}
