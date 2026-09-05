"use client";

/** `PlatformRoleService.MAX_PERSON_ID_LENGTH`. */
export const MAX_ASSIGNEE_LENGTH = 255;

/**
 * Deliberately loose: the modulith matches an assignee against the JWT's
 * `email` claim, and the authority on what an address may look like is the
 * identity provider, not this form. The check only catches obvious typos.
 *
 * Scanned rather than matched with one pattern. The obvious
 * `[^\s@]+@[^\s@]+\.[^\s@]+` backtracks super-linearly on a near-miss like
 * `a@bbbb…` with no dot — and a typo is exactly the input that fails to match,
 * so the slow path is the one an operator would hit.
 */
export function isPlausibleEmail(value: string): boolean {
  if (value.length === 0 || value.length > MAX_ASSIGNEE_LENGTH) return false;
  if (/\s/.test(value)) return false;

  const at = value.indexOf("@");
  const hasOneInfixAt =
    at > 0 && at === value.lastIndexOf("@") && at < value.length - 1;
  if (!hasOneInfixAt) return false;

  // A host with a dot in it, neither leading nor trailing.
  const host = value.slice(at + 1);
  const dot = host.indexOf(".");
  return dot > 0 && dot < host.length - 1;
}
