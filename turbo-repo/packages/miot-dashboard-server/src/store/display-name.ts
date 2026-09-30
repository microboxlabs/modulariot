/**
 * Copied into the metadata row so `list` does not read one document per entry.
 * A config with no name is not an error; it lists under its slug.
 */
export function dashboardDisplayName(config: unknown, slug: string): string {
  if (typeof config === "object" && config !== null) {
    const named: unknown = (config as { name?: unknown }).name;
    if (typeof named === "string" && named.trim().length > 0) return named;
  }
  return slug;
}
