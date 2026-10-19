/**
 * Copied into the metadata row so `list` does not read one document per entry.
 * A config with no name is not an error; it lists under its slug.
 */
/** The config's `order` when it is a non-negative integer; the same rule the contract applies. */
export function dashboardSortOrder(config: unknown): number | undefined {
  if (typeof config !== "object" || config === null) return undefined;
  const order: unknown = (config as { order?: unknown }).order;
  return Number.isSafeInteger(order) && (order as number) >= 0
    ? (order as number)
    : undefined;
}

export function dashboardDisplayName(config: unknown, slug: string): string {
  if (typeof config === "object" && config !== null) {
    const named: unknown = (config as { name?: unknown }).name;
    if (typeof named === "string" && named.trim().length > 0) return named;
  }
  return slug;
}
