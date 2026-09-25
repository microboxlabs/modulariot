/** Prefix every operation, including keys returned by bucket listings. */
export function bucketKeys(prefix = "dashboards/") {
  const base = prefix === "" || prefix.endsWith("/") ? prefix : `${prefix}/`;
  if (
    base.startsWith("/") ||
    base.includes("\0") ||
    base.includes("\\") ||
    base.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new Error("Document prefix must be a relative bucket prefix");
  }
  return {
    prefix: base,
    full(key: string) {
      if (
        !key ||
        key.includes("\0") ||
        key.includes("\\") ||
        key.split("/").some((part) => !part || part === "." || part === "..")
      ) {
        throw new Error("Invalid document key");
      }
      return base + key;
    },
    relative(key: string) {
      return key.startsWith(base) && key.length > base.length
        ? key.slice(base.length)
        : null;
    },
  };
}

export function documentDate(value: string | Date | undefined): Date | null {
  if (value === undefined) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
