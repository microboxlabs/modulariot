export function parseJsonObject(
  value: string | undefined,
  fieldName: string,
): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON for ${fieldName}: ${message}`);
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`Invalid JSON for ${fieldName}: expected an object`);
  }

  return parsed as Record<string, unknown>;
}
