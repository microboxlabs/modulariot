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

/** The config's tags: trimmed, non-empty, each once, in the order given. */
export function dashboardTags(config: unknown): string[] {
  if (typeof config !== "object" || config === null) return [];
  const tags: unknown = (config as { tags?: unknown }).tags;
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const trimmed = tag.trim();
    if (trimmed.length > 0) seen.add(trimmed);
  }
  return [...seen];
}

export function dashboardDisplayName(config: unknown, slug: string): string {
  if (typeof config === "object" && config !== null) {
    const named: unknown = (config as { name?: unknown }).name;
    if (typeof named === "string" && named.trim().length > 0) return named;
  }
  return slug;
}
