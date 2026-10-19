/** Resolve a plain key or a single row template for sorting/filtering, never evaluate templates. */
export function resolveDataProperty(key: string): string | null {
  if (!key.includes("{{")) return key;
  const match = /^\{\{\s*(?:row\.)?(\w+)\s*\}\}$/.exec(key);
  return match ? (match[1] ?? null) : null;
}
