import { normalizeScalarColorRules } from "./scalar-color-rules";
const namedColors: Record<string, string> = {
  red: "ef4444",
  yellow: "eab308",
  green: "22c55e",
  blue: "3b82f6",
  orange: "f97316",
  purple: "a855f7",
  gray: "6b7280",
};
export function normalizeScalarThresholds(raw: unknown) {
  if (!raw || typeof raw !== "object")
    return { field: "", targets: [], rules: [] };
  const field =
    "field" in raw && typeof raw.field === "string" ? raw.field : "";
  const targets =
    "applyTo" in raw && Array.isArray(raw.applyTo) ? raw.applyTo : ["text"];
  const enabled = "enabled" in raw && raw.enabled === true;
  const entries = "rules" in raw && Array.isArray(raw.rules) ? raw.rules : [];
  const rules = normalizeScalarColorRules({
    rules: entries.map((entry: unknown) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        !("color" in entry) ||
        typeof entry.color !== "string"
      )
        return entry;
      const color = Object.hasOwn(namedColors, entry.color)
        ? namedColors[entry.color]
        : entry.color;
      return { ...entry, color };
    }),
  });
  return { field: enabled ? field : "", targets, rules };
}
