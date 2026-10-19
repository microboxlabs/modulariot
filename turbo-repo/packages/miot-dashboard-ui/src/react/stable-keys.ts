/** Pairs items with content-derived React keys; repeats get an occurrence suffix. */
export function withStableKeys<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): { item: T; key: string }[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = keyOf(item);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { item, key: count ? `${base}#${count}` : base };
  });
}
