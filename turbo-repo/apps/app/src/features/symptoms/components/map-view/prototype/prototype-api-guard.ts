/**
 * Kill switch for the one real write left in the symptoms treatment screen:
 * the "invalidar síntoma" webhook (`/app/api/symptoms/invalidate`), which the
 * Control Tower API does not own yet. Treatments, contacts and option lists
 * go to the modulith Control Tower API (demo data) regardless of this flag.
 *
 * Fails closed: with no env var set, the webhook stays off. Set
 * `NEXT_PUBLIC_SYMPTOMS_PROTOTYPE_ENABLE_API=true` only where the webhook is
 * cleared to fire.
 */
export function isPrototypeApiDisabled(): boolean {
  return process.env.NEXT_PUBLIC_SYMPTOMS_PROTOTYPE_ENABLE_API !== "true";
}
