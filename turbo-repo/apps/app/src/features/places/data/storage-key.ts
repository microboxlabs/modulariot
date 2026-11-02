/** Unscoped legacy data has no reliable owner and is never loaded implicitly. */
export function placesStorageKey(
  prefix: string,
  scope: string | null
): string | null {
  return scope ? `${prefix}:${encodeURIComponent(scope)}` : null;
}
