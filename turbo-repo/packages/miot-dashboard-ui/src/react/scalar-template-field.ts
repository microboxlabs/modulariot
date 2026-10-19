export function templateField(value: unknown, fallback: string) {
  if (value == null) return fallback;
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
